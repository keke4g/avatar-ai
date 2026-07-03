import { Property, PropertyOfferingMode, SwapRequest } from './types';
import { ensurePropertyOfferings, getActiveOfferings, getOfferingsByMode } from './propertyOfferings';

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

export function resolveSearchDestination(destination: string, properties: Property[]): string {
  const cleanDestination = normalizeSearchText(destination);
  if (!cleanDestination) return '';

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
  amenityCategories,
  viewTypeId,
  constructionAgeMin,
  constructionAgeMax,
}: any): Property[] {
  const published = properties
    .map(ensurePropertyOfferings)
    .filter(p => p.isPublished !== false);

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
      normalizeSearchText(property.country).includes(cleanQuery);

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
      const saleOffering = activeOfferings.find(o => o.mode === 'SALE');
      const rentOffering = activeOfferings.find(o => o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT');
      const price = saleOffering?.priceAmount ?? rentOffering?.priceAmount ?? (property as any).price ?? 0;
      if (price > 0 && price > budget) {
        return false;
      }
    }

    if (minBudget !== undefined && minBudget > 0) {
      const activeOfferings = getActiveOfferings(property);
      const saleOffering = activeOfferings.find(o => o.mode === 'SALE');
      const rentOffering = activeOfferings.find(o => o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT');
      const price = saleOffering?.priceAmount ?? rentOffering?.priceAmount ?? (property as any).price ?? 0;
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
    return 0;
  });
}
