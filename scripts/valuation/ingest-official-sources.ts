import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import {
  getPilotValuationSources,
  type ValuationSourceDefinition,
} from '../../lib/valuation/sourceRegistry';

const DOWNLOADABLE_EXTENSION = /\.(?:csv|xlsx?|pdf|zip|json)(?:$|[?#])/i;
const MAX_ASSETS_PER_SOURCE = 20;
const MAX_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_CHUNKS_PER_ASSET = 120;
const CHUNK_CHARACTERS = 2_400;
const CHUNK_OVERLAP = 240;
const EMBEDDING_DIMENSIONS = 768;
const PARSER_VERSION = 'valuation-doc-parser-v1';
const OFFICIAL_HOSTS = new Set([
  'sniiv.sedatu.gob.mx',
  'www.gob.mx',
  'sidof.segob.gob.mx',
  'www.inegi.org.mx',
  'inegi.org.mx',
  'catastro.culiacan.gob.mx',
  'www.congresosinaloa.gob.mx',
  'portafolioinfo.cnbv.gob.mx',
  'www.economia.gob.mx',
]);

interface DownloadRecord {
  sourceId: string;
  sourceUrl: string;
  assetUrl: string;
  downloadedAt: string;
  sha256: string;
  contentType: string;
  bytes: number;
  localPath: string;
  storagePath?: string;
  indexedChunks?: number;
}

interface DocumentChunk {
  index: number;
  content: string;
  locator: string;
  tokenEstimate: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

const outputRoot = path.resolve(process.cwd(), '.valuation-cache');

const normalizeExtractedText = (value: string): string => value
  .replace(/\u0000/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const htmlToSearchableText = (html: string): string => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const splitIntoChunks = (
  text: string,
  locator: string,
  metadata?: Record<string, unknown>,
): Omit<DocumentChunk, 'index'>[] => {
  const clean = normalizeExtractedText(text);
  if (!clean) return [];
  const chunks: Omit<DocumentChunk, 'index'>[] = [];
  let cursor = 0;
  while (cursor < clean.length && chunks.length < MAX_CHUNKS_PER_ASSET) {
    let end = Math.min(clean.length, cursor + CHUNK_CHARACTERS);
    if (end < clean.length) {
      const paragraphBoundary = clean.lastIndexOf('\n', end);
      const sentenceBoundary = clean.lastIndexOf('. ', end);
      const preferredBoundary = Math.max(paragraphBoundary, sentenceBoundary);
      if (preferredBoundary > cursor + CHUNK_CHARACTERS * 0.6) end = preferredBoundary + 1;
    }
    const content = clean.slice(cursor, end).trim();
    if (content) {
      chunks.push({
        content,
        locator,
        tokenEstimate: Math.ceil(content.length / 4),
        metadata,
      });
    }
    if (end >= clean.length) break;
    cursor = Math.max(cursor + 1, end - CHUNK_OVERLAP);
  }
  return chunks;
};

const extractDocumentChunks = async (
  bytes: Uint8Array,
  contentType: string,
  assetUrl: URL,
): Promise<DocumentChunk[]> => {
  const pathname = assetUrl.pathname.toLowerCase();
  const chunks: Omit<DocumentChunk, 'index'>[] = [];

  if (contentType.includes('pdf') || pathname.endsWith('.pdf')) {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      for (const page of result.pages) {
        chunks.push(...splitIntoChunks(page.text, `Página ${page.num}`, { page: page.num }));
        if (chunks.length >= MAX_CHUNKS_PER_ASSET) break;
      }
    } finally {
      await parser.destroy();
    }
  } else if (/\.(?:xlsx?|csv)(?:$|[?#])/i.test(assetUrl.href)
    || /spreadsheet|excel|csv/i.test(contentType)) {
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      chunks.push(...splitIntoChunks(csv, `Hoja ${sheetName}`, { sheet: sheetName }));
      if (chunks.length >= MAX_CHUNKS_PER_ASSET) break;
    }
  } else if (contentType.includes('json') || pathname.endsWith('.json')) {
    const raw = new TextDecoder().decode(bytes);
    let text = raw;
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      // Preserve malformed legacy JSON as searchable plain text.
    }
    chunks.push(...splitIntoChunks(text, 'Documento JSON'));
  } else if (contentType.includes('html') || /\.(?:html?|aspx)(?:$|[?#])/i.test(assetUrl.href)) {
    const html = new TextDecoder().decode(bytes);
    chunks.push(...splitIntoChunks(htmlToSearchableText(html), 'Página oficial'));
  }

  return chunks
    .slice(0, MAX_CHUNKS_PER_ASSET)
    .map((chunk, index) => ({ ...chunk, index }));
};

const addEmbeddings = async (chunks: DocumentChunk[]): Promise<DocumentChunk[]> => {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey || chunks.length === 0) return chunks;
  const ai = new GoogleGenAI({ apiKey });
  const enriched = [...chunks];

  for (let offset = 0; offset < chunks.length; offset += 50) {
    const batch = chunks.slice(offset, offset + 50);
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: batch.map((chunk) => chunk.content),
      config: {
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });
    response.embeddings?.forEach((embedding, batchIndex) => {
      if (embedding.values?.length === EMBEDDING_DIMENSIONS) {
        enriched[offset + batchIndex] = {
          ...enriched[offset + batchIndex],
          embedding: embedding.values,
        };
      }
    });
  }
  return enriched;
};

const safeName = (url: URL, index: number): string => {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || `asset-${index}`)
    .replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `${String(index).padStart(3, '0')}-${last || 'asset'}`;
};

const extractOfficialAssets = (html: string, baseUrl: URL): URL[] => {
  const urls = new Map<string, URL>();
  const hrefPattern = /(?:href|src)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    try {
      const candidate = new URL(match[1], baseUrl);
      if (!OFFICIAL_HOSTS.has(candidate.hostname)) continue;
      if (!DOWNLOADABLE_EXTENSION.test(candidate.href)) continue;
      urls.set(candidate.href, candidate);
    } catch {
      // Ignore malformed links published by legacy government portals.
    }
  }
  return [...urls.values()];
};

const fetchBytes = async (url: URL): Promise<{ bytes: Uint8Array; contentType: string }> => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'TowersMexico-ValuationIngestor/1.0 (+https://towersmexico.com)' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_ASSET_BYTES) {
    throw new Error(`Asset exceeds ${MAX_ASSET_BYTES} bytes: ${declaredSize}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`Asset exceeds ${MAX_ASSET_BYTES} bytes: ${bytes.byteLength}`);
  }
  return { bytes, contentType: response.headers.get('content-type') || 'application/octet-stream' };
};

const discoverAssets = async (source: ValuationSourceDefinition): Promise<URL[]> => {
  const landing = new URL(source.officialUrl);
  if (source.ingestionMode === 'api') return [landing];
  const response = await fetch(landing, {
    redirect: 'follow',
    headers: { 'user-agent': 'TowersMexico-ValuationIngestor/1.0 (+https://towersmexico.com)' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const assets = extractOfficialAssets(html, landing);
  // Preserve the official landing page when a legacy portal hides downloads
  // behind JavaScript. It keeps a verifiable trace for manual follow-up.
  if (assets.length === 0) {
    const sourceDir = path.join(outputRoot, source.id);
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, 'landing-page.html'), html, 'utf8');
    return [landing];
  }
  return assets.slice(0, MAX_ASSETS_PER_SOURCE);
};

const maybeUpload = async (record: DownloadRecord, bytes: Uint8Array): Promise<DownloadRecord> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return record;

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storagePath = `${record.sourceId}/${record.sha256}/${path.basename(record.localPath)}`;
  const { error } = await client.storage
    .from('valuation-raw')
    .upload(storagePath, bytes, { contentType: record.contentType, upsert: false });
  if (error && !/already exists/i.test(error.message)) throw error;
  return { ...record, storagePath };
};

const maybeIndexDocument = async (
  source: ValuationSourceDefinition,
  record: DownloadRecord,
  chunks: DocumentChunk[],
): Promise<DownloadRecord> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey || !record.storagePath || chunks.length === 0) {
    return { ...record, indexedChunks: 0 };
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc('ingest_valuation_document', {
    p_document: {
      source,
      file: {
        ...record,
        parserVersion: PARSER_VERSION,
      },
      chunks,
    },
  });
  if (error) throw error;
  const indexedChunks = Number((data as { chunks?: unknown } | null)?.chunks || chunks.length);
  return { ...record, indexedChunks };
};

async function main() {
  const requestedSource = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1];
  const sources = getPilotValuationSources().filter(
    (source) => !requestedSource || source.id === requestedSource,
  );
  if (sources.length === 0) throw new Error(`Fuente desconocida: ${requestedSource}`);

  await mkdir(outputRoot, { recursive: true });
  const records: DownloadRecord[] = [];

  for (const source of sources) {
    if (source.ingestionMode === 'manual-review') continue;
    try {
      const assets = await discoverAssets(source);
      const sourceDir = path.join(outputRoot, source.id);
      await mkdir(sourceDir, { recursive: true });

      for (const [index, asset] of assets.entries()) {
        const { bytes, contentType } = await fetchBytes(asset);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const localPath = path.join(sourceDir, safeName(asset, index + 1));
        await writeFile(localPath, bytes);
        let record = await maybeUpload({
          sourceId: source.id,
          sourceUrl: source.officialUrl,
          assetUrl: asset.href,
          downloadedAt: new Date().toISOString(),
          sha256,
          contentType,
          bytes: bytes.byteLength,
          localPath: path.relative(process.cwd(), localPath),
        }, bytes);
        const extractedChunks = await extractDocumentChunks(bytes, contentType, asset);
        const embeddedChunks = await addEmbeddings(extractedChunks);
        record = await maybeIndexDocument(source, record, embeddedChunks);
        records.push(record);
      }
    } catch (error) {
      records.push({
        sourceId: source.id,
        sourceUrl: source.officialUrl,
        assetUrl: source.officialUrl,
        downloadedAt: new Date().toISOString(),
        sha256: '',
        contentType: 'error',
        bytes: 0,
        localPath: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const previousPath = path.join(outputRoot, 'manifest.json');
  let previous: DownloadRecord[] = [];
  try {
    previous = JSON.parse(await readFile(previousPath, 'utf8')) as DownloadRecord[];
  } catch {
    previous = [];
  }
  const byIdentity = new Map(previous.map((item) => [`${item.sourceId}:${item.sha256}:${item.assetUrl}`, item]));
  records.forEach((item) => byIdentity.set(`${item.sourceId}:${item.sha256}:${item.assetUrl}`, item));
  await writeFile(previousPath, JSON.stringify([...byIdentity.values()], null, 2), 'utf8');

  const failures = records.filter((record) => record.contentType === 'error');
  console.log(JSON.stringify({ downloaded: records.length - failures.length, failures }, null, 2));
  if (failures.length === records.length && records.length > 0) process.exitCode = 1;
}

void main();
