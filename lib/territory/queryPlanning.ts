import type { TerritorialDomain } from './types';

const NORMALIZATION_DIACRITICS = /[\u0300-\u036f]/g;

export const normalizeTerritorialText = (value: string): string => value
  .normalize('NFD')
  .replace(NORMALIZATION_DIACRITICS, '')
  .toLowerCase()
  .replace(/[^a-z0-9%$\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const DOMAIN_PATTERNS: ReadonlyArray<[TerritorialDomain, RegExp]> = [
  ['economic_sectors', /\b(sectores? economicos?|actividad(?:es)? economicas?|industrias?|vocacion economica)\b/],
  ['employment', /\b(empleo|desempleo|ocupacion laboral|poblacion ocupada|pea|mercado laboral|puestos? de trabajo)\b/],
  ['income', /\b(salarios?|sueldos?|ingresos? laborales?|remuneraciones?)\b/],
  ['informality', /\b(informalidad|empleo informal|comercio informal|economia informal|ambulantes?)\b/],
  ['business_activity', /\b(actividad empresarial|unidades economicas|establecimientos?|empresas?|negocios?|comercios?)\b/],
  ['housing_need', /\b(necesidad de vivienda|rezago habitacional|deficit de vivienda|deficit habitacional|hacinamiento|presion habitacional)\b/],
  ['housing_market', /\b(sector inmobiliario|mercado inmobiliario|oferta de vivienda|registro de vivienda|financiamiento(?:s)? de vivienda)\b/],
  ['purchasing_power', /\b(poder adquisitivo|nivel adquisitivo|capacidad de compra|asequibilidad|capacidad de pago|rango(?:s)? de edad.*(?:ingreso|salario))\b/],
  ['demographics', /\b(demografia|demografico|poblacion|poblacional|crecimiento poblacional|nucleos? poblacionales?|edad(?:es)?|grupos? etarios?)\b/],
];

export const detectTerritorialDomains = (message: string): TerritorialDomain[] => {
  const normalized = normalizeTerritorialText(message);
  const domains = DOMAIN_PATTERNS
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([domain]) => domain);

  if (/\b(socioeconom|inteligencia territorial|perfil territorial|toma de decisiones)\b/.test(normalized)) {
    return [
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
  }

  if (domains.includes('purchasing_power') && !domains.includes('income')) domains.push('income');
  if (domains.includes('housing_need') && !domains.includes('demographics')) domains.push('demographics');
  return [...new Set(domains)];
};

export const isTerritorialIntelligenceQuery = (message: string): boolean =>
  detectTerritorialDomains(message).length > 0;

export const requestsNationalRanking = (message: string): boolean => {
  const normalized = normalizeTerritorialText(message);
  return /\b(donde|cuales|ranking|mayor|mejor|mas potencial|zonas|lugares|nucleos)\b/.test(normalized)
    && /\b(crecimiento|rezago|necesidad|poblacion|vivienda|sectores|empleo)\b/.test(normalized);
};

export const roundTerritorialMetric = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const calculateGrowthPercent = (base: number, future: number): number | null => {
  if (!Number.isFinite(base) || !Number.isFinite(future) || base <= 0) return null;
  return roundTerritorialMetric(((future / base) - 1) * 100, 2);
};

export const calculateSharePercent = (part: number, total: number): number | null => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0 || part < 0) return null;
  return roundTerritorialMetric((part / total) * 100, 2);
};
