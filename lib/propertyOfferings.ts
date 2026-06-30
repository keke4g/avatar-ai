import { Property, PropertyOffering, PropertyOfferingMode, PropertyOfferingStatus } from './types';

const ACTIVE_STATUSES = new Set<PropertyOfferingStatus>(['ACTIVE']);

/**
 * Generates the default legacy SWAP offering configuration.
 */
export function buildDefaultSwapOffering(property: Property): PropertyOffering {
  return {
    id: `legacy-swap-${property.id}`,
    propertyId: property.id,
    mode: 'SWAP',
    status: property.isPublished === false ? 'PAUSED' : 'ACTIVE',
    visibility: 'PUBLIC',
    title: property.title,
    description: property.description,
    priceAmount: null,
    currency: 'USD',
    billingPeriod: 'NONE',
    securityDepositAmount: null,
    cleaningFeeAmount: null,
    serviceFeePercent: null,
    commissionPercent: null,
    minNights: null,
    maxNights: null,
    minMonths: null,
    maxMonths: null,
    isPriceNegotiable: false,
    acceptsOffers: true,
    requiresApproval: true,
    allowInstantRequest: false,
    swapPreferences: {},
    swapValueTier: property.valueRating,
    auraScoreOverride: property.auraScore,
    availableFrom: property.availableStart || null,
    availableUntil: property.availableEnd || null,
    isFeatured: property.isFeatured ?? false,
    featuredUntil: property.featuredUntil ?? null,
    featuredRank: property.featuredRank ?? 0,
    metadata: {
      source: 'legacy_property_fields',
    },
  };
}

/**
 * Creates default offerings from list of selected modes.
 */
export function createOfferingsFromProperty(property: Property, modes: PropertyOfferingMode[]): PropertyOffering[] {
  const offerings = modes.map(mode => {
    if (mode === 'SWAP') {
      return buildDefaultSwapOffering(property);
    }
    return {
      id: `offering-${mode}-${property.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      propertyId: property.id,
      mode,
      status: (property.isPublished === false ? 'PAUSED' : 'ACTIVE') as PropertyOfferingStatus,
      visibility: 'PUBLIC' as const,
      title: property.title,
      description: property.description,
      priceAmount: mode === 'SALE' ? 500000 : 150,
      currency: 'USD',
      billingPeriod: mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT'),
      securityDepositAmount: null,
      cleaningFeeAmount: null,
      serviceFeePercent: null,
      commissionPercent: null,
      minNights: mode === 'SHORT_RENT' ? 2 : null,
      maxNights: null,
      minMonths: mode === 'MONTHLY_RENT' ? 1 : null,
      maxMonths: null,
      isPriceNegotiable: true,
      acceptsOffers: true,
      requiresApproval: true,
      allowInstantRequest: false,
      swapPreferences: {},
      swapValueTier: null,
      auraScoreOverride: null,
      availableFrom: property.availableStart || null,
      availableUntil: property.availableEnd || null,
      isFeatured: false,
      featuredUntil: null,
      featuredRank: 0,
      metadata: {},
    } as PropertyOffering;
  });

  return normalizeOfferings(offerings, property);
}

/**
 * Normalizes an array of offerings: guarantees ID, propertyId, status, currency, etc.
 * Critical: Prevents duplicate modes by keeping only the latest configuration of each mode.
 */
export function normalizeOfferings(offerings: PropertyOffering[], property: Property): PropertyOffering[] {
  if (!offerings || offerings.length === 0) {
    return [buildDefaultSwapOffering(property)];
  }

  const uniqueOfferingsMap: Record<PropertyOfferingMode, PropertyOffering> = {} as any;

  for (const offering of offerings) {
    const mode = offering.mode;
    if (!mode) continue;

    uniqueOfferingsMap[mode] = {
      ...offering,
      id: offering.id || `offering-${mode}-${property.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      propertyId: property.id,
      status: offering.status || (property.isPublished === false ? 'PAUSED' : 'ACTIVE'),
      visibility: offering.visibility || 'PUBLIC',
      currency: offering.currency || 'USD',
      billingPeriod: offering.billingPeriod || (mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT')),
      swapValueTier: mode === 'SWAP' ? (offering.swapValueTier || property.valueRating) : null,
      auraScoreOverride: mode === 'SWAP' ? (offering.auraScoreOverride || property.auraScore) : null,
      availableFrom: offering.availableFrom || property.availableStart || null,
      availableUntil: offering.availableUntil || property.availableEnd || null,
      isPriceNegotiable: offering.isPriceNegotiable ?? (mode === 'SWAP' ? false : true),
      acceptsOffers: offering.acceptsOffers ?? true,
      requiresApproval: offering.requiresApproval ?? true,
      allowInstantRequest: offering.allowInstantRequest ?? false,
      isFeatured: offering.isFeatured ?? false,
      featuredRank: offering.featuredRank ?? 0,
      metadata: offering.metadata || {},
    };
  }

  return Object.values(uniqueOfferingsMap);
}

/**
 * Merges current database offerings with new offerings payload.
 * Preserves the UUID `id` fields of current offerings if the mode continues to exist.
 * Discards any modes not present in target `newOfferings`.
 */
export function syncPropertyOfferings(currentOfferings: PropertyOffering[], newOfferings: PropertyOffering[]): PropertyOffering[] {
  const currentMap: Record<PropertyOfferingMode, PropertyOffering> = {} as any;
  for (const o of currentOfferings) {
    currentMap[o.mode] = o;
  }

  const uniqueTargetOfferingsMap: Record<PropertyOfferingMode, PropertyOffering> = {} as any;

  for (const o of newOfferings) {
    const existing = currentMap[o.mode];
    uniqueTargetOfferingsMap[o.mode] = {
      ...o,
      id: existing?.id || o.id || `offering-${o.mode}-${o.propertyId || 'prop'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }

  return Object.values(uniqueTargetOfferingsMap);
}

export function ensurePropertyOfferings(property: Property): Property {
  return {
    ...property,
    offerings: normalizeOfferings(property.offerings || [], property),
  };
}

export function getOfferingByMode(property: Property, mode: PropertyOfferingMode): PropertyOffering | null {
  return getOfferingsByMode(property, mode)[0] || null;
}

export function getOfferingsByMode(
  property: Property,
  mode: PropertyOfferingMode,
  options: { activeOnly?: boolean } = {}
): PropertyOffering[] {
  const hydrated = ensurePropertyOfferings(property);
  return (hydrated.offerings || []).filter((offering) => {
    if (offering.mode !== mode) return false;
    if (options.activeOnly && !ACTIVE_STATUSES.has(offering.status)) return false;
    return true;
  });
}

export function hasOfferingMode(property: Property, mode: PropertyOfferingMode): boolean {
  return Boolean(getOfferingByMode(property, mode));
}

export function getActiveOfferings(property: Property): PropertyOffering[] {
  const hydrated = ensurePropertyOfferings(property);
  return (hydrated.offerings || []).filter((offering) => ACTIVE_STATUSES.has(offering.status));
}

export function getPrimaryOffering(property: Property): PropertyOffering {
  const hydrated = ensurePropertyOfferings(property);
  const activeSwap = hydrated.offerings?.find((offering) => offering.mode === 'SWAP' && offering.status === 'ACTIVE');
  return activeSwap || hydrated.offerings?.[0] || buildDefaultSwapOffering(property);
}
