export type PropertyConversationStage =
  | 'discovery'
  | 'qualification'
  | 'consideration'
  | 'ready_to_contact';

export type PropertyContactChannel = 'message' | 'call' | 'none';

export interface PropertySalesResponse {
  reply: string;
  stage: PropertyConversationStage;
  contactIntent: boolean;
  preferredContact: PropertyContactChannel;
  leadSummary: string;
  suggestedQuestions: string[];
}

export interface EternaChatMessage {
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  showAuthButtons?: boolean;
  showPublishButton?: boolean;
  propertySales?: PropertySalesResponse;
}

const STAGES = new Set<PropertyConversationStage>([
  'discovery',
  'qualification',
  'consideration',
  'ready_to_contact',
]);

const CHANNELS = new Set<PropertyContactChannel>(['message', 'call', 'none']);

export function parsePropertySalesResponse(value: unknown): PropertySalesResponse | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.reply !== 'string' || candidate.reply.trim().length === 0) return null;

  const stage = STAGES.has(candidate.stage as PropertyConversationStage)
    ? candidate.stage as PropertyConversationStage
    : 'discovery';
  const preferredContact = CHANNELS.has(candidate.preferredContact as PropertyContactChannel)
    ? candidate.preferredContact as PropertyContactChannel
    : 'none';
  const suggestedQuestions = Array.isArray(candidate.suggestedQuestions)
    ? candidate.suggestedQuestions
        .filter((question): question is string => typeof question === 'string' && question.trim().length > 0)
        .map((question) => question.trim().slice(0, 140))
        .slice(0, 3)
    : [];

  return {
    reply: candidate.reply.trim().slice(0, 2_000),
    stage,
    contactIntent: candidate.contactIntent === true,
    preferredContact,
    leadSummary: typeof candidate.leadSummary === 'string'
      ? candidate.leadSummary.trim().slice(0, 1_000)
      : '',
    suggestedQuestions,
  };
}

export const PROPERTY_SALES_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'Respuesta directa, veraz y comercial para el usuario.',
    },
    stage: {
      type: 'string',
      enum: ['discovery', 'qualification', 'consideration', 'ready_to_contact'],
      description: 'Etapa actual del usuario en la conversación comercial.',
    },
    contactIntent: {
      type: 'boolean',
      description: 'Verdadero cuando el usuario muestra intención de hablar con el responsable, visitar, negociar o avanzar.',
    },
    preferredContact: {
      type: 'string',
      enum: ['message', 'call', 'none'],
      description: 'Canal de contacto preferido inferido de la conversación.',
    },
    leadSummary: {
      type: 'string',
      description: 'Mensaje breve en primera persona listo para enviar al responsable comercial.',
    },
    suggestedQuestions: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: { type: 'string' },
      description: 'Preguntas breves y relevantes que el usuario podría hacer a continuación.',
    },
  },
  required: [
    'reply',
    'stage',
    'contactIntent',
    'preferredContact',
    'leadSummary',
    'suggestedQuestions',
  ],
  additionalProperties: false,
} as const;
