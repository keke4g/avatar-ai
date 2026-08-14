import type { Property } from '../../lib/types';
import type { PropertySearchFilters } from '../../lib/search/types';
import { getPropertyPriceSnapshot, type PropertyPriceSnapshot } from '../../lib/search/propertyPrice';
import { formatPropertyLocation } from '../../lib/textHelpers';

export interface HomeMarketRadarEntry {
  property: Property;
  price: PropertyPriceSnapshot;
  tag: string;
  insight: string;
}

const getPublishedTimestamp = (property: Property): number => {
  const value = property.publishedAt || property.createdAt || property.updatedAt;
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getSaleReference = (property: Property): number | null => {
  const valuation = property.valuation;
  if (!valuation) return null;
  if (valuation.evidenceTier === 'STRICT_ESTIMATE' && valuation.estimatedSaleValue) {
    return valuation.estimatedSaleValue;
  }
  if (
    valuation.evidenceTier === 'AREA_REFERENCE'
    && valuation.areaReferenceOperation === 'SALE'
    && valuation.areaReferenceValue
  ) {
    return valuation.areaReferenceValue;
  }
  return null;
};

const isPublicInventoryProperty = (property: Property): boolean => (
  property.isPublished !== false
  && property.isDemo !== true
  && property.is_demo !== true
);

const listingLabel = (
  snapshot: PropertyPriceSnapshot,
  language: 'es' | 'en',
): string => {
  if (snapshot.mode === 'SALE') return language === 'es' ? 'En venta' : 'For sale';
  if (snapshot.mode === 'MONTHLY_RENT') return language === 'es' ? 'Renta mensual' : 'Monthly rent';
  return language === 'es' ? 'Renta temporal' : 'Short-term rent';
};

export const getHomePropertyTypeLabel = (
  property: Property,
  language: 'es' | 'en',
): string => {
  const labels: Record<Property['type'], { es: string; en: string }> = {
    Apartment: { es: 'Departamento', en: 'Apartment' },
    'Beach House': { es: 'Casa de playa', en: 'Beach house' },
    Cabin: { es: 'Cabaña', en: 'Cabin' },
    Penthouse: { es: 'Penthouse', en: 'Penthouse' },
    // Inventory historically stores ordinary houses as `Villa`. Public copy
    // must describe them as houses, consistently with property presentations.
    Villa: { es: 'Casa', en: 'House' },
    Loft: { es: 'Loft', en: 'Loft' },
  };
  return labels[property.type]?.[language] || (language === 'es' ? 'Propiedad' : 'Property');
};

export const formatHomePrice = (
  snapshot: PropertyPriceSnapshot,
  language: 'es' | 'en',
  compact = false,
): string => {
  const formatted = new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: snapshot.currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(snapshot.amount);
  const suffix = snapshot.mode === 'MONTHLY_RENT'
    ? (language === 'es' ? ' / mes' : ' / month')
    : snapshot.mode === 'SHORT_RENT'
      ? (language === 'es' ? ' / noche' : ' / night')
      : '';
  return `${formatted}${suffix}`;
};

export const getHomePropertyCaption = (
  property: Property,
  snapshot: PropertyPriceSnapshot,
  language: 'es' | 'en',
): string => {
  const location = formatPropertyLocation(property.location, property.country)
    .split(',')
    .slice(0, 2)
    .join(', ');
  return `${location} · ${getHomePropertyTypeLabel(property, language)} ${listingLabel(snapshot, language).toLocaleLowerCase(language === 'es' ? 'es-MX' : 'en-US')}`;
};

export const buildHomeMarketRadar = (
  properties: Property[],
  language: 'es' | 'en',
): HomeMarketRadarEntry[] => {
  const priced = properties
    .filter(isPublicInventoryProperty)
    .flatMap((property) => {
      const price = getPropertyPriceSnapshot(property);
      return price ? [{ property, price }] : [];
    });

  if (priced.length === 0) return [];

  const saleMxn = priced
    .filter(({ price }) => price.mode === 'SALE' && price.currency === 'MXN')
    .sort((left, right) => left.price.amount - right.price.amount);
  const selected: HomeMarketRadarEntry[] = [];

  const pushUnique = (entry: HomeMarketRadarEntry | null) => {
    if (!entry || selected.some((candidate) => candidate.property.id === entry.property.id)) return;
    selected.push(entry);
  };

  const accessible = saleMxn[0] || priced[0];
  pushUnique({
    ...accessible,
    tag: language === 'es' ? 'Más accesible' : 'Most accessible',
    insight: language === 'es'
      ? 'La entrada de precio más baja disponible en el inventario actual.'
      : 'The lowest available entry price in the current inventory.',
  });

  const opportunity = saleMxn
    .flatMap(({ property, price }) => {
      const reference = getSaleReference(property);
      if (!reference || price.amount >= reference) return [];
      return [{ property, price, discountPct: ((reference - price.amount) / reference) * 100 }];
    })
    .sort((left, right) => right.discountPct - left.discountPct)[0];

  if (opportunity) {
    pushUnique({
      property: opportunity.property,
      price: opportunity.price,
      tag: language === 'es' ? 'Bajo referencia' : 'Below reference',
      insight: language === 'es'
        ? `${opportunity.discountPct.toFixed(1)}% debajo de su referencia comercial automatizada.`
        : `${opportunity.discountPct.toFixed(1)}% below its automated commercial reference.`,
    });
  }

  const newest = [...priced]
    .sort((left, right) => getPublishedTimestamp(right.property) - getPublishedTimestamp(left.property))
    .find(({ property }) => !selected.some((candidate) => candidate.property.id === property.id));
  if (newest) {
    pushUnique({
      ...newest,
      tag: language === 'es' ? 'Recién publicada' : 'Recently listed',
      insight: language === 'es'
        ? 'Una de las incorporaciones más recientes del catálogo público.'
        : 'One of the latest additions to the public catalog.',
    });
  }

  const fallbackCandidates = [
    ...priced.filter(({ property }) => property.isFeatured),
    ...saleMxn,
    ...priced,
  ];
  fallbackCandidates.forEach((candidate) => {
    if (selected.length >= 3) return;
    pushUnique({
      ...candidate,
      tag: language === 'es' ? 'Para comparar' : 'Worth comparing',
      insight: language === 'es'
        ? 'Una alternativa útil para ampliar tu comparación de mercado.'
        : 'A useful alternative for a broader market comparison.',
    });
  });

  return selected.slice(0, 3);
};

export const buildHomeExploreUrl = (filters?: PropertySearchFilters): string => {
  if (!filters) return '/explore';
  const params = new URLSearchParams();
  if (filters.city) params.set('search', filters.city);
  if (filters.operation) params.set('offering', filters.operation === 'sale' ? 'SALE' : 'MONTHLY_RENT');
  if (filters.budget !== undefined) params.set('budget', String(filters.budget));
  if (filters.minBudget !== undefined) params.set('minBudget', String(filters.minBudget));
  if (filters.rooms !== undefined) params.set('rooms', String(filters.rooms));
  if (filters.type) params.set('category', filters.type.toLocaleLowerCase('es-MX'));
  if (filters.amenityCategories?.[0]) params.set('amenity', filters.amenityCategories[0]);
  if (filters.viewTypeId) params.set('view', filters.viewTypeId);
  if (filters.sort === 'price_asc' || filters.sort === 'price_desc') params.set('sort', filters.sort);
  const query = params.toString();
  return query ? `/explore?${query}` : '/explore';
};
