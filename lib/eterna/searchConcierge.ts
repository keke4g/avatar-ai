import { ConversationMemory } from './ConversationEngine';

export type SearchConciergeIntent =
  | 'property_search'
  | 'general'
  | 'navigation'
  | 'sell_property'
  | 'property_valuation';

export type SearchOperation = 'sale' | 'rent' | 'swap' | 'unknown';

export interface SearchConciergeResponse {
  reply: string;
  intent: SearchConciergeIntent;
  operation: SearchOperation;
  purpose: 'vivir' | 'inversion' | 'unknown';
  city: string;
  zone: string;
  propertyType: 'casa' | 'departamento' | 'unknown';
  budgetText: string;
  budgetMin: number;
  budgetMax: number;
  rooms: number;
  features: string[];
  missingField: 'operation' | 'city' | 'budget' | 'none';
  readyToSearch: boolean;
}

const INTENTS = new Set<SearchConciergeIntent>([
  'property_search',
  'general',
  'navigation',
  'sell_property',
  'property_valuation',
]);

const OPERATIONS = new Set<SearchOperation>(['sale', 'rent', 'swap', 'unknown']);
const PURPOSES = new Set<SearchConciergeResponse['purpose']>(['vivir', 'inversion', 'unknown']);
const PROPERTY_TYPES = new Set<SearchConciergeResponse['propertyType']>(['casa', 'departamento', 'unknown']);
const MISSING_FIELDS = new Set<SearchConciergeResponse['missingField']>(['operation', 'city', 'budget', 'none']);

const cleanText = (value: unknown, maxLength = 300): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const cleanPositiveNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

export function parseSearchConciergeResponse(value: unknown): SearchConciergeResponse | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const reply = cleanText(candidate.reply, 2_000);
  if (!reply) return null;

  const intent = INTENTS.has(candidate.intent as SearchConciergeIntent)
    ? candidate.intent as SearchConciergeIntent
    : 'general';
  const operation = OPERATIONS.has(candidate.operation as SearchOperation)
    ? candidate.operation as SearchOperation
    : 'unknown';
  const purpose = PURPOSES.has(candidate.purpose as SearchConciergeResponse['purpose'])
    ? candidate.purpose as SearchConciergeResponse['purpose']
    : 'unknown';
  const propertyType = PROPERTY_TYPES.has(candidate.propertyType as SearchConciergeResponse['propertyType'])
    ? candidate.propertyType as SearchConciergeResponse['propertyType']
    : 'unknown';
  const missingField = MISSING_FIELDS.has(candidate.missingField as SearchConciergeResponse['missingField'])
    ? candidate.missingField as SearchConciergeResponse['missingField']
    : 'none';

  return {
    reply,
    intent,
    operation,
    purpose,
    city: cleanText(candidate.city, 120),
    zone: cleanText(candidate.zone, 120),
    propertyType,
    budgetText: cleanText(candidate.budgetText, 120),
    budgetMin: cleanPositiveNumber(candidate.budgetMin),
    budgetMax: cleanPositiveNumber(candidate.budgetMax),
    rooms: cleanPositiveNumber(candidate.rooms),
    features: Array.isArray(candidate.features)
      ? candidate.features
          .map((feature) => cleanText(feature, 80))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    missingField,
    readyToSearch: candidate.readyToSearch === true,
  };
}

export function mergeSearchAnalysisIntoMemory(
  currentMemory: ConversationMemory,
  analysis: SearchConciergeResponse,
): ConversationMemory {
  const memory: ConversationMemory = { ...currentMemory };

  if (analysis.operation !== 'unknown') {
    memory.operation = { value: analysis.operation, confidence: 1 };
  }
  if (analysis.purpose !== 'unknown') {
    memory.purpose = { value: analysis.purpose, confidence: 1 };
  }
  if (analysis.city) {
    memory.city = { value: analysis.city, confidence: 1 };
  }
  if (analysis.zone) {
    memory.zone = { value: analysis.zone, confidence: 1 };
  }
  if (analysis.propertyType !== 'unknown') {
    memory.propertyType = { value: analysis.propertyType, confidence: 1 };
  }

  if (analysis.budgetMax > 0) {
    const budgetValue = analysis.budgetMin > 0 && analysis.budgetMin < analysis.budgetMax
      ? `entre ${analysis.budgetMin} y ${analysis.budgetMax}`
      : String(analysis.budgetMax);
    memory.budget = { value: budgetValue, confidence: 1 };
  } else if (analysis.budgetText) {
    memory.budget = { value: analysis.budgetText, confidence: 0.98 };
  }

  if (analysis.rooms > 0) {
    memory.rooms = { value: analysis.rooms, confidence: 1 };
  }

  const normalizedFeatures = analysis.features.map((feature) => feature.toLocaleLowerCase());
  if (normalizedFeatures.some((feature) => /alberca|piscina|pool/.test(feature))) {
    memory.pool = { value: true, confidence: 1 };
  }
  if (normalizedFeatures.some((feature) => /jard[ií]n|garden/.test(feature))) {
    memory.garden = { value: true, confidence: 1 };
  }
  if (normalizedFeatures.some((feature) => /mar|ocean/.test(feature))) {
    memory.oceanView = { value: true, confidence: 1 };
  }
  if (analysis.features.length > 0) {
    memory.preferences = { value: analysis.features.join(', '), confidence: 1 };
  }

  return memory;
}

export const SEARCH_CONCIERGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    intent: {
      type: 'string',
      enum: ['property_search', 'general', 'navigation', 'sell_property', 'property_valuation'],
    },
    operation: { type: 'string', enum: ['sale', 'rent', 'swap', 'unknown'] },
    purpose: { type: 'string', enum: ['vivir', 'inversion', 'unknown'] },
    city: { type: 'string' },
    zone: { type: 'string' },
    propertyType: { type: 'string', enum: ['casa', 'departamento', 'unknown'] },
    budgetText: { type: 'string' },
    budgetMin: { type: 'number' },
    budgetMax: { type: 'number' },
    rooms: { type: 'number' },
    features: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    missingField: { type: 'string', enum: ['operation', 'city', 'budget', 'none'] },
    readyToSearch: { type: 'boolean' },
  },
  required: [
    'reply',
    'intent',
    'operation',
    'purpose',
    'city',
    'zone',
    'propertyType',
    'budgetText',
    'budgetMin',
    'budgetMax',
    'rooms',
    'features',
    'missingField',
    'readyToSearch',
  ],
  additionalProperties: false,
} as const;
