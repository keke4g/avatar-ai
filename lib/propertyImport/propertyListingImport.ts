export type ImportedPropertyType =
  | 'Casa'
  | 'Departamento'
  | 'Penthouse'
  | 'Townhouse'
  | 'Villa'
  | 'Casa de Playa'
  | 'Cabaña'
  | 'Loft'
  | 'Terreno'
  | 'Local Comercial'
  | 'Desconocido';

export type ImportedPropertyOperation =
  | 'SALE'
  | 'MONTHLY_RENT'
  | 'SHORT_RENT'
  | 'SWAP'
  | 'UNKNOWN';

export interface PropertyListingImportResult {
  title: string;
  shortDescription: string;
  propertyType: ImportedPropertyType;
  operation: ImportedPropertyOperation;
  priceAmount: number;
  currency: 'MXN' | 'USD' | 'UNKNOWN';
  bedrooms: number;
  fullBathrooms: number;
  halfBathrooms: number;
  levels: number;
  parkingSpaces: number;
  surfaceTotal: number;
  surfaceBuilt: number;
  surfaceFront: number;
  surfaceDepth: number;
  developmentName: string;
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  addressHint: string;
  legalDebtFreeMentioned: boolean;
  legalDebtFree: boolean;
  financingMentioned: boolean;
  financing: {
    bankCredit: boolean;
    infonavit: boolean;
    fovissste: boolean;
    cash: boolean;
    developer: boolean;
  };
  presetAmenities: string[];
  customAmenities: string[];
  detectedFacts: string[];
  warnings: string[];
}

const PROPERTY_TYPES = new Set<ImportedPropertyType>([
  'Casa',
  'Departamento',
  'Penthouse',
  'Townhouse',
  'Villa',
  'Casa de Playa',
  'Cabaña',
  'Loft',
  'Terreno',
  'Local Comercial',
  'Desconocido',
]);

const OPERATIONS = new Set<ImportedPropertyOperation>([
  'SALE',
  'MONTHLY_RENT',
  'SHORT_RENT',
  'SWAP',
  'UNKNOWN',
]);

const CURRENCIES = new Set(['MXN', 'USD', 'UNKNOWN']);

const text = (value: unknown, max = 1_200): string =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : '';

const number = (value: unknown, max = Number.MAX_SAFE_INTEGER): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.round(parsed * 100) / 100, max)
    : 0;
};

const nonNegativeInteger = (value: unknown, max = 100): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(Math.round(parsed), max)
    : 0;
};

const stringList = (value: unknown, maxItems: number, maxLength = 100): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item) => text(item, maxLength))
    .filter((item) => {
      const key = normalizeForMatch(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
};

export function parsePropertyListingImport(
  value: unknown,
): PropertyListingImportResult | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const financingCandidate =
    candidate.financing && typeof candidate.financing === 'object'
      ? candidate.financing as Record<string, unknown>
      : {};

  const propertyType = PROPERTY_TYPES.has(candidate.propertyType as ImportedPropertyType)
    ? candidate.propertyType as ImportedPropertyType
    : 'Desconocido';
  const operation = OPERATIONS.has(candidate.operation as ImportedPropertyOperation)
    ? candidate.operation as ImportedPropertyOperation
    : 'UNKNOWN';
  const currency = CURRENCIES.has(candidate.currency as string)
    ? candidate.currency as PropertyListingImportResult['currency']
    : 'UNKNOWN';

  return {
    title: text(candidate.title, 100),
    shortDescription: text(candidate.shortDescription, 1_200),
    propertyType,
    operation,
    priceAmount: number(candidate.priceAmount, 1_000_000_000),
    currency,
    bedrooms: nonNegativeInteger(candidate.bedrooms, 100),
    fullBathrooms: nonNegativeInteger(candidate.fullBathrooms, 100),
    halfBathrooms: nonNegativeInteger(candidate.halfBathrooms, 100),
    levels: nonNegativeInteger(candidate.levels, 100),
    parkingSpaces: nonNegativeInteger(candidate.parkingSpaces, 100),
    surfaceTotal: number(candidate.surfaceTotal, 10_000_000),
    surfaceBuilt: number(candidate.surfaceBuilt, 10_000_000),
    surfaceFront: number(candidate.surfaceFront, 100_000),
    surfaceDepth: number(candidate.surfaceDepth, 100_000),
    developmentName: text(candidate.developmentName, 140),
    city: text(candidate.city, 100),
    state: text(candidate.state, 100),
    country: text(candidate.country, 100),
    neighborhood: text(candidate.neighborhood, 140),
    addressHint: text(candidate.addressHint, 240),
    legalDebtFreeMentioned: candidate.legalDebtFreeMentioned === true,
    legalDebtFree: candidate.legalDebtFree === true,
    financingMentioned: candidate.financingMentioned === true,
    financing: {
      bankCredit: financingCandidate.bankCredit === true,
      infonavit: financingCandidate.infonavit === true,
      fovissste: financingCandidate.fovissste === true,
      cash: financingCandidate.cash === true,
      developer: financingCandidate.developer === true,
    },
    presetAmenities: stringList(candidate.presetAmenities, 40),
    customAmenities: stringList(candidate.customAmenities, 40),
    detectedFacts: stringList(candidate.detectedFacts, 30, 180),
    warnings: stringList(candidate.warnings, 12, 220),
  };
}

export const PROPERTY_LISTING_IMPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    shortDescription: { type: 'string' },
    propertyType: {
      type: 'string',
      enum: [
        'Casa',
        'Departamento',
        'Penthouse',
        'Townhouse',
        'Villa',
        'Casa de Playa',
        'Cabaña',
        'Loft',
        'Terreno',
        'Local Comercial',
        'Desconocido',
      ],
    },
    operation: {
      type: 'string',
      enum: ['SALE', 'MONTHLY_RENT', 'SHORT_RENT', 'SWAP', 'UNKNOWN'],
    },
    priceAmount: { type: 'number' },
    currency: { type: 'string', enum: ['MXN', 'USD', 'UNKNOWN'] },
    bedrooms: { type: 'number' },
    fullBathrooms: { type: 'number' },
    halfBathrooms: { type: 'number' },
    levels: { type: 'number' },
    parkingSpaces: { type: 'number' },
    surfaceTotal: { type: 'number' },
    surfaceBuilt: { type: 'number' },
    surfaceFront: { type: 'number' },
    surfaceDepth: { type: 'number' },
    developmentName: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    country: { type: 'string' },
    neighborhood: { type: 'string' },
    addressHint: { type: 'string' },
    legalDebtFreeMentioned: { type: 'boolean' },
    legalDebtFree: { type: 'boolean' },
    financingMentioned: { type: 'boolean' },
    financing: {
      type: 'object',
      properties: {
        bankCredit: { type: 'boolean' },
        infonavit: { type: 'boolean' },
        fovissste: { type: 'boolean' },
        cash: { type: 'boolean' },
        developer: { type: 'boolean' },
      },
      required: ['bankCredit', 'infonavit', 'fovissste', 'cash', 'developer'],
      additionalProperties: false,
    },
    presetAmenities: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 40,
    },
    customAmenities: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 40,
    },
    detectedFacts: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 30,
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 12,
    },
  },
  required: [
    'title',
    'shortDescription',
    'propertyType',
    'operation',
    'priceAmount',
    'currency',
    'bedrooms',
    'fullBathrooms',
    'halfBathrooms',
    'levels',
    'parkingSpaces',
    'surfaceTotal',
    'surfaceBuilt',
    'surfaceFront',
    'surfaceDepth',
    'developmentName',
    'city',
    'state',
    'country',
    'neighborhood',
    'addressHint',
    'legalDebtFreeMentioned',
    'legalDebtFree',
    'financingMentioned',
    'financing',
    'presetAmenities',
    'customAmenities',
    'detectedFacts',
    'warnings',
  ],
  additionalProperties: false,
} as const;

export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchNumber(source: string, expression: RegExp): number {
  const match = source.match(expression);
  if (!match?.[1]) return 0;
  return number(match[1].replace(/,/g, ''));
}

function sentenceCase(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, '');
  return clean ? `${clean.charAt(0).toLocaleUpperCase('es-MX')}${clean.slice(1)}` : '';
}

function deriveTitle(source: string, propertyType: ImportedPropertyType): string {
  const firstCandidate = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 8 && line.length <= 150);
  if (!firstCandidate) {
    return propertyType === 'Desconocido' ? 'Propiedad disponible' : `${propertyType} disponible`;
  }

  const clean = firstCandidate
    .replace(/^en\s+(venta|renta|alquiler)\s*[,:\-–—]?\s*/i, '')
    .replace(/^(hermosa|hermoso|bonita|bonito|excelente)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sentenceCase(clean).slice(0, 100);
}

function findPropertyType(source: string): ImportedPropertyType {
  const normalized = normalizeForMatch(source);
  if (/\blocal comercial\b/.test(normalized)) return 'Local Comercial';
  if (/\bcasa de playa\b/.test(normalized)) return 'Casa de Playa';
  if (/\bdepartamento\b|\bdepto\b/.test(normalized)) return 'Departamento';
  if (/\bpenthouse\b/.test(normalized)) return 'Penthouse';
  if (/\btownhouse\b/.test(normalized)) return 'Townhouse';
  if (/\bvilla\b/.test(normalized)) return 'Villa';
  if (/\bcabana\b/.test(normalized)) return 'Cabaña';
  if (/\bloft\b/.test(normalized)) return 'Loft';
  if (/\bterreno\b/.test(normalized) && !/\bcasa\b/.test(normalized)) return 'Terreno';
  if (/\bcasa\b/.test(normalized)) return 'Casa';
  return 'Desconocido';
}

function findOperation(source: string): ImportedPropertyOperation {
  const normalized = normalizeForMatch(source);
  if (/\bintercambio\b|\bswap\b|\bpermuta\b/.test(normalized)) return 'SWAP';
  if (/\brenta vacacional\b|\bpor noche\b/.test(normalized)) return 'SHORT_RENT';
  if (/\ben renta\b|\bse renta\b|\balquiler\b|\brenta mensual\b/.test(normalized)) return 'MONTHLY_RENT';
  if (/\ben venta\b|\bse vende\b|\bventa\b/.test(normalized)) return 'SALE';
  return 'UNKNOWN';
}

function findPrice(source: string): { amount: number; currency: PropertyListingImportResult['currency'] } {
  const explicitCurrency = /\b(usd|d[oó]lares?)\b/i.test(source)
    ? 'USD'
    : /\b(mxn|pesos?)\b/i.test(source)
      ? 'MXN'
      : 'UNKNOWN';
  const matches = [...source.matchAll(/\$\s*([\d][\d.,\s]{3,})/g)]
    .map((match) => number(match[1].replace(/[.,\s](?=\d{3}\b)/g, '').replace(/[^\d.]/g, '')))
    .filter((amount) => amount >= 10_000);
  const amount = matches[0] || 0;
  return {
    amount,
    currency: explicitCurrency === 'UNKNOWN' && amount > 0 ? 'MXN' : explicitCurrency,
  };
}

function pushUnique(target: string[], value: string): void {
  const key = normalizeForMatch(value);
  if (key && !target.some((item) => normalizeForMatch(item) === key)) target.push(value);
}

/**
 * Deterministic backup for the most common Mexican listing-ad patterns. It is
 * intentionally conservative: missing data remains 0/empty instead of being
 * guessed.
 */
export function parsePropertyListingLocally(sourceText: string): PropertyListingImportResult {
  const source = sourceText.replace(/\u00a0/g, ' ').trim();
  const normalized = normalizeForMatch(source);
  const propertyType = findPropertyType(source);
  const operation = findOperation(source);
  const price = findPrice(source);

  const bedrooms = matchNumber(source, /(\d+)\s*(?:rec[aá]maras?|habitaciones?)/i);
  let fullBathrooms = 0;
  let halfBathrooms = 0;
  const decimalBaths = source.match(/(\d+)[.,]5\s*ba[nñ]os?/i);
  if (decimalBaths) {
    fullBathrooms = Number(decimalBaths[1]);
    halfBathrooms = 1;
  } else {
    fullBathrooms = matchNumber(source, /(\d+)\s*ba[nñ]os?(?:\s+completos?)?/i);
    halfBathrooms = matchNumber(source, /(\d+)\s*medios?\s+ba[nñ]os?/i);
    if (!halfBathrooms && /\bmedio\s+ba[nñ]o\b/i.test(source)) halfBathrooms = 1;
  }

  const ordinalLevels = [
    /\bprimer(?:o)?\s+nivel\b/i,
    /\bsegundo\s+nivel\b/i,
    /\btercer(?:o)?\s+nivel\b/i,
    /\bcuarto\s+nivel\b/i,
  ].reduce((count, expression) => count + (expression.test(source) ? 1 : 0), 0);
  const levels = matchNumber(source, /(\d+)\s*(?:niveles?|plantas?)/i) || ordinalLevels;
  const parkingSpaces =
    matchNumber(source, /estacionamiento\s+para\s+(\d+)\s*(?:veh[ií]culos?|autos?|coches?)/i)
    || matchNumber(source, /cochera\s+para\s+(\d+)\s*(?:veh[ií]culos?|autos?|coches?)/i);
  const surfaceBuilt = matchNumber(source, /construcci[oó]n\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
  let surfaceTotal = matchNumber(source, /(?:terreno|superficie\s+total)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
  const lotDimensions = source.match(/terreno\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  const surfaceFront = lotDimensions ? number(lotDimensions[1].replace(',', '.')) : 0;
  const surfaceDepth = lotDimensions ? number(lotDimensions[2].replace(',', '.')) : 0;
  if (!surfaceTotal && surfaceFront && surfaceDepth) surfaceTotal = surfaceFront * surfaceDepth;

  const presetAmenities: string[] = [];
  const customAmenities: string[] = [];
  const presetMatchers: Array<[RegExp, string]> = [
    [/\bcocina integral\b/i, 'Cocina integral'],
    [/\bcocina equipada\b/i, 'Cocina equipada'],
    [/\bcocina con isla\b/i, 'Cocina con isla'],
    [/\bcuarto de lavado\b|\b[aá]rea de lavado\b/i, 'Cuarto de lavado'],
    [/\bvestidor(?:es)?\b/i, 'Vestidor'],
    [/\boficina\b/i, 'Oficina'],
    [/\bestudio\b/i, 'Estudio'],
    [/\bbodega\b/i, 'Bodega'],
    [/\bterraza\b/i, 'Terraza'],
    [/\bjard[ií]n\b/i, 'Jardín'],
    [/\bpatio\b/i, 'Patio'],
    [/\bbalc[oó]n\b/i, 'Balcón'],
    [/\balberca\b|\bpiscina\b/i, 'Alberca'],
    [/\bpaneles solares\b/i, 'Paneles solares'],
  ];
  presetMatchers.forEach(([expression, amenity]) => {
    if (expression.test(source)) pushUnique(presetAmenities, amenity);
  });

  const minisplits = matchNumber(source, /(\d+)\s*minisplits?/i);
  if (minisplits) pushUnique(customAmenities, `${minisplits} minisplits`);
  if (/\bpasillo lateral\b/i.test(source)) pushUnique(customAmenities, 'Pasillo lateral');
  if (/\bbardas? perim[eé]trales?\b/i.test(source)) pushUnique(customAmenities, 'Bardas perimetrales');
  if (/\bport[oó]n(?:\s+laminado)?\s+abatible\b/i.test(source)) {
    pushUnique(customAmenities, 'Portón laminado abatible');
  }
  if (/\bsala[\s-]+comedor\b/i.test(source)) pushUnique(customAmenities, 'Sala-comedor');
  if (/\bcl[oó]sets?\b/i.test(source)) pushUnique(customAmenities, 'Clósets');

  const legalDebtFreeMentioned = /\blibre\s+de\s+gravamen\b|\bsin\s+gravamen\b/i.test(source);
  const financing = {
    bankCredit: /\bcr[eé]dito bancario\b|\bacepta bancario\b/i.test(source),
    infonavit: /\binfonavit\b/i.test(source),
    fovissste: /\bfovissste\b/i.test(source),
    cash: /\bcontado\b|\befectivo\b/i.test(source),
    developer: /\bfinanciamiento (?:directo|del desarrollador)\b/i.test(source),
  };
  const financingMentioned = Object.values(financing).some(Boolean);

  const facts: string[] = [];
  if (bedrooms) facts.push(`${bedrooms} recámaras`);
  if (fullBathrooms) facts.push(`${fullBathrooms} baños completos`);
  if (halfBathrooms) facts.push(`${halfBathrooms} medio baño${halfBathrooms === 1 ? '' : 's'}`);
  if (levels) facts.push(`${levels} niveles`);
  if (parkingSpaces) facts.push(`Estacionamiento para ${parkingSpaces} vehículos`);
  if (surfaceTotal) facts.push(`${surfaceTotal} m² de terreno`);
  if (surfaceBuilt) facts.push(`${surfaceBuilt} m² de construcción`);

  const title = deriveTitle(source, propertyType);
  const descriptionParts = [
    `${propertyType === 'Desconocido' ? 'Propiedad' : propertyType} ${operation === 'SALE' ? 'en venta' : operation === 'MONTHLY_RENT' ? 'en renta' : 'disponible'}`,
    facts.length ? `con ${facts.join(', ')}` : '',
    [...presetAmenities, ...customAmenities].length
      ? `Cuenta con ${[...presetAmenities, ...customAmenities].slice(0, 8).join(', ')}`
      : '',
    legalDebtFreeMentioned ? 'Se anuncia libre de gravamen' : '',
  ].filter(Boolean);

  return {
    title,
    shortDescription: `${descriptionParts.join('. ')}.`.replace(/\.\./g, '.').slice(0, 1_200),
    propertyType,
    operation,
    priceAmount: price.amount,
    currency: price.currency,
    bedrooms,
    fullBathrooms,
    halfBathrooms,
    levels,
    parkingSpaces,
    surfaceTotal,
    surfaceBuilt,
    surfaceFront,
    surfaceDepth,
    developmentName: '',
    city: '',
    state: '',
    country: normalized.includes('mexico') ? 'México' : '',
    neighborhood: '',
    addressHint: '',
    legalDebtFreeMentioned,
    legalDebtFree: legalDebtFreeMentioned,
    financingMentioned,
    financing,
    presetAmenities,
    customAmenities,
    detectedFacts: facts,
    warnings: [],
  };
}
