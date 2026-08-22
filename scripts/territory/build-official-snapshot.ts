import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const CONAPO_URL = 'https://www.datos.gob.mx/dataset/f2b9b220-3ef7-4e3a-bde6-87e1dac78c6a/resource/99b28bb6-8e31-48e1-b162-85a7e4deafc3/download/pobproy_ggrupos.csv';
const SNIIV_MUNICIPAL_BACKLOG_URL = 'https://sistemas.sedatu.gob.mx/repositorio/proxy/alfresco-noauth/api/internal/shared/node/brPGRXRIRl21UTZLP1ic4A/content/rezago_habitacional_mun_2020.csv?a=true';
const SNIIV_STATE_BACKLOG_URL = 'https://sistemas.sedatu.gob.mx/repositorio/proxy/alfresco-noauth/api/internal/shared/node/HXsrMcyMS_iLS0Mk3ezWVQ/content/rezago_habitacional_2024.csv?a=true';
const DATA_MEXICO_API = 'https://www.economia.gob.mx/datamexico/api/data';
const DATA_MEXICO_PROFILE = 'https://www.economia.gob.mx/datamexico/es/profile/geo/mexico';
const TARGET_YEARS = new Set(['2025', '2030', '2035', '2040']);
const OUTPUT_PATH = path.resolve(process.cwd(), 'data/territory/official-territorial-snapshot.json');
// Some Mexican open-data CDNs reject descriptive crawler user agents even for
// public CSVs, so use their browser-compatible path and identify the client in
// a separate header where supported.
const USER_AGENT = 'Mozilla/5.0';
const execFileAsync = promisify(execFile);

type CsvRow = Record<string, string>;
type JsonRow = Record<string, unknown>;

interface PopulationBucket {
  total: number;
  age0To11: number;
  age12To29: number;
  age30To59: number;
  age60Plus: number;
}

interface SnapshotArea {
  code: string;
  name: string;
  stateCode?: string;
  stateName?: string;
  population: Record<string, PopulationBucket>;
  housingBacklog?: {
    period: string;
    homesWithBacklog: number;
    homesWithoutBacklog: number;
    ratePercent: number;
  };
  labor?: JsonRow;
}

const numberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      'x-towers-mexico-client': 'territorial-intelligence-v1',
      accept: 'text/csv,text/plain,*/*',
      referer: url.includes('datos.gob.mx')
        ? 'https://www.datos.gob.mx/es/dataset/proyecciones-de-poblacion'
        : 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
    },
  });
  if (response.ok) return response.text();

  // datos.gob.mx sometimes rejects Node's HTTP fingerprint while serving the
  // same public asset to curl. Keep a deterministic fallback for CI refreshes.
  const { stdout } = await execFileAsync('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--user-agent',
    USER_AGENT,
    '--referer',
    url.includes('datos.gob.mx')
      ? 'https://www.datos.gob.mx/es/dataset/proyecciones-de-poblacion'
      : 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
    url,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (!stdout) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return stdout;
};

const parseCsv = (raw: string): CsvRow[] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    const next = raw[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      currentRow.push(currentCell);
      currentCell = '';
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
    } else {
      currentCell += character;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows.map((cells) => Object.fromEntries(
    headers.map((header, index) => [header.replace(/^\uFEFF/, '').trim() || `_column_${index}`, cells[index] ?? '']),
  ));
};

const dataMexicoUrl = (params: Record<string, string>): string => {
  const url = new URL(DATA_MEXICO_API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
};

const fetchDataMexico = async (params: Record<string, string>): Promise<{ url: string; raw: string; data: JsonRow[] }> => {
  const url = dataMexicoUrl(params);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const raw = await response.text();
  const parsed = JSON.parse(raw) as { data?: JsonRow[] };
  return { url, raw, data: Array.isArray(parsed.data) ? parsed.data : [] };
};

const addPopulation = (target: PopulationBucket, row: CsvRow): void => {
  target.age0To11 += numberValue(row.POB_00_011);
  target.age12To29 += numberValue(row.POB_012_29);
  target.age30To59 += numberValue(row.POB_30_59);
  target.age60Plus += numberValue(row.POB_60_mm);
  target.total += numberValue(row.POB_TOTAL);
};

const emptyPopulation = (): PopulationBucket => ({
  total: 0,
  age0To11: 0,
  age12To29: 0,
  age30To59: 0,
  age60Plus: 0,
});

const buildLaborSnapshot = async (): Promise<{
  queryUrls: string[];
  responseHash: string;
  latestQuarter: string;
  nation: JsonRow;
  states: Record<string, JsonRow>;
}> => {
  const classification = 'Classification of Formal and Informal Jobs of the First Activity';
  const base = { cube: 'inegi_enoe', locale: 'es', parents: 'false' };
  const nationalFormality = await fetchDataMexico({
    ...base,
    [classification]: '1,2',
    'Population Classification': '1',
    Nation: 'mex',
    drilldowns: `Nation,Quarter,${classification}`,
    measures: 'Monthly Wage,Workforce',
  });
  const latestQuarterId = Math.max(...nationalFormality.data.map((row) => numberValue(row['Quarter ID'])));
  if (!Number.isFinite(latestQuarterId) || latestQuarterId <= 0) {
    throw new Error('Data México no devolvió un trimestre ENOE válido.');
  }
  const latestQuarter = String(latestQuarterId);

  const queryDefinitions = {
    stateFormality: {
      ...base,
      [classification]: '1,2',
      'Population Classification': '1',
      Quarter: latestQuarter,
      drilldowns: `State,${classification}`,
      measures: 'Monthly Wage,Workforce',
    },
    stateAge: {
      ...base,
      'Population Classification': '1',
      Quarter: latestQuarter,
      drilldowns: 'State,Age Range',
      measures: 'Monthly Wage,Workforce',
    },
    nationAge: {
      ...base,
      'Population Classification': '1',
      Quarter: latestQuarter,
      drilldowns: 'Age Range',
      measures: 'Monthly Wage,Workforce',
    },
    stateSectors: {
      ...base,
      'Population Classification': '1',
      Quarter: latestQuarter,
      drilldowns: 'State,Sector',
      measures: 'Monthly Wage,Workforce',
    },
    nationSectors: {
      ...base,
      'Population Classification': '1',
      Quarter: latestQuarter,
      drilldowns: 'Sector',
      measures: 'Monthly Wage,Workforce',
    },
    stateInformalSectors: {
      ...base,
      [classification]: '1',
      Quarter: latestQuarter,
      drilldowns: 'State,Sector',
      measures: 'Workforce',
      parents: 'true',
    },
    nationInformalSectors: {
      ...base,
      [classification]: '1',
      Quarter: latestQuarter,
      drilldowns: 'Sector',
      measures: 'Workforce',
      parents: 'true',
    },
    statePea: {
      ...base,
      'Economically Active Population': '1',
      Quarter: latestQuarter,
      drilldowns: 'State',
      measures: 'Workforce',
    },
    nationPea: {
      ...base,
      'Economically Active Population': '1',
      Quarter: latestQuarter,
      drilldowns: 'Quarter',
      measures: 'Workforce',
    },
    stateUnemployed: {
      ...base,
      'Economically Active Population': '1',
      'Population Classification': '2',
      Quarter: latestQuarter,
      drilldowns: 'State',
      measures: 'Workforce',
    },
    nationUnemployed: {
      ...base,
      'Economically Active Population': '1',
      'Population Classification': '2',
      Quarter: latestQuarter,
      drilldowns: 'Quarter',
      measures: 'Workforce',
    },
  } satisfies Record<string, Record<string, string>>;

  const keys = Object.keys(queryDefinitions) as Array<keyof typeof queryDefinitions>;
  const results = await Promise.all(keys.map((key) => fetchDataMexico(queryDefinitions[key])));
  const byKey = Object.fromEntries(keys.map((key, index) => [key, results[index]])) as Record<keyof typeof queryDefinitions, Awaited<ReturnType<typeof fetchDataMexico>>>;
  const queryUrls = [nationalFormality.url, ...results.map((result) => result.url)];
  const responseHash = sha256([nationalFormality.raw, ...results.map((result) => result.raw)].join('\n'));

  const buildAreaLabor = (
    formalityRows: JsonRow[],
    ageRows: JsonRow[],
    sectorRows: JsonRow[],
    informalSectorRows: JsonRow[],
    pea: number,
    unemployed: number,
  ): JsonRow => {
    const formal = formalityRows.find((row) => numberValue(row[`${classification} ID`]) === 2);
    const informal = formalityRows.find((row) => numberValue(row[`${classification} ID`]) === 1);
    const formalWorkforce = numberValue(formal?.Workforce);
    const informalWorkforce = numberValue(informal?.Workforce);
    const occupiedWorkforce = formalWorkforce + informalWorkforce;
    const weightedWage = occupiedWorkforce > 0
      ? ((numberValue(formal?.['Monthly Wage']) * formalWorkforce)
        + (numberValue(informal?.['Monthly Wage']) * informalWorkforce)) / occupiedWorkforce
      : 0;

    const sectors = sectorRows
      .map((row) => {
        const sectorId = String(row['Sector ID'] ?? '');
        const workforce = numberValue(row.Workforce);
        const informalWorkforceForSector = numberValue(
          informalSectorRows.find((candidate) => String(candidate['Sector ID'] ?? '') === sectorId)?.Workforce,
        );
        return {
          sectorId,
          sector: String(row.Sector ?? ''),
          workforce: Math.round(workforce),
          averageMonthlyWageMxn: round(numberValue(row['Monthly Wage']), 2),
          informalWorkforce: Math.round(informalWorkforceForSector),
          informalityRatePercent: workforce > 0 ? round((informalWorkforceForSector / workforce) * 100, 2) : 0,
        };
      })
      .filter((row) => row.sectorId && row.workforce > 0)
      .sort((left, right) => right.workforce - left.workforce);

    return {
      quarter: latestQuarter,
      occupiedWorkforce: Math.round(occupiedWorkforce),
      averageMonthlyWageMxn: round(weightedWage, 2),
      formalWorkforce: Math.round(formalWorkforce),
      formalAverageMonthlyWageMxn: round(numberValue(formal?.['Monthly Wage']), 2),
      informalWorkforce: Math.round(informalWorkforce),
      informalAverageMonthlyWageMxn: round(numberValue(informal?.['Monthly Wage']), 2),
      informalityRatePercent: occupiedWorkforce > 0 ? round((informalWorkforce / occupiedWorkforce) * 100, 2) : 0,
      economicallyActivePopulation: Math.round(pea),
      unemployedPopulation: Math.round(unemployed),
      unemploymentRatePercent: pea > 0 ? round((unemployed / pea) * 100, 2) : 0,
      ageRanges: ageRows
        .map((row) => ({
          id: numberValue(row['Age Range ID']),
          label: String(row['Age Range'] ?? ''),
          workforce: Math.round(numberValue(row.Workforce)),
          averageMonthlyWageMxn: round(numberValue(row['Monthly Wage']), 2),
        }))
        .filter((row) => row.id > 0 && row.workforce > 0),
      sectors,
    };
  };

  const nationFormalityRows = nationalFormality.data.filter((row) => numberValue(row['Quarter ID']) === latestQuarterId);
  const nationPea = numberValue(byKey.nationPea.data[0]?.Workforce);
  const nationUnemployed = numberValue(byKey.nationUnemployed.data[0]?.Workforce);
  const nation = buildAreaLabor(
    nationFormalityRows,
    byKey.nationAge.data,
    byKey.nationSectors.data,
    byKey.nationInformalSectors.data,
    nationPea,
    nationUnemployed,
  );

  const states: Record<string, JsonRow> = {};
  for (let stateNumber = 1; stateNumber <= 32; stateNumber += 1) {
    const stateCode = String(stateNumber).padStart(2, '0');
    const matchesState = (row: JsonRow): boolean => String(row['State ID'] ?? '').padStart(2, '0') === stateCode;
    states[stateCode] = buildAreaLabor(
      byKey.stateFormality.data.filter(matchesState),
      byKey.stateAge.data.filter(matchesState),
      byKey.stateSectors.data.filter(matchesState),
      byKey.stateInformalSectors.data.filter(matchesState),
      numberValue(byKey.statePea.data.find(matchesState)?.Workforce),
      numberValue(byKey.stateUnemployed.data.find(matchesState)?.Workforce),
    );
  }

  return { queryUrls, responseHash, latestQuarter, nation, states };
};

async function main(): Promise<void> {
  const [conapoRaw, municipalBacklogRaw, stateBacklogRaw, laborSnapshot] = await Promise.all([
    fetchText(CONAPO_URL),
    fetchText(SNIIV_MUNICIPAL_BACKLOG_URL),
    fetchText(SNIIV_STATE_BACKLOG_URL),
    buildLaborSnapshot(),
  ]);

  const municipalities: Record<string, SnapshotArea> = {};
  const states: Record<string, SnapshotArea> = {};
  const nation: SnapshotArea = { code: '00', name: 'México', population: {} };
  const populationRows = parseCsv(conapoRaw);

  populationRows.forEach((row) => {
    const year = row.ANO;
    if (!TARGET_YEARS.has(year)) return;
    const stateCode = row.CLAVE_ENT.padStart(2, '0');
    const municipalityCode = row.CLAVE.padStart(5, '0');
    const stateName = row.NOM_ENT;
    const municipalityName = row.NOM_MUN;
    const municipality = municipalities[municipalityCode] ?? {
      code: municipalityCode,
      name: municipalityName,
      stateCode,
      stateName,
      population: {},
    };
    const state = states[stateCode] ?? {
      code: stateCode,
      name: stateName,
      population: {},
    };
    municipality.population[year] ??= emptyPopulation();
    state.population[year] ??= emptyPopulation();
    nation.population[year] ??= emptyPopulation();
    addPopulation(municipality.population[year], row);
    addPopulation(state.population[year], row);
    addPopulation(nation.population[year], row);
    municipalities[municipalityCode] = municipality;
    states[stateCode] = state;
  });

  parseCsv(municipalBacklogRaw).forEach((row) => {
    const stateCode = row.clave_entidad_federativa?.padStart(2, '0');
    const municipalityPart = row.clave_municipio?.padStart(3, '0');
    if (!stateCode || !municipalityPart) return;
    const area = municipalities[`${stateCode}${municipalityPart}`];
    if (!area) return;
    const withBacklog = numberValue(row.con_rezago);
    const withoutBacklog = numberValue(row.sin_rezago);
    const total = withBacklog + withoutBacklog;
    area.housingBacklog = {
      period: '2020',
      homesWithBacklog: Math.round(withBacklog),
      homesWithoutBacklog: Math.round(withoutBacklog),
      ratePercent: total > 0 ? round((withBacklog / total) * 100, 2) : 0,
    };
  });

  const stateBacklogRows = parseCsv(stateBacklogRaw);
  Object.values(states).forEach((state) => {
    const matchingRows = stateBacklogRows.filter((row) => row.ent?.padStart(2, '0') === state.code);
    const withBacklog = numberValue(matchingRows.find((row) => row.rezago === 'En rezago')?.viviendas);
    const withoutBacklog = numberValue(matchingRows.find((row) => row.rezago === 'Sin rezago')?.viviendas);
    const total = withBacklog + withoutBacklog;
    state.housingBacklog = {
      period: '2024',
      homesWithBacklog: Math.round(withBacklog),
      homesWithoutBacklog: Math.round(withoutBacklog),
      ratePercent: total > 0 ? round((withBacklog / total) * 100, 2) : 0,
    };
    state.labor = laborSnapshot.states[state.code];
  });
  nation.labor = laborSnapshot.nation;

  const generatedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 'official-territorial-snapshot-v1',
    generatedAt,
    sources: {
      conapo: {
        sourceCode: 'conapo-population-projections',
        organization: 'CONAPO',
        title: 'Reconstrucción y proyecciones de población municipal 1990–2040',
        officialUrl: 'https://www.datos.gob.mx/es/dataset/proyecciones-de-poblacion',
        assetUrl: CONAPO_URL,
        sha256: sha256(conapoRaw),
        retrievedAt: generatedAt,
        license: 'CC BY 4.0',
      },
      sniivMunicipalBacklog: {
        sourceCode: 'sniiv-housing-backlog',
        organization: 'SEDATU / CONAVI',
        title: 'Rezago habitacional municipal 2020',
        officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
        assetUrl: SNIIV_MUNICIPAL_BACKLOG_URL,
        sha256: sha256(municipalBacklogRaw),
        retrievedAt: generatedAt,
        license: 'Acceso público; atribución requerida',
      },
      sniivStateBacklog: {
        sourceCode: 'sniiv-housing-backlog',
        organization: 'SEDATU / CONAVI',
        title: 'Rezago habitacional estatal 2024',
        officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
        assetUrl: SNIIV_STATE_BACKLOG_URL,
        sha256: sha256(stateBacklogRaw),
        retrievedAt: generatedAt,
        license: 'Acceso público; atribución requerida',
      },
      enoe: {
        sourceCode: 'data-mexico-enoe',
        organization: 'Secretaría de Economía / INEGI',
        title: `Data México — ENOE ${laborSnapshot.latestQuarter}`,
        officialUrl: DATA_MEXICO_PROFILE,
        queryUrls: laborSnapshot.queryUrls,
        sha256: laborSnapshot.responseHash,
        retrievedAt: generatedAt,
        primarySource: 'INEGI, ENOE',
      },
    },
    nation,
    states,
    municipalities,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot), 'utf8');
  console.log(JSON.stringify({
    output: path.relative(process.cwd(), OUTPUT_PATH),
    bytes: JSON.stringify(snapshot).length,
    states: Object.keys(states).length,
    municipalities: Object.keys(municipalities).length,
    latestQuarter: laborSnapshot.latestQuarter,
    generatedAt,
  }, null, 2));
}

void main();
