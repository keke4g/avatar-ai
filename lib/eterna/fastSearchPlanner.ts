import { parseBudgetRange } from '../search/SearchEngine';
import type { ConversationMemory } from './ConversationEngine';
import { isPropertyPublishingTrigger } from './IntentRouter';

export interface CatalogLocationHint {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  location?: string | null;
}

export interface FastSearchPlan {
  matched: boolean;
  ready: boolean;
  missing: 'operation' | 'city' | null;
  memory: ConversationMemory;
  reply: string;
  suggestedReplies: string[];
}

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const titleCase = (value: string): string => value
  .trim()
  .split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');

function extractOperation(prompt: string): 'sale' | 'rent' | 'swap' | null {
  const clean = normalize(prompt);
  if (/\b(intercambio|intercambiar|swap|trueque|permuta)\b/.test(clean)) return 'swap';
  if (/\b(rentar|renta|alquilar|alquiler|arrendar|arriendo)\b/.test(clean)) return 'rent';
  if (/\b(comprar|compra|adquirir|adquisicion|venta|vender|en venta)\b/.test(clean)) return 'sale';
  return null;
}

function extractPropertyType(prompt: string): 'departamento' | 'casa' | null {
  const clean = normalize(prompt);
  if (/\b(departamento|departamentos|depa|depas|depto|deptos|apartamento|condominio|condo)\b/.test(clean)) {
    return 'departamento';
  }
  // Voice transcription can turn “casas” into “casos”; accept that common
  // homophone when the rest of the utterance is clearly a property search.
  if (/\b(casa|casas|casos|residencia|residencias|villa|vivienda|hogar)\b/.test(clean)) {
    return 'casa';
  }
  return null;
}

function extractCity(prompt: string, hints: CatalogLocationHint[]): string | null {
  const clean = normalize(prompt);
  const aliases: Array<[RegExp, string]> = [
    [/\b(?:gdl|guadalajara)\b/, 'Guadalajara'],
    [/\b(?:cdmx|ciudad de mexico)\b/, 'Ciudad de México'],
    [/\bmazatlan\b/, 'Mazatlán'],
    [/\bculiacan\b/, 'Culiacán'],
    [/\bcancun\b/, 'Cancún'],
    [/\bmerida\b/, 'Mérida'],
    [/\bqueretaro\b/, 'Querétaro'],
    [/\bmonterrey\b/, 'Monterrey'],
    [/\bzapopan\b/, 'Zapopan'],
    [/\bchihuahua\b/, 'Chihuahua'],
    [/\bpuebla\b/, 'Puebla'],
    [/\btulum\b/, 'Tulum'],
  ];
  for (const [pattern, city] of aliases) {
    if (pattern.test(clean)) return city;
  }

  const candidates = new Set<string>();
  for (const hint of hints) {
    for (const value of [hint.city, hint.location]) {
      if (!value) continue;
      const primary = value.split(',')[0]?.trim();
      if (primary && primary.length >= 3) candidates.add(primary);
      if (hint.city && hint.city.length >= 3) candidates.add(hint.city.trim());
    }
  }
  const matchedCandidate = [...candidates]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => clean.includes(normalize(candidate)));
  if (matchedCandidate) return matchedCandidate;

  const locationMatch = prompt.match(
    /\b(?:en|por|cerca de)\s+([a-záéíóúüñ][a-záéíóúüñ\s.-]{1,45}?)(?=\s+(?:para|con|sin|hasta|maximo|máximo|entre|que|y)\b|[,;.!?]|$)/i,
  );
  const inferred = locationMatch?.[1]?.trim();
  if (!inferred || /^(venta|renta|intercambio|una zona|algun lugar)$/i.test(inferred)) return null;
  return titleCase(inferred);
}

function hasOpenBudgetStatement(prompt: string): boolean {
  const clean = normalize(prompt);
  return /\b(sin (?:un )?(?:presupuesto|limite de precio)|no tengo (?:un )?presupuesto|presupuesto abierto|cualquier presupuesto|aun no (?:se|lo se)|todavia no (?:se|lo se)|no quiero (?:dar|definir|poner)(?: un)? presupuesto)\b/.test(clean);
}

function hasBudgetValue(prompt: string): boolean {
  const clean = normalize(prompt);
  const hasBudgetLanguage = /\b(presupuesto|hasta|maximo|maxima|menos de|debajo de|por debajo de|menor de|inferior a|menos que|entre|desde)\b/.test(clean)
    && /\d|\b(?:un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cincuenta|cien)\b/.test(clean);
  const hasMoneyExpression = /(?:\$\s*\d|\b\d[\d.,\s]*\s*(?:millones?|mil|mxn|pesos?|usd|dolares?|m)\b|\b(?:un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cincuenta|cien)\s+(?:millones?|mil)\b)/.test(clean);
  return hasBudgetLanguage || hasMoneyExpression;
}

function operationLabel(operation: 'sale' | 'rent' | 'swap'): string {
  if (operation === 'sale') return 'para comprar';
  if (operation === 'rent') return 'para rentar';
  return 'para intercambio';
}

function propertyLabel(propertyType?: string): string {
  if (propertyType === 'departamento') return 'departamentos';
  if (propertyType === 'casa') return 'casas';
  return 'propiedades';
}

export function planFastPropertySearch(params: {
  prompt: string;
  currentMemory: ConversationMemory;
  catalogLocations: CatalogLocationHint[];
}): FastSearchPlan {
  const { prompt, currentMemory, catalogLocations } = params;
  const clean = normalize(prompt);
  if (isPropertyPublishingTrigger(prompt)) {
    return {
      matched: false,
      ready: false,
      missing: null,
      memory: { ...currentMemory },
      reply: '',
      suggestedReplies: [],
    };
  }
  const activeSearch = Boolean(
    currentMemory.operation || currentMemory.city || currentMemory.propertyType || currentMemory.budgetOpen,
  );
  const hasSearchVerb = /\b(busco|buscar|encuentra|encontrar|muestrame|mostrarme|quiero ver|necesito)\b/.test(clean);
  const mentionsProperty = /\b(propiedad|inmueble|departamento|depa|casa|casas|casos|residencia|loft|terreno|local|oficina)\b/.test(clean);
  const isAccountOrPublishingCommand = /\b(mis propiedades|mi propiedad|publicar|subir|anunciar|editar|administrar|gestionar|panel|dashboard)\b/.test(clean);
  const operation = extractOperation(prompt);
  const detectedCity = extractCity(prompt, catalogLocations);
  const matched = !isAccountOrPublishingCommand
    && (
      activeSearch
      || (hasSearchVerb && mentionsProperty)
      || Boolean(operation && (mentionsProperty || detectedCity))
    );
  const memory: ConversationMemory = { ...currentMemory };

  if (!matched) {
    return { matched: false, ready: false, missing: null, memory, reply: '', suggestedReplies: [] };
  }

  if (operation) memory.operation = { value: operation, confidence: 1 };
  const propertyType = extractPropertyType(prompt);
  if (propertyType) memory.propertyType = { value: propertyType, confidence: 1 };
  const city = detectedCity;
  if (city) memory.city = { value: city, confidence: 1 };

  if (hasOpenBudgetStatement(prompt)) {
    delete memory.budget;
    memory.budgetOpen = { value: true, confidence: 1 };
  } else if (hasBudgetValue(prompt)) {
    const range = parseBudgetRange(prompt);
    const value = range.min && range.max
      ? `entre ${range.min} y ${range.max}`
      : range.min
      ? `desde ${range.min}`
      : range.max
      ? `hasta ${range.max}`
      : '';
    if (value) {
      memory.budget = { value, confidence: 1 };
      memory.budgetOpen = { value: false, confidence: 1 };
    }
  }

  const rooms = clean.match(/\b(\d+)\s*(?:recamaras|recámaras|habitaciones|dormitorios|cuartos)\b/);
  if (rooms) memory.rooms = { value: Number(rooms[1]), confidence: 1 };
  if (/\b(alberca|piscina|pool)\b/.test(clean)) memory.pool = { value: true, confidence: 1 };
  if (/\b(jardin|jardín)\b/.test(clean)) memory.garden = { value: true, confidence: 1 };
  if (/\b(vista al mar|frente al mar|ocean view)\b/.test(clean)) memory.oceanView = { value: true, confidence: 1 };

  if (!memory.city) {
    const operationText = memory.operation ? ` ${operationLabel(memory.operation.value)}` : '';
    return {
      matched: true,
      ready: false,
      missing: 'city',
      memory,
      reply: `Entendido${operationText}. ¿En qué ciudad o zona quieres ver opciones?`,
      suggestedReplies: [],
    };
  }

  if (!memory.operation) {
    return {
      matched: true,
      ready: false,
      missing: 'operation',
      memory,
      reply: `Ya tengo ${propertyLabel(memory.propertyType?.value)} en ${memory.city.value}. ¿Quieres ver opciones para comprar, rentar o intercambiar?`,
      suggestedReplies: ['Quiero comprar', 'Busco rentar', 'Me interesa un intercambio'],
    };
  }

  const budgetNote = memory.budgetOpen?.value
    ? ' Sin limitar por precio; podrás afinarlo después si lo deseas.'
    : '';
  return {
    matched: true,
    ready: true,
    missing: null,
    memory,
    reply: `Voy a mostrarte ${propertyLabel(memory.propertyType?.value)} en ${memory.city.value} ${operationLabel(memory.operation.value)}.${budgetNote}`,
    suggestedReplies: [],
  };
}
