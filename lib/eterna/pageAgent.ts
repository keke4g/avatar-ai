import type { SearchConciergeResponse } from './searchConcierge';
import { stripEternaMarkup } from './textSanitization';

export type PageAgentIntent =
  | 'answer'
  | 'property_search'
  | 'property_advice'
  | 'navigate'
  | 'interact'
  | 'contact'
  | 'publish'
  | 'account'
  | 'general';

export type PageAgentActionType =
  | 'none'
  | 'navigate'
  | 'go_back'
  | 'scroll_to'
  | 'click_element'
  | 'search_properties'
  | 'open_property_contact'
  | 'open_property_location'
  | 'open_property_wizard';

export interface PageAgentAction {
  type: PageAgentActionType;
  route: string;
  target: string;
  channel: 'message' | 'call' | 'none';
  requiresConfirmation: boolean;
}

export interface PageAgentResponse {
  reply: string;
  intent: PageAgentIntent;
  action: PageAgentAction;
  search: SearchConciergeResponse;
  propertyStage: 'discovery' | 'qualification' | 'consideration' | 'ready_to_contact';
  contactIntent: boolean;
  preferredContact: 'message' | 'call' | 'none';
  leadSummary: string;
  suggestedReplies: string[];
  understoodGoal: string;
}

const INTENTS = new Set<PageAgentIntent>([
  'answer',
  'property_search',
  'property_advice',
  'navigate',
  'interact',
  'contact',
  'publish',
  'account',
  'general',
]);

const ACTIONS = new Set<PageAgentActionType>([
  'none',
  'navigate',
  'go_back',
  'scroll_to',
  'click_element',
  'search_properties',
  'open_property_contact',
  'open_property_location',
  'open_property_wizard',
]);

const OPERATIONS = new Set(['sale', 'rent', 'swap', 'unknown']);
const PURPOSES = new Set(['vivir', 'inversion', 'unknown']);
const PROPERTY_TYPES = new Set(['casa', 'departamento', 'unknown']);
const MISSING_FIELDS = new Set(['operation', 'city', 'budget', 'none']);
const PROPERTY_STAGES = new Set(['discovery', 'qualification', 'consideration', 'ready_to_contact']);
const CONTACT_CHANNELS = new Set(['message', 'call', 'none']);

const text = (value: unknown, max = 2_000): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const positiveNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

export function parsePageAgentResponse(value: unknown): PageAgentResponse | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const reply = stripEternaMarkup(text(candidate.reply));
  if (!reply) return null;

  const actionCandidate = candidate.action && typeof candidate.action === 'object'
    ? candidate.action as Record<string, unknown>
    : {};
  const searchCandidate = candidate.search && typeof candidate.search === 'object'
    ? candidate.search as Record<string, unknown>
    : {};

  const actionType = ACTIONS.has(actionCandidate.type as PageAgentActionType)
    ? actionCandidate.type as PageAgentActionType
    : 'none';
  const channel = CONTACT_CHANNELS.has(actionCandidate.channel as string)
    ? actionCandidate.channel as PageAgentAction['channel']
    : 'none';

  const searchIntent = searchCandidate.intent === 'property_search' ? 'property_search' : 'general';
  const search: SearchConciergeResponse = {
    reply,
    intent: searchIntent,
    operation: OPERATIONS.has(searchCandidate.operation as string)
      ? searchCandidate.operation as SearchConciergeResponse['operation']
      : 'unknown',
    purpose: PURPOSES.has(searchCandidate.purpose as string)
      ? searchCandidate.purpose as SearchConciergeResponse['purpose']
      : 'unknown',
    city: text(searchCandidate.city, 120),
    zone: text(searchCandidate.zone, 120),
    propertyType: PROPERTY_TYPES.has(searchCandidate.propertyType as string)
      ? searchCandidate.propertyType as SearchConciergeResponse['propertyType']
      : 'unknown',
    budgetText: text(searchCandidate.budgetText, 120),
    budgetMin: positiveNumber(searchCandidate.budgetMin),
    budgetMax: positiveNumber(searchCandidate.budgetMax),
    rooms: positiveNumber(searchCandidate.rooms),
    features: Array.isArray(searchCandidate.features)
      ? searchCandidate.features.map((item) => text(item, 80)).filter(Boolean).slice(0, 8)
      : [],
    missingField: MISSING_FIELDS.has(searchCandidate.missingField as string)
      ? searchCandidate.missingField as SearchConciergeResponse['missingField']
      : 'none',
    readyToSearch: searchCandidate.readyToSearch === true,
  };

  return {
    reply,
    intent: INTENTS.has(candidate.intent as PageAgentIntent)
      ? candidate.intent as PageAgentIntent
      : 'general',
    action: {
      type: actionType,
      route: text(actionCandidate.route, 300),
      target: text(actionCandidate.target, 180),
      channel,
      requiresConfirmation: actionCandidate.requiresConfirmation === true,
    },
    search,
    propertyStage: PROPERTY_STAGES.has(candidate.propertyStage as string)
      ? candidate.propertyStage as PageAgentResponse['propertyStage']
      : 'discovery',
    contactIntent: candidate.contactIntent === true,
    preferredContact: CONTACT_CHANNELS.has(candidate.preferredContact as string)
      ? candidate.preferredContact as PageAgentResponse['preferredContact']
      : 'none',
    leadSummary: text(candidate.leadSummary, 1_000),
    suggestedReplies: Array.isArray(candidate.suggestedReplies)
      ? candidate.suggestedReplies.map((item) => stripEternaMarkup(text(item, 140))).filter(Boolean).slice(0, 3)
      : [],
    understoodGoal: text(candidate.understoodGoal, 500),
  };
}

const searchSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['property_search', 'general'] },
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
    'intent', 'operation', 'purpose', 'city', 'zone', 'propertyType', 'budgetText',
    'budgetMin', 'budgetMax', 'rooms', 'features', 'missingField', 'readyToSearch',
  ],
  additionalProperties: false,
} as const;

export const PAGE_AGENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    intent: {
      type: 'string',
      enum: ['answer', 'property_search', 'property_advice', 'navigate', 'interact', 'contact', 'publish', 'account', 'general'],
    },
    action: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['none', 'navigate', 'go_back', 'scroll_to', 'click_element', 'search_properties', 'open_property_contact', 'open_property_location', 'open_property_wizard'],
        },
        route: { type: 'string' },
        target: { type: 'string' },
        channel: { type: 'string', enum: ['message', 'call', 'none'] },
        requiresConfirmation: { type: 'boolean' },
      },
      required: ['type', 'route', 'target', 'channel', 'requiresConfirmation'],
      additionalProperties: false,
    },
    search: searchSchema,
    propertyStage: {
      type: 'string',
      enum: ['discovery', 'qualification', 'consideration', 'ready_to_contact'],
    },
    contactIntent: { type: 'boolean' },
    preferredContact: { type: 'string', enum: ['message', 'call', 'none'] },
    leadSummary: { type: 'string' },
    suggestedReplies: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    understoodGoal: { type: 'string' },
  },
  required: [
    'reply', 'intent', 'action', 'search', 'propertyStage', 'contactIntent',
    'preferredContact', 'leadSummary', 'suggestedReplies', 'understoodGoal',
  ],
  additionalProperties: false,
} as const;
