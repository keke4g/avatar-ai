import 'server-only';

import snapshotData from '@/data/territory/official-territorial-snapshot.json';
import {
  calculateGrowthPercent,
  calculateSharePercent,
  detectTerritorialDomains,
  normalizeTerritorialText,
  requestsNationalRanking,
} from './queryPlanning';
import type {
  TerritorialCitation,
  TerritorialDomain,
  TerritorialFact,
  TerritorialGeography,
  TerritorialInference,
  TerritorialIntelligenceContext,
  TerritorialPropertyContext,
} from './types';

type JsonRecord = Record<string, unknown>;

interface PopulationBucket {
  total: number;
  age0To11: number;
  age12To29: number;
  age30To59: number;
  age60Plus: number;
}

interface LaborSnapshot {
  quarter: string;
  occupiedWorkforce: number;
  averageMonthlyWageMxn: number;
  formalWorkforce: number;
  formalAverageMonthlyWageMxn: number;
  informalWorkforce: number;
  informalAverageMonthlyWageMxn: number;
  informalityRatePercent: number;
  economicallyActivePopulation: number;
  unemployedPopulation: number;
  unemploymentRatePercent: number;
  ageRanges: Array<{
    id: number;
    label: string;
    workforce: number;
    averageMonthlyWageMxn: number;
  }>;
  sectors: Array<{
    sectorId: string;
    sector: string;
    workforce: number;
    averageMonthlyWageMxn: number;
    informalWorkforce: number;
    informalityRatePercent: number;
  }>;
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
  labor?: LaborSnapshot;
}

interface OfficialSnapshot {
  schemaVersion: string;
  generatedAt: string;
  sources: Record<string, {
    sourceCode: string;
    organization: string;
    title: string;
    officialUrl: string;
    retrievedAt: string;
  }>;
  nation: SnapshotArea;
  states: Record<string, SnapshotArea>;
  municipalities: Record<string, SnapshotArea>;
}

const snapshot = snapshotData as unknown as OfficialSnapshot;
const ALL_DOMAINS: TerritorialDomain[] = [
  'demographics',
  'economic_sectors',
  'employment',
  'income',
  'informality',
  'business_activity',
  'housing_need',
  'housing_market',
  'purchasing_power',
];
const DATA_MEXICO_API = 'https://www.economia.gob.mx/datamexico/api/data';
const SNIIV_API = 'https://sniiv.sedatu.gob.mx/api/CuboAPI';
const LIVE_TIMEOUT_MS = 2_200;

const stateAreas = Object.values(snapshot.states);
const municipalityAreas = Object.values(snapshot.municipalities);

const toGeography = (area: SnapshotArea, level: TerritorialGeography['level']): TerritorialGeography => ({
  level,
  officialCode: area.code,
  name: area.name,
  ...(area.stateCode ? { stateCode: area.stateCode } : {}),
  ...(area.stateName ? { stateName: area.stateName } : {}),
});

const quarterLabel = (quarter: string): string => {
  if (!/^\d{5}$/.test(quarter)) return quarter;
  return `${quarter.slice(0, 4)}-T${quarter.slice(4)}`;
};

const finiteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const aggregateBy = (
  rows: JsonRecord[],
  labelKey: string,
  valueKey: string,
): Array<{ label: string; value: number }> => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const label = String(row[labelKey] ?? '').trim();
    if (!label || label.toLowerCase() === 'no disponible') return;
    totals.set(label, (totals.get(label) ?? 0) + finiteNumber(row[valueKey]));
  });
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((left, right) => right.value - left.value);
};

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'TowersMexico-TerritorialIntelligence/1.0' },
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const findNamedArea = (value: string, areas: SnapshotArea[]): SnapshotArea | undefined => {
  const normalized = normalizeTerritorialText(value);
  return [...areas]
    .sort((left, right) => right.name.length - left.name.length)
    .find((area) => {
      const name = normalizeTerritorialText(area.name);
      return name.length >= 3 && new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(normalized);
    });
};

export const resolveTerritorialGeography = (
  query: string,
  propertyContext?: TerritorialPropertyContext,
): { area: SnapshotArea; geography: TerritorialGeography; laborArea: SnapshotArea; laborIsFallback: boolean } => {
  const normalizedQuery = normalizeTerritorialText(query);
  const combinedLocation = [propertyContext?.city, propertyContext?.location, propertyContext?.state]
    .filter(Boolean)
    .join(' ');
  const queryMunicipality = findNamedArea(query, municipalityAreas);
  if (queryMunicipality) {
    const laborArea = snapshot.states[queryMunicipality.stateCode ?? ''] ?? snapshot.nation;
    return {
      area: queryMunicipality,
      geography: toGeography(queryMunicipality, 'MUNICIPALITY'),
      laborArea,
      laborIsFallback: true,
    };
  }

  const explicitlyNational = /\b(nacional|todo mexico|republica mexicana|pais)\b/.test(normalizedQuery)
    || (/\ben mexico\b/.test(normalizedQuery) && !/\bestado de mexico\b/.test(normalizedQuery));
  if (explicitlyNational) {
    return {
      area: snapshot.nation,
      geography: toGeography(snapshot.nation, 'NATION'),
      laborArea: snapshot.nation,
      laborIsFallback: false,
    };
  }

  const explicitStateOfMexico = /\bestado de mexico\b/.test(normalizedQuery)
    ? snapshot.states['15']
    : undefined;
  const queryState = explicitStateOfMexico ?? findNamedArea(query, stateAreas);
  if (queryState) {
    return {
      area: queryState,
      geography: toGeography(queryState, 'STATE'),
      laborArea: queryState,
      laborIsFallback: false,
    };
  }

  const contextMunicipality = findNamedArea(combinedLocation, municipalityAreas);
  if (contextMunicipality) {
    const laborArea = snapshot.states[contextMunicipality.stateCode ?? ''] ?? snapshot.nation;
    return {
      area: contextMunicipality,
      geography: toGeography(contextMunicipality, 'MUNICIPALITY'),
      laborArea,
      laborIsFallback: true,
    };
  }

  const contextState = findNamedArea(combinedLocation, stateAreas);
  if (contextState) {
    return {
      area: contextState,
      geography: toGeography(contextState, 'STATE'),
      laborArea: contextState,
      laborIsFallback: false,
    };
  }

  return {
    area: snapshot.nation,
    geography: toGeography(snapshot.nation, 'NATION'),
    laborArea: snapshot.nation,
    laborIsFallback: false,
  };
};

export const extractTerritorialPropertyContext = (value: unknown): TerritorialPropertyContext => {
  const result: TerritorialPropertyContext = {};
  const visit = (item: unknown, depth = 0): void => {
    if (depth > 5 || !item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.slice(0, 10).forEach((entry) => visit(entry, depth + 1));
      return;
    }
    Object.entries(item as JsonRecord).slice(0, 80).forEach(([key, entry]) => {
      const normalizedKey = normalizeTerritorialText(key).replace(/\s/g, '');
      if (typeof entry === 'string') {
        if (!result.city && /^(city|ciudad|municipality|municipio)$/.test(normalizedKey)) result.city = entry.slice(0, 120);
        if (!result.state && /^(state|estado)$/.test(normalizedKey)) result.state = entry.slice(0, 120);
        if (!result.location && /^(location|ubicacion|zona)$/.test(normalizedKey)) result.location = entry.slice(0, 240);
        if (!result.currency && /^(currency|moneda)$/.test(normalizedKey)) result.currency = entry.slice(0, 8);
      } else if (typeof entry === 'number' && Number.isFinite(entry)) {
        if (!result.priceAmount && /^(price|precio|priceamount)$/.test(normalizedKey)) result.priceAmount = entry;
        if (!result.monthlyRent && /^(rent|renta|monthlyrent)$/.test(normalizedKey)) result.monthlyRent = entry;
      } else {
        visit(entry, depth + 1);
      }
    });
  };
  visit(value);
  return result;
};

const businessActivityUrl = (geography: TerritorialGeography): string => {
  const url = new URL(DATA_MEXICO_API);
  url.searchParams.set('cube', 'inegi_economic_census_additional');
  url.searchParams.set('drilldowns', 'Sector');
  url.searchParams.set('measures', 'Economic Unit,Total Employees Depends on the Economic Unit,Total Income');
  url.searchParams.set('parents', 'false');
  url.searchParams.set('locale', 'es');
  if (geography.level === 'MUNICIPALITY') url.searchParams.set('Municipality', geography.officialCode);
  else if (geography.level === 'STATE') url.searchParams.set('State', geography.officialCode);
  else url.searchParams.set('Nation', 'mex');
  return url.href;
};

const getBusinessActivity = async (geography: TerritorialGeography): Promise<{
  rows: JsonRecord[];
  url: string;
}> => {
  const url = businessActivityUrl(geography);
  const payload = await fetchJson(url) as { data?: JsonRecord[] };
  return { rows: Array.isArray(payload.data) ? payload.data : [], url };
};

const getHousingMarket = async (geography: TerritorialGeography): Promise<{
  financingRows: JsonRecord[];
  registrationRows: JsonRecord[];
  financingUrl: string;
  registrationUrl: string;
} | null> => {
  if (geography.level === 'NATION') return null;
  const stateCode = geography.level === 'STATE' ? geography.officialCode : geography.stateCode;
  if (!stateCode) return null;
  const municipalityCode = geography.level === 'MUNICIPALITY' ? geography.officialCode.slice(2) : '0';
  const financingUrl = `${SNIIV_API}/GetFinanciamiento/2024,2025/${stateCode}/${municipalityCode}/rango_edad,rango_salarial,destino_credito`;
  const registrationUrl = `${SNIIV_API}/GetRegistro/2024,2025/${stateCode}/${municipalityCode}/segmento_uma,tipo_vivienda,pcu`;
  const [financing, registration] = await Promise.all([fetchJson(financingUrl), fetchJson(registrationUrl)]);
  return {
    financingRows: Array.isArray(financing) ? financing as JsonRecord[] : [],
    registrationRows: Array.isArray(registration) ? registration as JsonRecord[] : [],
    financingUrl,
    registrationUrl,
  };
};

const citationFromSnapshot = (
  id: string,
  sourceKey: string,
  locator: string,
  period: string,
  sourceRole: TerritorialCitation['sourceRole'],
): TerritorialCitation => {
  const source = snapshot.sources[sourceKey];
  return {
    id,
    sourceCode: source.sourceCode,
    organization: source.organization,
    title: source.title,
    officialUrl: source.officialUrl,
    locator,
    period,
    retrievedAt: source.retrievedAt,
    sourceRole,
  };
};

const addFact = (
  target: TerritorialFact[],
  fact: Omit<TerritorialFact, 'id'>,
): TerritorialFact => {
  const complete = { ...fact, id: `fact-${target.length + 1}` };
  target.push(complete);
  return complete;
};

const addInference = (
  target: TerritorialInference[],
  inference: Omit<TerritorialInference, 'id' | 'evidence'>,
): TerritorialInference => {
  const complete = { ...inference, id: `inference-${target.length + 1}`, evidence: 'derived_inference' as const };
  target.push(complete);
  return complete;
};

export async function getTerritorialIntelligenceContext(params: {
  query: string;
  propertyContext?: TerritorialPropertyContext;
}): Promise<TerritorialIntelligenceContext> {
  const requestedDomains = detectTerritorialDomains(params.query);
  const domains = requestedDomains.length > 0 ? requestedDomains : ALL_DOMAINS;
  const resolved = resolveTerritorialGeography(params.query, params.propertyContext);
  const { area, geography, laborArea, laborIsFallback } = resolved;
  const facts: TerritorialFact[] = [];
  const inferences: TerritorialInference[] = [];
  const citations: TerritorialCitation[] = [];
  const warnings: string[] = [];
  const period2025 = area.population['2025'];
  const period2030 = area.population['2030'];

  const needsDemographics = domains.includes('demographics') || domains.includes('housing_need');
  if (needsDemographics && period2025) {
    const citation = citationFromSnapshot('citation-conapo', 'conapo', `${geography.name}; grandes grupos de edad`, '2025–2040', 'primary');
    citations.push(citation);
    const populationFact = addFact(facts, {
      domain: 'demographics',
      label: 'Población proyectada',
      value: Math.round(period2025.total),
      unit: 'personas',
      period: '2025',
      geography,
      evidence: 'official_projection',
      citationIds: [citation.id],
      caveats: ['Es una proyección demográfica oficial, no un conteo observado en 2025.'],
    });
    (['age0To11', 'age12To29', 'age30To59', 'age60Plus'] as const).forEach((key) => {
      const labels = {
        age0To11: 'Población de 0 a 11 años',
        age12To29: 'Población de 12 a 29 años',
        age30To59: 'Población de 30 a 59 años',
        age60Plus: 'Población de 60 años y más',
      };
      addFact(facts, {
        domain: 'demographics',
        label: labels[key],
        value: Math.round(period2025[key]),
        unit: 'personas',
        period: '2025',
        geography,
        evidence: 'official_projection',
        citationIds: [citation.id],
        dimensions: { sharePercent: calculateSharePercent(period2025[key], period2025.total) },
      });
    });
    if (period2030) {
      const growth = calculateGrowthPercent(period2025.total, period2030.total);
      if (growth !== null) {
        addInference(inferences, {
          domain: 'demographics',
          label: 'Crecimiento poblacional proyectado 2025–2030',
          value: growth,
          unit: '%',
          geography,
          methodology: '(población 2030 / población 2025 - 1) × 100',
          inputFactIds: [populationFact.id],
          citationIds: [citation.id],
          confidence: 'HIGH',
          caveats: ['Crecimiento poblacional no garantiza plusvalía ni demanda solvente de vivienda.'],
        });
      }
    }
  }

  if (domains.includes('housing_need') && area.housingBacklog) {
    const citation = citationFromSnapshot(
      'citation-sniiv-backlog',
      geography.level === 'MUNICIPALITY' ? 'sniivMunicipalBacklog' : 'sniivStateBacklog',
      `${geography.name}; viviendas con y sin rezago`,
      area.housingBacklog.period,
      'primary',
    );
    citations.push(citation);
    addFact(facts, {
      domain: 'housing_need',
      label: 'Viviendas en rezago habitacional',
      value: area.housingBacklog.homesWithBacklog,
      unit: 'viviendas',
      period: area.housingBacklog.period,
      geography,
      evidence: 'official_observation',
      citationIds: [citation.id],
      dimensions: { ratePercent: area.housingBacklog.ratePercent },
      caveats: ['Rezago habitacional es una necesidad social observada; no equivale automáticamente a demanda comercial.'],
    });
  }

  const labor = laborArea.labor;
  const needsLabor = domains.some((domain) => ['employment', 'income', 'informality', 'economic_sectors', 'purchasing_power'].includes(domain));
  if (needsLabor && labor) {
    const laborGeography = toGeography(laborArea, laborArea.code === '00' ? 'NATION' : 'STATE');
    const period = quarterLabel(labor.quarter);
    const citation = citationFromSnapshot('citation-enoe', 'enoe', `${laborGeography.name}; cubo ENOE`, period, 'official_aggregator');
    citations.push(citation);
    const commonCaveats = laborIsFallback
      ? [`ENOE no es representativa para todos los municipios; se muestra el contexto estatal de ${laborGeography.name}.`]
      : [];
    if (domains.includes('employment') || domains.includes('informality')) {
      addFact(facts, {
        domain: 'employment',
        label: 'Población ocupada',
        value: labor.occupiedWorkforce,
        unit: 'personas',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        caveats: commonCaveats,
      });
      addFact(facts, {
        domain: 'employment',
        label: 'Tasa de desocupación estimada',
        value: labor.unemploymentRatePercent,
        unit: '% de la PEA',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        caveats: commonCaveats,
      });
      addFact(facts, {
        domain: 'informality',
        label: 'Población ocupada informal',
        value: labor.informalWorkforce,
        unit: 'personas',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        dimensions: { ratePercent: labor.informalityRatePercent },
        caveats: [...commonCaveats, 'Informalidad laboral no es sinónimo de comercio ambulante ni de falta de ingresos.'],
      });
    }
    if (domains.includes('income') || domains.includes('purchasing_power')) {
      addFact(facts, {
        domain: 'income',
        label: 'Salario mensual promedio de la población ocupada',
        value: labor.averageMonthlyWageMxn,
        unit: 'MXN mensuales',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        caveats: [...commonCaveats, 'Es un promedio laboral agregado; no representa ingreso disponible ni capacidad crediticia individual.'],
      });
      addFact(facts, {
        domain: 'income',
        label: 'Salario promedio formal / informal',
        value: `${labor.formalAverageMonthlyWageMxn} / ${labor.informalAverageMonthlyWageMxn}`,
        unit: 'MXN mensuales',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        caveats: commonCaveats,
      });
      labor.ageRanges
        .filter((row) => row.workforce >= 1_000)
        .sort((left, right) => right.averageMonthlyWageMxn - left.averageMonthlyWageMxn)
        .slice(0, 7)
        .forEach((row) => addFact(facts, {
          domain: 'purchasing_power',
          label: `Salario laboral promedio: ${row.label}`,
          value: row.averageMonthlyWageMxn,
          unit: 'MXN mensuales',
          period,
          geography: laborGeography,
          evidence: 'official_observation',
          citationIds: [citation.id],
          dimensions: { workforce: row.workforce },
          caveats: [...commonCaveats, 'Describe un grupo agregado y nunca debe usarse para inferir el ingreso de una persona por su edad.'],
        }));
    }
    if (domains.includes('economic_sectors')) {
      labor.sectors.slice(0, 7).forEach((row) => addFact(facts, {
        domain: 'economic_sectors',
        label: row.sector,
        value: row.workforce,
        unit: 'personas ocupadas estimadas',
        period,
        geography: laborGeography,
        evidence: 'official_observation',
        citationIds: [citation.id],
        dimensions: {
          averageMonthlyWageMxn: row.averageMonthlyWageMxn,
          informalityRatePercent: row.informalityRatePercent,
        },
        caveats: commonCaveats,
      }));
    }

    const propertyPrice = params.propertyContext?.priceAmount;
    if (domains.includes('purchasing_power') && propertyPrice && propertyPrice > 0 && labor.averageMonthlyWageMxn > 0) {
      const priceToAnnualWage = Math.round((propertyPrice / (labor.averageMonthlyWageMxn * 12)) * 10) / 10;
      const wageFact = facts.find((fact) => fact.label === 'Salario mensual promedio de la población ocupada');
      addInference(inferences, {
        domain: 'purchasing_power',
        label: 'Relación ilustrativa precio / salario laboral anual promedio',
        value: priceToAnnualWage,
        unit: 'años de salario bruto promedio',
        geography: laborGeography,
        methodology: 'precio publicado / (salario laboral promedio mensual × 12)',
        inputFactIds: wageFact ? [wageFact.id] : [],
        citationIds: [citation.id],
        confidence: 'LOW',
        caveats: ['No es un cálculo de asequibilidad del hogar, mensualidad ni elegibilidad crediticia.'],
      });
    }
  }

  if (requestsNationalRanking(params.query)) {
    const growthRanking = municipalityAreas
      .map((municipality) => ({
        municipality,
        base: municipality.population['2025']?.total ?? 0,
        growth: calculateGrowthPercent(
          municipality.population['2025']?.total ?? 0,
          municipality.population['2030']?.total ?? 0,
        ),
      }))
      .filter((entry) => entry.base >= 100_000 && entry.growth !== null)
      .sort((left, right) => (right.growth ?? 0) - (left.growth ?? 0))
      .slice(0, 8);
    if (growthRanking.length > 0) {
      const citationId = 'citation-conapo-ranking';
      if (!citations.some((citation) => citation.id === citationId)) {
        citations.push(citationFromSnapshot(citationId, 'conapo', 'Comparación municipal; población mínima 100,000', '2025–2030', 'primary'));
      }
      addInference(inferences, {
        domain: 'demographics',
        label: 'Municipios de al menos 100 mil habitantes con mayor crecimiento proyectado',
        value: growthRanking.map(({ municipality, growth }) => `${municipality.name}, ${municipality.stateName}: ${growth}%`).join('; '),
        unit: 'ranking descriptivo',
        geography: toGeography(snapshot.nation, 'NATION'),
        methodology: 'Orden descendente del crecimiento CONAPO 2025–2030; filtro de población 2025 ≥ 100,000.',
        inputFactIds: [],
        citationIds: [citationId],
        confidence: 'HIGH',
        caveats: ['Es potencial demográfico, no una recomendación de inversión ni garantía de plusvalía.'],
      });
    }

    if (domains.includes('housing_need')) {
      const backlogRanking = stateAreas
        .filter((state) => state.housingBacklog && state.housingBacklog.homesWithBacklog > 0)
        .sort((left, right) => (right.housingBacklog?.homesWithBacklog ?? 0) - (left.housingBacklog?.homesWithBacklog ?? 0))
        .slice(0, 8);
      if (backlogRanking.length > 0) {
        const citationId = 'citation-sniiv-backlog-ranking';
        if (!citations.some((citation) => citation.id === citationId)) {
          citations.push(citationFromSnapshot(citationId, 'sniivStateBacklog', 'Comparación estatal por viviendas en rezago', '2024', 'primary'));
        }
        addInference(inferences, {
          domain: 'housing_need',
          label: 'Entidades con mayor volumen de viviendas en rezago habitacional',
          value: backlogRanking
            .map((state) => `${state.name}: ${state.housingBacklog?.homesWithBacklog} viviendas (${state.housingBacklog?.ratePercent}%)`)
            .join('; '),
          unit: 'ranking descriptivo',
          geography: toGeography(snapshot.nation, 'NATION'),
          methodology: 'Orden descendente de viviendas clasificadas en rezago habitacional por SNIIV.',
          inputFactIds: [],
          citationIds: [citationId],
          confidence: 'HIGH',
          caveats: ['El volumen depende del tamaño de la entidad; el porcentaje se conserva para dar contexto.', 'Rezago social no equivale a demanda comercial solvente.'],
        });
      }
    }
  }

  if (domains.includes('business_activity') || domains.includes('economic_sectors')) {
    try {
      const business = await getBusinessActivity(geography);
      if (business.rows.length > 0) {
        const citation: TerritorialCitation = {
          id: 'citation-economic-census',
          sourceCode: 'inegi-economic-census',
          organization: 'INEGI / Secretaría de Economía',
          title: 'Censos Económicos — estructura sectorial municipal',
          officialUrl: business.url,
          locator: `${geography.name}; sector SCIAN`,
          period: '2019 (línea base estructural disponible en el cubo)',
          retrievedAt: new Date().toISOString(),
          sourceRole: 'official_aggregator',
        };
        citations.push(citation);
        business.rows
          .map((row) => ({
            sector: String(row.Sector ?? ''),
            units: finiteNumber(row['Economic Unit']),
            dependentEmployees: finiteNumber(row['Total Employees Depends on the Economic Unit']),
          }))
          .filter((row) => row.sector && row.units > 0)
          .sort((left, right) => right.units - left.units)
          .slice(0, 6)
          .forEach((row) => addFact(facts, {
            domain: 'business_activity',
            label: row.sector,
            value: Math.round(row.units),
            unit: 'unidades económicas',
            period: '2019',
            geography,
            evidence: 'official_observation',
            citationIds: [citation.id],
            dimensions: { personnelDependentOnUnit: Math.round(row.dependentEmployees) },
            caveats: ['Línea base estructural del Censo Económico; no incluye todo el comercio informal ni representa actividad mensual.'],
          }));
      }
    } catch (error) {
      warnings.push(`No se pudo actualizar Censos Económicos en vivo: ${error instanceof Error ? error.message : 'error desconocido'}.`);
    }
  }

  if (domains.includes('housing_market')) {
    try {
      const market = await getHousingMarket(geography);
      if (market) {
        const citation: TerritorialCitation = {
          id: 'citation-sniiv-market',
          sourceCode: 'sniiv-housing-financing',
          organization: 'SEDATU / CONAVI',
          title: 'SNIIV — financiamiento y registro de vivienda',
          officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
          locator: `${geography.name}; API CuboAPI`,
          period: '2024–2025',
          retrievedAt: new Date().toISOString(),
          sourceRole: 'primary',
        };
        citations.push(citation);
        const financingByDestination = aggregateBy(market.financingRows, 'destino_credito', 'acciones');
        const financingByAge = aggregateBy(market.financingRows, 'grupo_edad', 'acciones');
        const financingBySalary = aggregateBy(market.financingRows, 'rango_salarial', 'acciones');
        const registrationsByType = aggregateBy(market.registrationRows, 'tipo_vivienda', 'viviendas');
        [
          ['Financiamientos por destino', financingByDestination],
          ['Financiamientos por rango de edad', financingByAge],
          ['Financiamientos por rango salarial', financingBySalary],
          ['Vivienda registrada por tipo', registrationsByType],
        ].forEach(([label, rows]) => {
          const typedRows = rows as Array<{ label: string; value: number }>;
          if (typedRows.length === 0) return;
          addFact(facts, {
            domain: 'housing_market',
            label: String(label),
            value: typedRows.slice(0, 5).map((row) => `${row.label}: ${row.value}`).join('; '),
            unit: 'acciones o viviendas registradas',
            period: '2024–2025',
            geography,
            evidence: 'official_observation',
            citationIds: [citation.id],
            caveats: ['Los registros SNIIV no representan la totalidad de compraventas ni demanda no financiada.'],
          });
        });
      } else {
        warnings.push('El desglose SNIIV en vivo requiere una entidad o municipio; no se consultó para el total nacional.');
      }
    } catch (error) {
      warnings.push(`No se pudo actualizar SNIIV en vivo: ${error instanceof Error ? error.message : 'error desconocido'}.`);
    }
  }

  const coveredDomains = new Set<TerritorialDomain>([
    ...facts.map((fact) => fact.domain),
    ...inferences.map((inference) => inference.domain),
  ]);
  const missingDomains = domains.filter((domain) => !coveredDomains.has(domain));
  if (laborIsFallback && needsLabor) warnings.push(`Los indicadores laborales de ${geography.name} usan cobertura estatal porque ENOE no ofrece estimación municipal representativa universal.`);
  if (!process.env.INEGI_DENUE_TOKEN && domains.includes('business_activity')) {
    warnings.push('DENUE en vivo no está habilitado sin INEGI_DENUE_TOKEN; se usa la línea base agregada de Censos Económicos.');
  }

  return {
    schemaVersion: 'territorial-intelligence-v1',
    query: params.query,
    requestedDomains: domains,
    geography,
    facts: facts.slice(0, 35),
    inferences: inferences.slice(0, 8),
    citations: citations.filter((citation, index, all) => all.findIndex((candidate) => candidate.id === citation.id) === index),
    quality: {
      status: facts.length === 0 ? 'UNAVAILABLE' : missingDomains.length > 0 || warnings.length > 0 ? 'PARTIAL' : 'OK',
      coverage: geography.level === 'MUNICIPALITY'
        ? 'Demografía y vivienda municipal; empleo e ingreso con respaldo estatal; actividad empresarial municipal cuando el cubo responde.'
        : `${geography.level === 'STATE' ? 'Cobertura estatal' : 'Cobertura nacional'} con fuentes agregadas oficiales.`,
      freshness: `Fotografía base ${snapshot.generatedAt}; ENOE ${quarterLabel(labor?.quarter ?? '')}; consultas SNIIV/Censo Económico con caché de 24 horas.`,
      missingDomains,
      warnings,
    },
    responseRules: [
      'Responde primero la conclusión concreta y después los datos que la sostienen.',
      'Menciona geografía y periodo; cita el nombre de la institución de forma natural.',
      'Separa explícitamente observaciones oficiales, proyecciones e inferencias derivadas.',
      'No inventes cifras ni completes dominios ausentes con conocimiento general.',
      'No infieras ingreso, edad, elegibilidad crediticia ni perfil socioeconómico de una persona concreta.',
      'No uses edad u otra característica protegida para excluir o dirigir vivienda; los grupos son análisis agregados.',
      'No presentes crecimiento poblacional, rezago o actividad empresarial como garantía de plusvalía.',
      'Cierra con una pregunta breve que ayude a acotar territorio, tipo de vivienda o decisión.',
    ],
  };
}

export const buildTerritorialTrustedContext = (context: TerritorialIntelligenceContext): string => `
CONTEXTO TERRITORIAL OFICIAL Y TRAZABLE (generado por el servidor; tiene prioridad sobre suposiciones del modelo):
${JSON.stringify(context)}

Instrucciones obligatorias:
- Usa exclusivamente los hechos e inferencias incluidos arriba para cifras socioeconómicas, demográficas o de vivienda.
- Si quality.status es PARTIAL o UNAVAILABLE, explica el límite concreto sin afirmar que no tienes acceso a información.
- No confundas una proyección con un hecho observado ni un proxy con demanda comercial.
- Conserva cifras completas al hablar; pronuncia cantidades y porcentajes como valores, nunca dígito por dígito.
`.trim();
