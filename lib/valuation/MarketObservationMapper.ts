import type { Property, PropertyOffering } from '../types';
import type { ValuationCatalogProperty } from './ValuationEngine';

export interface MarketObservationRow {
  id: string;
  source_code: string;
  external_reference: string;
  observation_kind: 'ASKING_SALE' | 'ASKING_RENT';
  observation_date: string;
  property_type: 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OFFICE' | 'LOFT';
  title: string | null;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | string | null;
  longitude: number | string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  parking_spaces: number | string | null;
  construction_age: number | string | null;
  conservation_state: string | null;
  surface_total_m2: number | string | null;
  surface_built_m2: number | string | null;
  price_amount: number | string;
  currency: string;
  quality_score: number | string;
  published_at?: string | null;
  last_verified_at?: string | null;
  location_precision?: 'POINT' | 'NEIGHBORHOOD' | 'POSTAL_CODE' | 'CITY' | 'UNKNOWN' | null;
  syndication_fingerprint?: string | null;
  data_completeness?: number | string | null;
  usage_authorization?: 'AUTHORIZED' | 'RESEARCH_ONLY' | 'UNVERIFIED' | 'PROHIBITED' | null;
}

const finiteNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const PROPERTY_TYPES: Partial<Record<MarketObservationRow['property_type'], Property['type']>> = {
  HOUSE: 'Villa',
  APARTMENT: 'Apartment',
  LOFT: 'Loft',
};

export const mapMarketObservationToCatalogProperty = (
  row: MarketObservationRow,
): ValuationCatalogProperty | null => {
  const type = PROPERTY_TYPES[row.property_type];
  const price = finiteNumber(row.price_amount);
  const qualityScore = finiteNumber(row.quality_score);
  const surfaceBuilt = finiteNumber(row.surface_built_m2);
  const surfaceTotal = finiteNumber(row.surface_total_m2);
  if (!type || !price || !qualityScore || qualityScore < 55 || (!surfaceBuilt && !surfaceTotal)) {
    return null;
  }
  if ((row.currency || 'MXN').toUpperCase() !== 'MXN') return null;

  const operation: PropertyOffering['mode'] = row.observation_kind === 'ASKING_RENT'
    ? 'MONTHLY_RENT'
    : 'SALE';
  const propertyId = `market:${row.id}`;
  const offering: PropertyOffering = {
    id: `market-offering:${row.id}`,
    propertyId,
    mode: operation,
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    priceAmount: price,
    currency: 'MXN',
    billingPeriod: operation === 'MONTHLY_RENT' ? 'MONTH' : 'NONE',
    isPriceNegotiable: false,
    acceptsOffers: false,
    requiresApproval: true,
    allowInstantRequest: false,
    swapPreferences: {},
    isFeatured: false,
    featuredRank: 0,
    metadata: { askingPrice: true, sourceCode: row.source_code },
  };

  return {
    id: propertyId,
    hostId: 'private-market-observation',
    title: row.title || 'Comparable externo',
    description: '',
    type,
    valueRating: 'Curated',
    location: `${row.neighborhood}, ${row.city}`,
    country: 'México',
    latitude: finiteNumber(row.latitude),
    longitude: finiteNumber(row.longitude),
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    bedrooms: finiteNumber(row.bedrooms) || 0,
    bathrooms: finiteNumber(row.bathrooms) || 0,
    parkingSpaces: finiteNumber(row.parking_spaces),
    constructionAge: finiteNumber(row.construction_age),
    conservationStateId: row.conservation_state || undefined,
    surfaceTotal,
    surfaceBuilt,
    maxGuests: 0,
    auraScore: 0,
    amenities: [],
    rules: [],
    images: [],
    hostName: '',
    hostAvatar: '',
    hostVerified: false,
    hostRating: 0,
    hostReviewsCount: 0,
    availableStart: '',
    availableEnd: '',
    isPublished: true,
    isFeatured: false,
    isDemo: false,
    publishedAt: row.published_at || '',
    createdAt: row.published_at || row.last_verified_at || row.observation_date,
    updatedAt: row.last_verified_at || row.observation_date,
    offerings: [offering],
    valuationSource: {
      marketObservationId: row.id,
      externalReference: row.external_reference,
      sourceCode: row.source_code,
      qualityScore,
      syndicationKey: row.syndication_fingerprint || null,
      publishedAt: row.published_at || null,
      lastVerifiedAt: row.last_verified_at || null,
      locationPrecision: row.location_precision || 'UNKNOWN',
      dataCompleteness: finiteNumber(row.data_completeness),
      usageAuthorization: row.usage_authorization || 'UNVERIFIED',
    },
  } as ValuationCatalogProperty;
};
