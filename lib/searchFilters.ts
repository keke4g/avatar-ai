import { Property, PropertyOfferingMode, SwapRequest } from './types';
import { ensurePropertyOfferings, getActiveOfferings, getOfferingsByMode } from './propertyOfferings';
import { getPropertyPriceSnapshot, type PropertyPriceOperation } from './search/propertyPrice';

export type PropertySortMode = 'match' | 'capacity' | 'rating' | string;
export type PropertyOfferingSearchMode = PropertyOfferingMode | 'ALL';

export const PROPERTY_TYPE_MAPPING: Record<string, string[]> = {
  Casas: ['casa', 'casa residencial', 'residencia', 'villa', 'beach house', 'cabin', 'house', 'cabana', 'cabaña'],
  Departamentos: ['departamento', 'condo', 'condominio', 'apartment', 'penthouse', 'dept'],
  Lofts: ['loft'],
  Terrenos: ['terreno', 'lote', 'land'],
  Locales: ['local comercial', 'local'],
  Oficinas: ['oficina', 'office']
};

export interface PropertySearchFilters {
  properties: Property[];
  swaps: SwapRequest[];
  offeringMode?: PropertyOfferingSearchMode;
  activeCategory?: string;
  searchQuery?: string;
  selectedSwapType?: string;
  sortBy?: PropertySortMode;
  startDate?: string;
  endDate?: string;
  guestsCount?: number;
  budget?: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizePropertyReference(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function findPropertyByReference(
  properties: Property[],
  query: string,
): Property | undefined {
  const compactQuery = normalizePropertyReference(query);
  const rawQuery = query.trim().toLowerCase();
  if (!compactQuery && !rawQuery) return undefined;

  return properties.find((property) => {
    if (rawQuery === property.id.toLowerCase() || rawQuery.includes(property.id.toLowerCase())) {
      return true;
    }

    const references = [property.internalCode, property.shortCode]
      .filter((value): value is string => Boolean(value))
      .map(normalizePropertyReference)
      .filter((value) => value.length >= 6);

    return references.some((reference) => (
      compactQuery === reference || compactQuery.includes(reference)
    ));
  });
}

const PROPERTY_REFERENCE_STOP_WORDS = new Set([
  'a', 'al', 'aqui', 'asi', 'con', 'cual', 'de', 'del', 'donde', 'el', 'en',
  'esa', 'ese', 'esas', 'esos', 'esta', 'este', 'estas', 'estos', 'la', 'las',
  'lo', 'los', 'me', 'mi', 'mis', 'para', 'por', 'que', 'se', 'si', 'su', 'sus',
  'te', 'un', 'una', 'y',
]);

const PROPERTY_SELECTION_SIGNAL = /\b(?:ese|esa|esos|esas|este|esta|estos|estas|primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta|me gusta(?:ria|ría|ndo)?|me esta gustando|me interesa|me quedo|quiero (?:ese|esa|el|la)|quiero ver|quiero conocer|ver ese|ver esa|elijo|escojo|selecciono|muestrame|mostrarme|ensename|abrir|abre|entrar|entra|ver detalles|conocer)\b/i;

const PROPERTY_TYPE_ALIASES: Record<string, string[]> = {
  departamento: ['apartment', 'departamento', 'departamentos', 'apartamento', 'apartamentos', 'condo', 'condominio', 'depa', 'depas', 'penthouse'],
  casa: ['beach house', 'cabin', 'casa', 'casas', 'house', 'residencia', 'villa'],
  loft: ['loft', 'lofts'],
  terreno: ['land', 'lote', 'terreno', 'terrenos'],
  local: ['local', 'locales', 'local comercial'],
  oficina: ['office', 'oficina', 'oficinas'],
};

const PROPERTY_ORDINALS: Record<string, number> = {
  primero: 0,
  primera: 0,
  segundo: 1,
  segunda: 1,
  tercero: 2,
  tercera: 2,
  cuarto: 3,
  cuarta: 3,
  quinto: 4,
  quinta: 4,
};

function tokenizePropertyReference(value: string): string[] {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !PROPERTY_REFERENCE_STOP_WORDS.has(token));
}

function propertyReferenceFields(property: Property): {
  title: string;
  location: string;
  type: string;
  all: string;
} {
  const title = normalizeSearchText(property.title || '');
  const location = normalizeSearchText([
    property.location,
    property.city,
    property.neighborhood,
    property.subdivisionName,
    property.developmentName,
  ].filter(Boolean).join(' '));
  const type = normalizeSearchText(property.type || '');
  return { title, location, type, all: `${title} ${location} ${type}`.trim() };
}

function hasPropertyTypeMatch(query: string, type: string): boolean {
  const normalizedType = normalizeSearchText(type);
  return Object.values(PROPERTY_TYPE_ALIASES).some((aliases) => {
    const queryHasAlias = aliases.some((alias) => query.includes(normalizeSearchText(alias)));
    const typeHasAlias = aliases.some((alias) => normalizedType.includes(normalizeSearchText(alias)));
    return queryHasAlias && typeHasAlias;
  });
}

function hasLocationPhraseMatch(query: string, location: string): boolean {
  const words = tokenizePropertyReference(location);
  if (words.length < 2) return false;

  // Match distinctive two/three-word location fragments, so “ese de Tres Ríos”
  // resolves “Desarrollo Urbano Tres Ríos” without requiring the full address.
  for (let size = Math.min(3, words.length); size >= 2; size -= 1) {
    for (let start = 0; start <= words.length - size; start += 1) {
      const phrase = words.slice(start, start + size).join(' ');
      if (phrase.length >= 5 && query.includes(phrase)) return true;
    }
  }
  return false;
}

/**
 * Resolves colloquial references to one of the properties currently in view.
 * This is intentionally separate from findPropertyByReference: search filters
 * must still return every listing for a city, while a conversational selection
 * should open one specific card such as “ese de Tres Ríos” or “la segunda”.
 */
export function findPropertyByNaturalReference(
  properties: Property[],
  query: string,
  candidateProperties: Property[] = properties,
): Property | undefined {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || !PROPERTY_SELECTION_SIGNAL.test(normalizedQuery)) return undefined;

  const uniqueCandidates = Array.from(
    new Map(candidateProperties.filter(Boolean).map((property) => [property.id, property])).values(),
  );
  if (uniqueCandidates.length === 0) return undefined;

  const ordinalMatch = normalizedQuery.match(/\b(?:opcion|opción|numero|número|el|la)?\s*(primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta)\b/i);
  if (ordinalMatch) {
    const ordinalIndex = PROPERTY_ORDINALS[normalizeSearchText(ordinalMatch[1])];
    if (ordinalIndex !== undefined && uniqueCandidates[ordinalIndex]) {
      return uniqueCandidates[ordinalIndex];
    }
  }

  const queryTokens = new Set(tokenizePropertyReference(normalizedQuery));
  const scored = uniqueCandidates.map((property, index) => {
    const fields = propertyReferenceFields(property);
    const titleTokens = new Set(tokenizePropertyReference(fields.title));
    const locationTokens = new Set(tokenizePropertyReference(fields.location));
    const matchingTitleTokens = [...queryTokens].filter((token) => titleTokens.has(token));
    const matchingLocationTokens = [...queryTokens].filter((token) => locationTokens.has(token));
    const typeMatch = hasPropertyTypeMatch(normalizedQuery, fields.type);
    const locationPhraseMatch = hasLocationPhraseMatch(normalizedQuery, fields.location);
    const exactTitleMatch = fields.title.length >= 6 && normalizedQuery.includes(fields.title);
    const exactLocationMatch = fields.location.length >= 6 && normalizedQuery.includes(fields.location);

    let score = matchingTitleTokens.length * 8 + matchingLocationTokens.length * 10;
    if (typeMatch) score += 12;
    if (locationPhraseMatch) score += 18;
    if (exactTitleMatch) score += 28;
    if (exactLocationMatch) score += 32;
    // A single card in the active Eterna result set is the natural referent of
    // “ese/esa/me gusta”, even if the user did not repeat its location.
    if (uniqueCandidates.length === 1) score += 22;

    return {
      property,
      score,
      index,
      hasMeaningfulMatch: matchingTitleTokens.length > 0
        || matchingLocationTokens.length > 0
        || typeMatch
        || locationPhraseMatch
        || exactTitleMatch
        || exactLocationMatch,
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  const best = scored[0];
  const runnerUp = scored[1];
  if (!best) return undefined;

  const isVagueSingleSelection = uniqueCandidates.length === 1;
  const isDistinctSelection = best.score >= 18
    && best.hasMeaningfulMatch
    && (!runnerUp || best.score - runnerUp.score >= 6);

  return isVagueSingleSelection || isDistinctSelection ? best.property : undefined;
}

export function resolveSearchDestination(destination: string, properties: Property[]): string {
  const cleanDestination = normalizeSearchText(destination);
  if (!cleanDestination) return '';

  if (findPropertyByReference(properties, destination)) {
    return destination.trim();
  }

  if (['playa', 'mar', 'beach', 'costa'].includes(cleanDestination)) {
    return 'playa';
  }

  const match = properties.find((property) => {
    const location = normalizeSearchText(property.location || '');
    const country = normalizeSearchText(property.country || '');
    const title = normalizeSearchText(property.title || '');
    return location.includes(cleanDestination) || country.includes(cleanDestination) || title.includes(cleanDestination);
  });

  return match ? match.location.split(',')[0].trim() : destination.trim();
}

export function buildExploreSearchParams({
  searchQuery,
  selectedDates,
  guestsCount,
}: {
  searchQuery?: string;
  selectedDates?: { start: string; end: string } | null;
  guestsCount?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  const destination = searchQuery?.trim();

  if (destination) {
    params.set('search', destination);
  }

  if (selectedDates?.start && selectedDates?.end) {
    params.set('start', selectedDates.start);
    params.set('end', selectedDates.end);
  }

  if (guestsCount && guestsCount > 0) {
    params.set('guests', String(guestsCount));
  }

  return params;
}

export function hasValidCoordinates(property: Pick<Property, 'latitude' | 'longitude'> & { country?: string }): boolean {
  const lat = property.latitude;
  const lng = property.longitude;
  if (lat === null || lng === null || lat === undefined || lng === undefined) return false;
  
  const latNum = Number(lat);
  const lngNum = Number(lng);
  
  const isValid = 
    Number.isFinite(latNum) && 
    Number.isFinite(lngNum) && 
    latNum >= -90 && 
    latNum <= 90 && 
    lngNum >= -180 && 
    lngNum <= 180;
    
  if (!isValid) return false;
  
  const countryLower = property.country?.toLowerCase() || '';
  const isDeclaredMexico = countryLower === 'méxico' || countryLower === 'mexico' || countryLower === 'mx';
  if (isDeclaredMexico) {
    const isMexicoCoords = latNum >= 14 && latNum <= 33 && lngNum >= -118 && lngNum <= -86;
    if (!isMexicoCoords) {
      console.warn(`[GeoAudit] Excluyendo propiedad de México con coordenadas fuera de rango: ${latNum}, ${lngNum}`, property);
      return false;
    }
  }
  
  return true;
}

export function filterAndSortProperties({
  properties,
  swaps,
  offeringMode = 'SWAP',
  activeCategory = 'All',
  searchQuery = '',
  selectedSwapType = 'All',
  sortBy = 'match',
  startDate = '',
  endDate = '',
  guestsCount = 0,
  budget,
  minBudget,
  budgetOfferingMode,
  amenityCategories,
  viewTypeId,
  constructionAgeMin,
  constructionAgeMax,
}: any): Property[] {
  const published = properties
    .map(ensurePropertyOfferings)
    .filter(p => p.isPublished !== false);

  const referenceMatch = findPropertyByReference(published, searchQuery);
  if (referenceMatch) {
    return [referenceMatch];
  }

  const filtered = published.filter((property) => {
    const activeOfferings = getActiveOfferings(property);
    const matchesOfferingMode = offeringMode === 'ALL'
      ? activeOfferings.length > 0
      : getOfferingsByMode(property, offeringMode, { activeOnly: true }).length > 0;

    if (!matchesOfferingMode) {
      return false;
    }

    const allowedTypes = PROPERTY_TYPE_MAPPING[activeCategory] || [activeCategory];
    const matchesCategory = activeCategory === 'All' || allowedTypes.includes(normalizeSearchText(property.type || ''));

    const cleanQuery = normalizeSearchText(searchQuery);
    const matchesSearch = !cleanQuery ||
      normalizeSearchText(property.title).includes(cleanQuery) ||
      normalizeSearchText(property.location).includes(cleanQuery) ||
      normalizeSearchText(property.country).includes(cleanQuery) ||
      normalizeSearchText(property.internalCode || '').includes(cleanQuery) ||
      normalizeSearchText(property.shortCode || '').includes(cleanQuery) ||
      property.id.toLowerCase() === searchQuery.trim().toLowerCase();

    const swapOffering = getOfferingsByMode(property, 'SWAP')[0];
    const swapValueTier = swapOffering?.swapValueTier || property.valueRating;
    const matchesSwapType = selectedSwapType === 'All' || swapValueTier === selectedSwapType;

    if (guestsCount > 0 && property.maxGuests < guestsCount) {
      return false;
    }

    // New filters check
    if (amenityCategories && amenityCategories.length > 0) {
      const propertyAmenities = property.amenities || [];
      const hasAllAmenities = amenityCategories.every((amenity: string) => 
        propertyAmenities.some((pa: string) => pa.toLowerCase() === amenity.toLowerCase())
      );
      if (!hasAllAmenities) {
        return false;
      }
    }

    if (viewTypeId) {
      const pView = property.viewTypeId || (property as any).viewType || '';
      if (pView.toLowerCase() !== viewTypeId.toLowerCase()) {
        return false;
      }
    }

    if (constructionAgeMin !== undefined && constructionAgeMin !== null) {
      const age = property.constructionAge || 0;
      if (age < constructionAgeMin) {
        return false;
      }
    }

    if (constructionAgeMax !== undefined && constructionAgeMax !== null) {
      const age = property.constructionAge || 0;
      if (age > constructionAgeMax) {
        return false;
      }
    }

    if (budget !== undefined && budget > 0) {
      const activeOfferings = getActiveOfferings(property);
      const priceMode = budgetOfferingMode || offeringMode;
      const selectedOffering = priceMode === 'SALE'
        ? activeOfferings.find(o => o.mode === 'SALE')
        : priceMode === 'RENT' || priceMode === 'MONTHLY_RENT' || priceMode === 'SHORT_RENT'
          ? activeOfferings.find(o => o.mode === 'MONTHLY_RENT')
            || activeOfferings.find(o => o.mode === 'SHORT_RENT')
            || activeOfferings.find(o => o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT')
          : activeOfferings.find(o => o.mode === 'SALE') || activeOfferings[0];
      const price = selectedOffering?.priceAmount ?? (property as any).price ?? 0;
      if (price > 0 && price > budget) {
        return false;
      }
    }

    if (minBudget !== undefined && minBudget > 0) {
      const activeOfferings = getActiveOfferings(property);
      const priceMode = budgetOfferingMode || offeringMode;
      const selectedOffering = priceMode === 'SALE'
        ? activeOfferings.find(o => o.mode === 'SALE')
        : priceMode === 'RENT' || priceMode === 'MONTHLY_RENT' || priceMode === 'SHORT_RENT'
          ? activeOfferings.find(o => o.mode === 'MONTHLY_RENT')
            || activeOfferings.find(o => o.mode === 'SHORT_RENT')
            || activeOfferings.find(o => o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT')
          : activeOfferings.find(o => o.mode === 'SALE') || activeOfferings[0];
      const price = selectedOffering?.priceAmount ?? (property as any).price ?? 0;
      if (price > 0 && price < minBudget) {
        return false;
      }
    }

    if (startDate && endDate) {
      const userStart = new Date(startDate);
      const userEnd = new Date(endDate);

      const hasConflict = swaps.some((s: any) => {
        const isActiveSwap = ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'COMPLETED_CONFIRMED'].includes(s.status?.toUpperCase());
        if (!isActiveSwap) return false;

        const isThisProperty = s.senderPropertyId === property.id || s.receiverPropertyId === property.id;
        if (!isThisProperty) return false;

        if (s.startDate && s.endDate) {
          const swapStart = new Date(s.startDate);
          const swapEnd = new Date(s.endDate);
          return userStart <= swapEnd && userEnd >= swapStart;
        }
        return false;
      });

      if (hasConflict) {
        return false;
      }
    }

    return matchesCategory && matchesSearch && matchesSwapType;
  });

  const priceMode = budgetOfferingMode || offeringMode;
  const priceOperation: PropertyPriceOperation | undefined = priceMode === 'SALE'
    ? 'sale'
    : priceMode === 'RENT' || priceMode === 'MONTHLY_RENT' || priceMode === 'SHORT_RENT'
      ? 'rent'
      : undefined;

  return [...filtered].sort((a, b) => {
    if (sortBy === 'match') {
      return b.auraScore - a.auraScore;
    }
    if (sortBy === 'capacity') {
      return b.maxGuests - a.maxGuests;
    }
    if (sortBy === 'rating') {
      return b.hostRating - a.hostRating;
    }
    if (sortBy === 'price_asc') {
      const left = getPropertyPriceSnapshot(a, priceOperation)?.amount ?? Number.POSITIVE_INFINITY;
      const right = getPropertyPriceSnapshot(b, priceOperation)?.amount ?? Number.POSITIVE_INFINITY;
      return left - right;
    }
    if (sortBy === 'price_desc') {
      const left = getPropertyPriceSnapshot(a, priceOperation)?.amount ?? Number.NEGATIVE_INFINITY;
      const right = getPropertyPriceSnapshot(b, priceOperation)?.amount ?? Number.NEGATIVE_INFINITY;
      return right - left;
    }
    return 0;
  });
}
