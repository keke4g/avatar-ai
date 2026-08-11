import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TOP_LIMIT = Number(process.argv.find((value) => value.startsWith('--top='))?.split('=')[1] || 20);
const AS_JSON = process.argv.includes('--json');

const LANGUAGE_BY_EXTENSION = new Map([
  ['.tsx', 'TSX'],
  ['.ts', 'TypeScript'],
  ['.jsx', 'JSX'],
  ['.js', 'JavaScript'],
  ['.mjs', 'JavaScript (ESM)'],
  ['.cjs', 'JavaScript (CJS)'],
  ['.css', 'CSS'],
  ['.scss', 'SCSS'],
  ['.sql', 'SQL'],
  ['.py', 'Python'],
  ['.java', 'Java'],
  ['.kt', 'Kotlin'],
  ['.kts', 'Kotlin Script'],
  ['.xml', 'XML'],
  ['.gradle', 'Gradle'],
  ['.ps1', 'PowerShell'],
]);

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.gradle',
  '.idea',
  '.next',
  '.vercel',
  '.agents',
  '.codex',
  '.market-scraper-cache',
  '.market-scraper-crawl',
  'node_modules',
  'output',
  'dist',
  'build',
  'coverage',
  'scratch',
  'venv',
]);

function shouldSkipDirectory(name) {
  return EXCLUDED_DIRECTORY_NAMES.has(name)
    || name.startsWith('.audit')
    || name.startsWith('.diagnostic')
    || name.startsWith('.playwright')
    || name.startsWith('.venv');
}

function countLines(content) {
  if (!content) return { lines: 0, nonEmpty: 0 };
  const rows = content.split(/\r\n|\n|\r/);
  if (rows.at(-1) === '') rows.pop();
  return {
    lines: rows.length,
    nonEmpty: rows.reduce((count, row) => count + Number(/\S/.test(row)), 0),
  };
}

async function collectCodeFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      files.push(...await collectCodeFiles(absolutePath, relativePath));
      continue;
    }

    if (!entry.isFile() || entry.name === 'next-env.d.ts') continue;
    const extension = path.extname(entry.name).toLowerCase();
    const language = LANGUAGE_BY_EXTENSION.get(extension);
    if (!language) continue;

    const content = await readFile(absolutePath, 'utf8');
    const counts = countLines(content);
    const normalizedPath = relativePath.split(path.sep).join('/');
    files.push({
      path: normalizedPath,
      extension,
      language,
      ...counts,
      isTest: normalizedPath.startsWith('tests/'),
      isHistoricalSql: normalizedPath.startsWith('scripts/sql/legacy/'),
    });
  }

  return files;
}

function sum(files, key) {
  return files.reduce((total, file) => total + file[key], 0);
}

function createReport(files) {
  const tests = files.filter((file) => file.isTest);
  const historicalSql = files.filter((file) => file.isHistoricalSql);
  const active = files.filter((file) => !file.isHistoricalSql);
  const productionAndTools = files.filter((file) => !file.isTest && !file.isHistoricalSql);

  const byLanguage = Array.from(
    files.reduce((groups, file) => {
      const current = groups.get(file.language) || { language: file.language, files: 0, lines: 0, nonEmpty: 0 };
      current.files += 1;
      current.lines += file.lines;
      current.nonEmpty += file.nonEmpty;
      groups.set(file.language, current);
      return groups;
    }, new Map()).values(),
  ).sort((left, right) => right.lines - left.lines);

  return {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    totals: {
      files: files.length,
      lines: sum(files, 'lines'),
      nonEmpty: sum(files, 'nonEmpty'),
      activeLinesWithoutHistoricalSql: sum(active, 'lines'),
      productionAndToolsLines: sum(productionAndTools, 'lines'),
      testLines: sum(tests, 'lines'),
      historicalSqlLines: sum(historicalSql, 'lines'),
    },
    byLanguage,
    largestFiles: [...files]
      .sort((left, right) => right.lines - left.lines)
      .slice(0, Math.max(1, TOP_LIMIT))
      .map(({ path: filePath, language, lines, nonEmpty }) => ({
        path: filePath,
        language,
        lines,
        nonEmpty,
      })),
  };
}

function printTable(report) {
  const { totals } = report;
  console.log('Resumen');
  console.table([
    { categoria: 'Código fuente total', lineas: totals.lines },
    { categoria: 'Líneas no vacías', lineas: totals.nonEmpty },
    { categoria: 'Código activo sin SQL histórico', lineas: totals.activeLinesWithoutHistoricalSql },
    { categoria: 'Producción/herramientas sin pruebas ni SQL histórico', lineas: totals.productionAndToolsLines },
    { categoria: 'Pruebas', lineas: totals.testLines },
    { categoria: 'SQL histórico archivado', lineas: totals.historicalSqlLines },
    { categoria: 'Archivos de código', lineas: totals.files },
  ]);
  console.log('Por lenguaje');
  console.table(report.byLanguage);
  console.log(`Archivos más grandes (top ${report.largestFiles.length})`);
  console.table(report.largestFiles);
}

const files = await collectCodeFiles(ROOT);
const report = createReport(files);

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTable(report);
}
