import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const EMBEDDING_DIMENSIONS = 768;
const MAX_QUERY_CHARACTERS = 500;

export interface OfficialValuationKnowledgeMatch {
  sourceCode: string;
  sourceName: string;
  sourceUrl: string;
  locator: string | null;
  content: string;
  score: number;
}

interface SearchRow {
  source_code?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  locator?: unknown;
  content?: unknown;
  score?: unknown;
}

const requiredEnvironment = (): {
  supabaseUrl: string;
  serviceKey: string;
  googleApiKey: string;
} | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const googleApiKey = process.env.GOOGLE_API_KEY?.trim();
  return supabaseUrl && serviceKey && googleApiKey
    ? { supabaseUrl, serviceKey, googleApiKey }
    : null;
};

export async function searchOfficialValuationKnowledge(
  rawQuery: string,
  requestedLimit = 4,
): Promise<OfficialValuationKnowledgeMatch[]> {
  const environment = requiredEnvironment();
  const query = rawQuery.trim().slice(0, MAX_QUERY_CHARACTERS);
  if (!environment || query.length < 3) return [];

  const ai = new GoogleGenAI({ apiKey: environment.googleApiKey });
  const embeddingResponse = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: query,
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });
  const embedding = embeddingResponse.embeddings?.[0]?.values;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) return [];

  const client = createClient(environment.supabaseUrl, environment.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const limit = Math.max(1, Math.min(Math.floor(requestedLimit), 6));
  const { data, error } = await client.rpc('search_valuation_documents', {
    p_query_text: query,
    p_query_embedding: embedding,
    p_match_count: limit,
  });
  if (error) throw error;

  return ((data || []) as SearchRow[]).flatMap((row) => {
    if (
      typeof row.source_code !== 'string'
      || typeof row.source_name !== 'string'
      || typeof row.source_url !== 'string'
      || typeof row.content !== 'string'
    ) return [];

    return [{
      sourceCode: row.source_code,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      locator: typeof row.locator === 'string' ? row.locator : null,
      content: row.content.slice(0, 1_600),
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
    }];
  });
}
