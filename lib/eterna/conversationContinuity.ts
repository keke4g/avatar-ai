export type ConversationContinuationContext = 'general' | 'property' | 'search';

const QUESTIONS: Record<'es' | 'en', Record<ConversationContinuationContext, string[]>> = {
  es: {
    general: [
      '¿Qué te gustaría hacer a continuación?',
      '¿En qué más te gustaría que avancemos?',
      '¿Qué quieres revisar ahora?',
    ],
    property: [
      '¿Qué aspecto de la propiedad te gustaría revisar ahora?',
      '¿Quieres que revisemos la ubicación, el precio o las amenidades?',
      '¿Prefieres que veamos el entorno o las condiciones comerciales?',
    ],
    search: [
      '¿Quieres que afinemos algún criterio de la búsqueda?',
      '¿Te gustaría ajustar la zona, el tipo o el presupuesto?',
      '¿Quieres que revisemos alguna de estas opciones?',
    ],
  },
  en: {
    general: [
      'What would you like to do next?',
      'What else would you like us to work on?',
      'What would you like to review now?',
    ],
    property: [
      'Which aspect of the property would you like to review now?',
      'Would you like to review the location, price, or amenities?',
      'Would you prefer to see the neighborhood or the commercial terms?',
    ],
    search: [
      'Would you like to refine any search criteria?',
      'Would you like to adjust the area, property type, or budget?',
      'Would you like to review one of these options?',
    ],
  },
};

const hash = (value: string): number => Array.from(value).reduce(
  (total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0,
  0,
);

/** Keeps Eterna conversational without duplicating a question already asked. */
export function ensureConversationContinues(
  reply: string,
  language: 'es' | 'en',
  context: ConversationContinuationContext = 'general',
): string {
  const clean = reply.trim();
  if (!clean || /[?？](?:["”']?\s*)$/.test(clean)) return clean;

  const options = QUESTIONS[language][context];
  const question = options[Math.abs(hash(clean)) % options.length];
  return `${clean} ${question}`;
}

export function getConversationSuggestions(
  language: 'es' | 'en',
  context: ConversationContinuationContext,
): string[] {
  if (language === 'en') {
    if (context === 'property') return ['Show me the location', 'Review the price', 'See amenities'];
    if (context === 'search') return ['Adjust the budget', 'Change the area', 'View a property'];
    return ['Search properties', 'Publish a property'];
  }
  if (context === 'property') return ['Muéstrame la ubicación', 'Revisar el precio', 'Ver amenidades'];
  if (context === 'search') return ['Ajustar presupuesto', 'Cambiar zona', 'Ver una propiedad'];
  return ['Buscar propiedades', 'Publicar una propiedad'];
}
