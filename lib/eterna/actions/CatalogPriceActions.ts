import { PROPERTY_TYPE_MAPPING, normalizeSearchText } from '../../searchFilters';
import {
  getPropertyPriceSnapshot,
  type PropertyPriceOperation,
  type PropertyPriceSnapshot,
} from '../../search/propertyPrice';
import type { SearchSort } from '../../search/types';
import type { Property } from '../../types';

export type CatalogPriceIntent = 'lowest' | 'highest' | 'range' | 'sort_asc' | 'sort_desc';

export interface CatalogPriceRequest {
  intent: CatalogPriceIntent;
  sort?: Extract<SearchSort, 'price_asc' | 'price_desc'>;
  requestedCount: number;
}

export interface CatalogPriceAnswer {
  intent: CatalogPriceIntent | 'clarification' | 'unavailable';
  reply: string;
  speech: string;
  suggestedReplies: string[];
  orderedPropertyIds: string[];
  sort?: Extract<SearchSort, 'price_asc' | 'price_desc'>;
}

interface PricedProperty {
  property: Property;
  price: PropertyPriceSnapshot;
}

const normalize = (value: string): string => normalizeSearchText(value)
  .replace(/[¿?¡!,.;:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const ASCENDING_ORDER_PATTERN = /\b(?:ordena(?:las|los|r)?|acomoda(?:las|los|r)?|organiza(?:las|los|r)?|muestra(?:me|las|los)?|pon)\b[\s\S]*\b(?:menor a mayor|mas barata(?:s)? primero|mas barato(?:s)? primero|precio ascendente|precio mas bajo primero)\b|\b(?:de la|de lo|del) mas barat[ao][\s\S]*\b(?:a la|al) mas car[ao]\b/;
const DESCENDING_ORDER_PATTERN = /\b(?:ordena(?:las|los|r)?|acomoda(?:las|los|r)?|organiza(?:las|los|r)?|muestra(?:me|las|los)?|pon)\b[\s\S]*\b(?:mayor a menor|mas cara(?:s)? primero|mas caro(?:s)? primero|precio descendente|precio mas alto primero)\b|\b(?:de la|de lo|del) mas car[ao][\s\S]*\b(?:a la|al) mas barat[ao]\b/;
const RANGE_PATTERN = /\b(?:rango de precios?|precio minimo y maximo|precios? minimo y maximo|desde cuanto (?:hasta|a) cuanto|entre que precios?|price range|minimum and maximum price)\b/;
const LOWEST_PATTERN = /\b(?:la|el|las|los)?\s*(?:que (?:tiene|tenga) )?(?:con )?(?:el )?(?:menor precio|precio mas bajo|mas barata|mas barato|mas economica|mas economico|mas accesible|cheapest|lowest price|least expensive)\b/;
const HIGHEST_PATTERN = /\b(?:la|el|las|los)?\s*(?:que (?:tiene|tenga) )?(?:con )?(?:el )?(?:mayor precio|precio mas alto|mas cara|mas caro|mas costosa|mas costoso|most expensive|highest price)\b/;

const COUNT_WORDS: Record<string, number> = {
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
};

function requestedCount(prompt: string): number {
  const match = prompt.match(/\b(\d+|una?|dos|tres|cuatro|cinco)\s+(?:propiedades?|inmuebles?|casas?|departamentos?|opciones?)\b/);
  if (!match) return 1;
  const count = Number(match[1]) || COUNT_WORDS[match[1]] || 1;
  return Math.max(1, Math.min(5, Math.round(count)));
}

export function detectCatalogPriceRequest(prompt: string): CatalogPriceRequest | null {
  const clean = normalize(prompt);
  if (!clean) return null;

  if (RANGE_PATTERN.test(clean)) {
    return { intent: 'range', requestedCount: 1 };
  }
  if (ASCENDING_ORDER_PATTERN.test(clean)) {
    return { intent: 'sort_asc', sort: 'price_asc', requestedCount: 5 };
  }
  if (DESCENDING_ORDER_PATTERN.test(clean)) {
    return { intent: 'sort_desc', sort: 'price_desc', requestedCount: 5 };
  }
  if (LOWEST_PATTERN.test(clean)) {
    return { intent: 'lowest', sort: 'price_asc', requestedCount: requestedCount(clean) };
  }
  if (HIGHEST_PATTERN.test(clean)) {
    return { intent: 'highest', sort: 'price_desc', requestedCount: requestedCount(clean) };
  }
  return null;
}

function explicitOperation(prompt: string): PropertyPriceOperation | undefined {
  const clean = normalize(prompt);
  if (/\b(?:renta|rentar|alquiler|alquilar|arrendar|mensual|rent|rental)\b/.test(clean)) return 'rent';
  if (/\b(?:venta|comprar|compra|adquirir|sale|buy|purchase)\b/.test(clean)) return 'sale';
  return undefined;
}

function catalogLocationTokens(properties: Property[]): Set<string> {
  const tokens = new Set<string>();
  for (const property of properties) {
    const values = [
      property.city,
      property.neighborhood,
      property.subdivisionName,
      property.developmentName,
      property.location?.split(',')[0],
    ];
    for (const value of values) {
      const clean = normalize(value || '');
      if (clean.length >= 4) tokens.add(clean);
      const firstWord = clean.split(' ')[0];
      if (firstWord && firstWord.length >= 5) tokens.add(firstWord);
    }
  }
  return tokens;
}

function requestsDifferentLocation(
  prompt: string,
  currentProperties: Property[],
  catalogProperties?: Property[],
): boolean {
  if (!catalogProperties?.length) return false;
  const clean = normalize(prompt);
  const requestedTokens = [...catalogLocationTokens(catalogProperties)]
    .filter((token) => clean.includes(token));
  if (requestedTokens.length === 0) return false;

  const currentTokens = catalogLocationTokens(currentProperties);
  return requestedTokens.every((token) => !currentTokens.has(token));
}

function filterRequestedPropertyType(prompt: string, properties: Property[]): Property[] {
  const clean = normalize(prompt);
  const category = /\b(?:departamento|departamentos|depa|depas|depto|deptos|condominio|condo|apartment)\b/.test(clean)
    ? 'Departamentos'
    : /\b(?:casa|casas|residencia|residencias|villa|vivienda|house|houses)\b/.test(clean)
      ? 'Casas'
      : null;
  if (!category) return properties;

  const allowed = PROPERTY_TYPE_MAPPING[category] || [];
  return properties.filter((property) => allowed.includes(normalize(property.type || '')));
}

function formatMoney(amount: number, currency: string, language: 'es' | 'en'): string {
  const formatted = new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${currency} $${formatted}`;
}

function locationLabel(property: Property): string {
  return property.location || property.city || property.state || property.country || '';
}

function buildClarification(
  priced: PricedProperty[],
  language: 'es' | 'en',
): CatalogPriceAnswer | null {
  const bases = new Set(priced.map((entry) => entry.price.comparisonBasis));
  const currencies = new Set(priced.map((entry) => entry.price.currency));
  if (bases.size <= 1 && currencies.size <= 1) return null;

  const mixedBasis = bases.size > 1;
  const reply = language === 'es'
    ? mixedBasis
      ? 'Estos resultados mezclan precios de venta, renta mensual o estancia corta, y compararlos como si fueran equivalentes sería engañoso. ¿Quieres que compare únicamente propiedades en venta o únicamente rentas?'
      : 'Estos resultados tienen precios en monedas distintas, así que necesito conservar una sola moneda para compararlos correctamente. ¿Quieres que use pesos mexicanos o dólares?'
    : mixedBasis
      ? 'These results mix sale, monthly-rental, or short-stay prices, so treating them as equivalent would be misleading. Should I compare only properties for sale or only rentals?'
      : 'These results use different currencies, so I need one currency for a valid comparison. Should I use Mexican pesos or US dollars?';

  return {
    intent: 'clarification',
    reply,
    speech: reply,
    suggestedReplies: language === 'es'
      ? mixedBasis
        ? ['Solo las que están en venta', 'Solo las rentas', 'Cambiar ubicación']
        : ['Solo en pesos', 'Solo en dólares', 'Cambiar ubicación']
      : mixedBasis
        ? ['Only listings for sale', 'Only rentals', 'Change location']
        : ['Mexican pesos only', 'US dollars only', 'Change location'],
    orderedPropertyIds: [],
  };
}

export function resolveCatalogPriceRequest(params: {
  prompt: string;
  properties: Property[];
  catalogProperties?: Property[];
  operation?: PropertyPriceOperation;
  language: 'es' | 'en';
}): CatalogPriceAnswer | null {
  const request = detectCatalogPriceRequest(params.prompt);
  if (!request) return null;

  const requestedOperation = explicitOperation(params.prompt);
  if (
    requestedOperation
    && params.operation
    && requestedOperation !== params.operation
  ) {
    return null;
  }
  if (requestsDifferentLocation(params.prompt, params.properties, params.catalogProperties)) {
    return null;
  }

  const operation = requestedOperation || params.operation;
  const scopedProperties = filterRequestedPropertyType(params.prompt, params.properties);
  const priced = scopedProperties.flatMap((property): PricedProperty[] => {
    const price = getPropertyPriceSnapshot(property, operation);
    return price ? [{ property, price }] : [];
  });

  if (priced.length === 0) {
    const reply = params.language === 'es'
      ? 'Estos resultados no tienen un precio publicado y vigente que pueda comparar de forma responsable. ¿Quieres cambiar los filtros o revisar una propiedad específica?'
      : 'These results do not have a current published price that I can compare responsibly. Would you like to change the filters or review a specific property?';
    return {
      intent: 'unavailable',
      reply,
      speech: reply,
      suggestedReplies: params.language === 'es'
        ? ['Cambiar filtros', 'Ver una propiedad', 'Buscar en otra ciudad']
        : ['Change filters', 'View a property', 'Search another city'],
      orderedPropertyIds: [],
    };
  }

  const clarification = buildClarification(priced, params.language);
  if (clarification) return clarification;

  const direction = request.sort === 'price_desc' ? -1 : 1;
  const ordered = [...priced].sort((left, right) => (
    direction * (left.price.amount - right.price.amount)
    || left.property.title.localeCompare(right.property.title)
  ));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const orderedPropertyIds = ordered.map((entry) => entry.property.id);

  if (request.intent === 'range') {
    const reply = params.language === 'es'
      ? `En estos resultados, los precios publicados comparables van de ${formatMoney(first.price.amount, first.price.currency, params.language)} a ${formatMoney(last.price.amount, last.price.currency, params.language)} entre ${ordered.length} propiedades. ¿Quieres que las ordene de menor a mayor?`
      : `Across these results, comparable published prices range from ${formatMoney(first.price.amount, first.price.currency, params.language)} to ${formatMoney(last.price.amount, last.price.currency, params.language)} for ${ordered.length} properties. Would you like me to sort them from lowest to highest?`;
    return {
      intent: request.intent,
      reply,
      speech: reply,
      suggestedReplies: params.language === 'es'
        ? ['Ordenar de menor a mayor', 'Ver la más barata', 'Cambiar presupuesto']
        : ['Sort low to high', 'Show the cheapest', 'Change budget'],
      orderedPropertyIds: [],
    };
  }

  const selected = ordered.slice(0, Math.min(request.requestedCount, ordered.length));
  const isAscending = request.sort === 'price_asc';
  let reply: string;
  if (selected.length === 1) {
    const entry = selected[0];
    reply = params.language === 'es'
      ? `De estos resultados, la propiedad con ${isAscending ? 'el menor' : 'el mayor'} precio es “${entry.property.title}”, en ${locationLabel(entry.property)}, por ${formatMoney(entry.price.amount, entry.price.currency, params.language)}. La dejé al inicio para que puedas revisarla. ¿Quieres abrirla o compararla con la siguiente?`
      : `In these results, the property with the ${isAscending ? 'lowest' : 'highest'} price is “${entry.property.title}” in ${locationLabel(entry.property)}, listed at ${formatMoney(entry.price.amount, entry.price.currency, params.language)}. I placed it first so you can review it. Would you like to open it or compare it with the next one?`;
  } else {
    const summary = selected
      .map((entry) => `“${entry.property.title}” (${formatMoney(entry.price.amount, entry.price.currency, params.language)})`)
      .join(', ');
    reply = params.language === 'es'
      ? `Ordené ${ordered.length} propiedades por precio. Las ${selected.length} ${isAscending ? 'más económicas' : 'de mayor precio'} son ${summary}. ¿Cuál quieres revisar primero?`
      : `I sorted ${ordered.length} properties by price. The ${selected.length} ${isAscending ? 'lowest-priced' : 'highest-priced'} options are ${summary}. Which one would you like to review first?`;
  }

  return {
    intent: request.intent,
    reply,
    speech: reply,
    suggestedReplies: params.language === 'es'
      ? ['Abrir la primera', 'Comparar las dos primeras', 'Cambiar presupuesto']
      : ['Open the first', 'Compare the first two', 'Change budget'],
    orderedPropertyIds,
    sort: request.sort,
  };
}
