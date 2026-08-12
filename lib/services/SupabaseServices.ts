import { supabase } from '../supabaseClient';
import { Property, PropertyOffering, PropertyMedia, PropertyValuation } from '../types';
import { ensurePropertyOfferings, normalizeOfferings, syncPropertyOfferings } from '../propertyOfferings';
import { IPropertyService } from './types';
import { PropertyMapper } from './PropertyMapper';
import { PropertyValidator } from './PropertyValidator';
import { searchProperties } from '../search/SearchEngine';
import { PropertySearchFilters, SearchResult, ProviderCapabilities } from '../search/types';
import { searchCache } from '../search/SearchCache';
import { measureExecution } from '../search/measureExecution';
import { searchLogger } from '../search/searchLogger';

import { SupabasePropertyMediaService } from './SupabasePropertyMediaService';

type PublicPropertyRow = Record<string, unknown> & { id?: string };

const PUBLIC_INVENTORY_SNAPSHOT_TTL_MS = 5_000;
let publicInventoryRequest: Promise<PublicPropertyRow[]> | null = null;
let publicInventorySnapshot: { rows: PublicPropertyRow[]; expiresAt: number } | null = null;

const mapPublicValuationRow = (row: any): PropertyValuation => ({
  id: row.id,
  propertyId: row.property_id,
  currency: row.currency || 'MXN',
  estimatedSaleValue: row.estimated_sale_value == null ? null : Number(row.estimated_sale_value),
  saleRangeLow: row.sale_range_low == null ? null : Number(row.sale_range_low),
  saleRangeHigh: row.sale_range_high == null ? null : Number(row.sale_range_high),
  salePricePerM2: row.sale_price_per_m2 == null ? null : Number(row.sale_price_per_m2),
  estimatedMonthlyRent: row.estimated_monthly_rent == null ? null : Number(row.estimated_monthly_rent),
  rentRangeLow: row.rent_range_low == null ? null : Number(row.rent_range_low),
  rentRangeHigh: row.rent_range_high == null ? null : Number(row.rent_range_high),
  rentPricePerM2: row.rent_price_per_m2 == null ? null : Number(row.rent_price_per_m2),
  estimatedCapRate: row.estimated_cap_rate == null ? null : Number(row.estimated_cap_rate),
  grossRentalYield: row.gross_rental_yield == null ? null : Number(row.gross_rental_yield),
  listingPrice: row.listing_price == null ? null : Number(row.listing_price),
  listingVsEstimatePct: row.listing_vs_estimate_pct == null ? null : Number(row.listing_vs_estimate_pct),
  areaReferenceValue: row.area_reference_value == null ? null : Number(row.area_reference_value),
  areaRangeLow: row.area_range_low == null ? null : Number(row.area_range_low),
  areaRangeHigh: row.area_range_high == null ? null : Number(row.area_range_high),
  areaPricePerM2: row.area_price_per_m2 == null ? null : Number(row.area_price_per_m2),
  areaReferenceOperation: row.area_reference_operation || null,
  areaLocationBasis: row.area_location_basis || null,
  confidence: row.confidence || 'INSUFFICIENT',
  evidenceTier: row.evidence_tier || 'INSUFFICIENT',
  confidenceScore: Number(row.confidence_score || 0),
  comparableCount: Number(row.comparable_count || 0),
  saleComparableCount: Number(row.sale_comparable_count || 0),
  rentComparableCount: Number(row.rent_comparable_count || 0),
  dataAsOf: row.data_as_of,
  modelVersion: row.model_version,
  methodology: row.methodology,
  sourceLabels: Array.isArray(row.source_labels) ? row.source_labels : [],
  warnings: Array.isArray(row.warnings) ? row.warnings : [],
  comparables: Array.isArray(row.comparables) ? row.comparables : [],
});

const loadSanitizedPublicPropertyRows = async (propertyId?: string): Promise<PublicPropertyRow[]> => {
  let propertyQuery = supabase
    .from('public_properties_view')
    .select('*');

  if (propertyId) {
    propertyQuery = propertyQuery.eq('id', propertyId);
  }

  const { data: propertyRows, error: propertyError } = await propertyQuery;
  if (propertyError || !propertyRows?.length) {
    if (propertyError) {
      console.error('[SupabasePropertyService] Sanitized property query failed:', propertyError.message);
    }
    return [];
  }

  const propertyIds = propertyRows.map((row) => row.id);
  const hostIds = Array.from(new Set(propertyRows.map((row) => row.host_id).filter(Boolean)));

  const [mediaResult, offeringsResult, profilesResult, publisherContactsResult, valuationsResult] = await Promise.all([
    supabase
      .from('public_property_media_view')
      .select('*')
      .in('property_id', propertyIds),
    supabase
      .from('public_property_offerings_view')
      .select('*')
      .in('property_id', propertyIds),
    hostIds.length > 0
      ? supabase
          .from('public_profiles_view')
          .select('id,name,avatar_url,is_verified')
          .in('id', hostIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('public_property_publisher_contacts_view')
      .select('property_id,user_id,representative_type,full_name,organization_name,phone,whatsapp,contact_email,completed_at')
      .in('property_id', propertyIds),
    supabase
      .from('public_property_valuations_view')
      .select('*')
      .in('property_id', propertyIds),
  ]);

  if (mediaResult.error) {
    console.warn('[SupabasePropertyService] Public media view unavailable:', mediaResult.error.message);
  }
  if (offeringsResult.error) {
    console.warn('[SupabasePropertyService] Public offerings view unavailable:', offeringsResult.error.message);
  }
  if (publisherContactsResult.error) {
    console.warn('[SupabasePropertyService] Public publisher contacts view unavailable:', publisherContactsResult.error.message);
  }
  if (valuationsResult.error && valuationsResult.error.code !== 'PGRST205') {
    console.warn('[SupabasePropertyService] Public valuation view unavailable:', valuationsResult.error.message);
  }

  const mediaByProperty = new Map<string, any[]>();
  (mediaResult.data || []).forEach((row) => {
    const current = mediaByProperty.get(row.property_id) || [];
    current.push(row);
    mediaByProperty.set(row.property_id, current);
  });

  const offeringsByProperty = new Map<string, any[]>();
  (offeringsResult.data || []).forEach((row) => {
    const current = offeringsByProperty.get(row.property_id) || [];
    current.push({
      ...row,
      property_offering_availability: [],
      property_offering_pricing_rules: [],
    });
    offeringsByProperty.set(row.property_id, current);
  });

  const profilesById = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile]),
  );
  const publisherContactsByProperty = new Map(
    (publisherContactsResult.data || []).map((contact) => [contact.property_id, contact]),
  );
  const valuationsByProperty = new Map(
    (valuationsResult.data || []).map((valuation) => [
      valuation.property_id,
      mapPublicValuationRow(valuation),
    ]),
  );

  return propertyRows.map((row) => ({
    ...row,
    property_media: mediaByProperty.get(row.id) || [],
    property_offerings: offeringsByProperty.get(row.id) || [],
    profiles: profilesById.get(row.host_id) || null,
    publisher_contact: publisherContactsByProperty.get(row.id) || null,
    valuation: valuationsByProperty.get(row.id) || null,
  }));
};

const fetchSanitizedPublicPropertyRows = async (propertyId?: string): Promise<PublicPropertyRow[]> => {
  if (propertyId) return loadSanitizedPublicPropertyRows(propertyId);

  const now = Date.now();
  if (publicInventorySnapshot && publicInventorySnapshot.expiresAt > now) {
    return publicInventorySnapshot.rows;
  }
  if (publicInventoryRequest) return publicInventoryRequest;

  publicInventoryRequest = loadSanitizedPublicPropertyRows()
    .then((rows) => {
      // Do not retain transient upstream failures, which are represented as an
      // empty array by the public loader. Concurrent callers are still deduped.
      if (rows.length > 0) {
        publicInventorySnapshot = {
          rows,
          expiresAt: Date.now() + PUBLIC_INVENTORY_SNAPSHOT_TTL_MS,
        };
      }
      return rows;
    })
    .finally(() => {
      publicInventoryRequest = null;
    });

  return publicInventoryRequest;
};

const clearPropertyReadCaches = () => {
  publicInventorySnapshot = null;
  searchCache.clear();
};

const fetchAccessiblePropertyRows = async ({
  propertyId,
  hostId,
  includeAll,
}: {
  propertyId?: string;
  hostId?: string;
  includeAll?: boolean;
}): Promise<PublicPropertyRow[]> => {
  let propertyQuery = supabase.from('properties').select('*');
  if (propertyId) propertyQuery = propertyQuery.eq('id', propertyId);
  if (!includeAll && hostId) propertyQuery = propertyQuery.eq('host_id', hostId);

  const { data: propertyRows, error: propertyError } = await propertyQuery;
  if (propertyError || !propertyRows?.length) {
    if (propertyError) {
      console.warn('[SupabasePropertyService] Accessible inventory query unavailable:', propertyError.message);
    }
    return [];
  }

  const propertyIds = propertyRows.map((row) => row.id);
  const hostIds = Array.from(new Set(propertyRows.map((row) => row.host_id).filter(Boolean)));
  const [mediaResult, offeringsResult, profilesResult, publisherProfilesResult] = await Promise.all([
    supabase.from('property_media').select('*').in('property_id', propertyIds),
    supabase.from('property_offerings').select('*').in('property_id', propertyIds),
    hostIds.length > 0
      ? supabase.from('public_profiles_view').select('id,name,avatar_url,is_verified').in('id', hostIds)
      : Promise.resolve({ data: [], error: null }),
    hostIds.length > 0
      ? supabase
          .from('publisher_profiles')
          .select('user_id,representative_type,full_name,organization_name,phone,whatsapp,contact_email,completed_at')
          .in('user_id', hostIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mediaResult.error) {
    console.warn('[SupabasePropertyService] Accessible media query unavailable:', mediaResult.error.message);
  }
  if (offeringsResult.error) {
    console.warn('[SupabasePropertyService] Accessible offerings query unavailable:', offeringsResult.error.message);
  }

  const mediaByProperty = new Map<string, any[]>();
  (mediaResult.data || []).forEach((row) => {
    const current = mediaByProperty.get(row.property_id) || [];
    current.push(row);
    mediaByProperty.set(row.property_id, current);
  });

  const offeringsByProperty = new Map<string, any[]>();
  (offeringsResult.data || []).forEach((row) => {
    const current = offeringsByProperty.get(row.property_id) || [];
    current.push({
      ...row,
      property_offering_availability: [],
      property_offering_pricing_rules: [],
    });
    offeringsByProperty.set(row.property_id, current);
  });

  const profilesById = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile]),
  );
  const publisherProfilesById = new Map(
    (publisherProfilesResult.data || []).map((profile) => [profile.user_id, profile]),
  );

  return propertyRows.map((row) => ({
    ...row,
    property_media: mediaByProperty.get(row.id) || [],
    property_offerings: offeringsByProperty.get(row.id) || [],
    profiles: profilesById.get(row.host_id) || null,
    publisher_contact: publisherProfilesById.get(row.host_id) || null,
  }));
};


const isMissingOfferingsRelationError = (error: any): boolean => {
  return error?.code === 'PGRST200' || error?.code === '42P01';
};

const mapPostgresOffering = (row: any): PropertyOffering => ({
  id: row.id,
  propertyId: row.property_id,
  commercialCode: row.commercial_code,
  mode: row.mode,
  status: row.status,
  visibility: row.visibility,
  title: row.title,
  description: row.description,
  priceAmount: row.price_amount == null ? null : Number(row.price_amount),
  currency: row.currency || 'USD',
  billingPeriod: row.billing_period || 'NONE',
  
  // Financial specifics
  acceptsBankCredit: row.accepts_bank_credit,
  acceptsInfonavit: row.accepts_infonavit,
  acceptsFovissste: row.accepts_fovissste,
  acceptsCash: row.accepts_cash,
  developerFinancing: row.developer_financing,

  // Rental specifics
  depositAmount: row.deposit_amount == null ? null : Number(row.deposit_amount),
  advanceMonths: row.advance_months,
  requiresGuarantor: row.requires_guarantor,
  requiresLegalPolicy: row.requires_legal_policy,

  // Swap specifics
  swapEstimatedValue: row.swap_estimated_value == null ? null : Number(row.swap_estimated_value),
  desiredExchange: row.desired_exchange,
  swapMinValue: row.swap_min_value == null ? null : Number(row.swap_min_value),
  swapMaxValue: row.swap_max_value == null ? null : Number(row.swap_max_value),
  swapCashDifferenceAllowed: row.swap_cash_difference_allowed,

  // Maintenance and average costs
  annualPropertyTax: row.annual_property_tax == null ? 0 : Number(row.annual_property_tax),
  waterMonthlyAvg: row.water_monthly_avg == null ? 0 : Number(row.water_monthly_avg),
  electricityMonthlyAvg: row.electricity_monthly_avg == null ? 0 : Number(row.electricity_monthly_avg),
  gasMonthlyAvg: row.gas_monthly_avg == null ? 0 : Number(row.gas_monthly_avg),

  // Broker details
  commissionTotalPct: row.commission_total_pct == null ? null : Number(row.commission_total_pct),
  commissionSharedPct: row.commission_shared_pct == null ? null : Number(row.commission_shared_pct),
  agentResponsibleId: row.agent_responsible_id,
  estimatedDeliveryDate: row.estimated_delivery_date,

  // Legacy compatibility fields
  securityDepositAmount: row.security_deposit_amount == null ? null : Number(row.security_deposit_amount),
  cleaningFeeAmount: row.cleaning_fee_amount == null ? null : Number(row.cleaning_fee_amount),
  serviceFeePercent: row.service_fee_percent == null ? null : Number(row.service_fee_percent),
  commissionPercent: row.commission_percent == null ? null : Number(row.commission_percent),
  minNights: row.min_nights ?? null,
  maxNights: row.max_nights ?? null,
  minMonths: row.min_months ?? null,
  maxMonths: row.max_months ?? null,
  isPriceNegotiable: row.is_price_negotiable ?? false,
  acceptsOffers: row.accepts_offers ?? true,
  requiresApproval: row.requires_approval ?? true,
  allowInstantRequest: row.allow_instant_request ?? false,
  swapPreferences: row.swap_preferences || {},
  swapValueTier: row.swap_value_tier || null,
  auraScoreOverride: row.aura_score_override == null ? null : Number(row.aura_score_override),
  availableFrom: row.available_from || null,
  availableUntil: row.available_until || null,
  isFeatured: row.is_featured ?? false,
  featuredUntil: row.featured_until || null,
  featuredRank: row.featured_rank || 0,
  metadata: row.metadata || {},
  availability: (row.property_offering_availability || []).map((availability: any) => ({
    id: availability.id,
    offeringId: availability.offering_id,
    startDate: availability.start_date,
    endDate: availability.end_date,
    isAvailable: availability.is_available,
    note: availability.note || null,
    createdAt: availability.created_at,
  })),
  pricingRules: (row.property_offering_pricing_rules || []).map((rule: any) => ({
    id: rule.id,
    offeringId: rule.offering_id,
    startDate: rule.start_date || null,
    endDate: rule.end_date || null,
    priceAmount: Number(rule.price_amount),
    currency: rule.currency || 'USD',
    ruleType: rule.rule_type || 'SEASONAL',
    metadata: rule.metadata || {},
    createdAt: rule.created_at,
  })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to map normalized postgres records to UI expected Property type
const mapPostgresProperty = (row: any): Property => {
  return ensurePropertyOfferings(PropertyMapper.mapPostgresToClient(row));
};

export class SupabasePropertyService implements IPropertyService {
  async search(filters: PropertySearchFilters): Promise<SearchResult> {
    searchLogger.debug('[SupabasePropertyService] search() called with filters:', filters);
    
    const cachedResult = searchCache.get(filters);
    if (cachedResult) {
      searchLogger.debug('[SupabasePropertyService] Returning cached SearchResult');
      return cachedResult;
    }

    const { result: searchResult, executionTime } = await measureExecution(async () => {
      // The public views are the only source used for discovery. Asking PostgREST
      // to traverse from the view into private tables causes a 42501 for signed-in
      // members and made the Explorer appear empty even though public inventory
      // existed.
      const data = await fetchSanitizedPublicPropertyRows();
      const candidates = data.map(mapPostgresProperty);
      const results = searchProperties(candidates, filters);
      return { results, total: results.length, filters, provider: 'supabase', executionTime: 0 };
    });

    searchResult.executionTime = executionTime;
    searchCache.set(filters, searchResult);
    return searchResult;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealtime: true,
      supportsGeo: true,
      supportsFuzzy: false,
      supportsRecommendations: true
    };
  }

  async getFeatured(): Promise<Property[]> {
    const all = await this.getAll();
    return all.filter(p => p.offerings?.some(o => o.isFeatured) || (p as any).isFeatured);
  }

  async getLatest(): Promise<Property[]> {
    const all = await this.getAll();
    return all.slice(0, 4);
  }

  async getRecommendations(userId?: string): Promise<Property[]> {
    const all = await this.getAll();
    return all.filter(p => p.hostId !== userId).slice(0, 4);
  }
  async getAll(): Promise<Property[]> {
    // Public inventory and session verification are independent. Starting
    // both together removes an avoidable auth-after-catalog waterfall.
    const [publicRows, { data: authData }] = await Promise.all([
      fetchSanitizedPublicPropertyRows(),
      supabase.auth.getUser(),
    ]);
    const publicProperties = publicRows.map(mapPostgresProperty);

    const user = authData.user;
    if (!user) return publicProperties;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const accessibleData = await fetchAccessiblePropertyRows({
      hostId: user.id,
      includeAll: profile?.role === 'ADMIN',
    });

    const merged = new Map(publicProperties.map((property) => [property.id, property]));
    accessibleData.map(mapPostgresProperty).forEach((property) => {
      merged.set(property.id, property);
    });
    return Array.from(merged.values());
  }

  async getById(id: string): Promise<Property | null> {
    const [publicRow] = await fetchSanitizedPublicPropertyRows(id);
    if (!publicRow) {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return null;

      const [accessibleProperty] = await fetchAccessiblePropertyRows({ propertyId: id });
      if (!accessibleProperty) {
        console.error(`[SupabasePropertyService] Error fetching accessible property ${id}.`);
        return null;
      }

      return mapPostgresProperty(accessibleProperty);
    }

    return mapPostgresProperty(publicRow);
  }

  async create(property: Partial<Property> & { title: string; hostId: string }): Promise<Property> {
    property = {
      ...property,
      description: property.description?.trim()
        || 'Información pendiente de revisión por Towers México.',
      type: property.type || 'Apartment',
      valueRating: property.valueRating || 'Premium',
      country: property.country?.trim() || 'México',
      isPublished: false,
      folderStatus: 'UNDER_REVIEW',
      offerings: (property.offerings || []).map((offering) => ({
        ...offering,
        status: 'DRAFT',
      })),
    };
    // Auditar campos obligatorios antes de insertar
    const missingFields: string[] = [];
    const notNullFields = ['hostId', 'title', 'location', 'latitude', 'longitude'];
    notNullFields.forEach(field => {
      const val = property[field as keyof Property];
      if (val == null || (typeof val === 'string' && !val.trim())) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      console.log('❌ Property cannot be inserted');
      console.log('Missing fields:\n' + missingFields.map(f => `• ${f}`).join('\n'));
      throw new Error(`[Property Audit Error] Missing fields: ${missingFields.join(', ')}`);
    }

    // Dump completo del payload
    console.group("[Publish] Payload Final");
    console.table({
      hostId: property.hostId,
      title: property.title,
      description: property.description,
      type: property.type,
      location: property.location,
      country: property.country,
      latitude: property.latitude,
      longitude: property.longitude,
      valueRating: property.valueRating,
    });
    console.log(property);
    console.groupEnd();

    const tStartVal = performance.now();
    const validation = PropertyValidator.validatePropertyBeforeInsert(property, 'REVIEW');
    const tEndVal = performance.now();

    if (!validation.success) {
      console.log('[Property Validation] ❌ Validation failed for create:');
      validation.errors.forEach(err => console.log(`  ❌ ${err.field}: ${err.message}`));
      throw new Error(`[Property Validation Error] ${JSON.stringify(validation.errors)}`);
    } else {
      console.log(`[Property Validation] [Validator] ✔ ${Math.round(tEndVal - tStartVal)} ms`);
    }

    const tStartMap = performance.now();
    const filteredPayload = PropertyMapper.mapClientToPostgres(property);
    const tEndMap = performance.now();
    console.log(`[Property Validation] [Mapper] ✔ ${Math.round(tEndMap - tStartMap)} ms`);
    console.log('[Publish] Payload mapeado para Supabase (filteredPayload):', filteredPayload);
    console.log('[GeoTrace] [Fase F] Después del mapper (filteredPayload):', { latitude: filteredPayload.latitude, longitude: filteredPayload.longitude });

    const tStartInsert = performance.now();
    console.log('[GeoTrace] [Fase G] Antes del INSERT en properties');
    // 1. Create property record
    const { data, error } = await supabase
      .from('properties')
      .insert(filteredPayload)
      .select()
      .single();
    const tEndInsert = performance.now();

    if (error) {
      console.log(`[Property Validation] [Supabase Insert] ❌ Failed after ${Math.round(tEndInsert - tStartInsert)} ms:`, error);
      console.error('[Publish] ❌ Error de Supabase al insertar propiedad:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error; // Lanzar el error completo para ser atrapado y mapeado en la UI
    } else {
      console.log(`[Property Validation] [Supabase Insert] ✔ ${Math.round(tEndInsert - tStartInsert)} ms`);
    }

    // 2. Synchronize consolidated media
    const mediaService = new SupabasePropertyMediaService();
    const mediaToSync = property.media && property.media.length > 0
      ? property.media
      : (property.images || []).map((url, idx) => ({
          mediaType: 'IMAGE' as const,
          url,
          displayOrder: idx,
          isPrimary: idx === 0,
          metadata: {}
        }));

    try {
      await mediaService.saveBatch(data.id, mediaToSync);
    } catch (mediaError) {
      console.error('[SupabasePropertyService] Error syncing property media during creation:', mediaError);
    }

    const propertyToNormalize = PropertyMapper.mapPostgresToClient(data);
    propertyToNormalize.images = property.images || [];
    propertyToNormalize.media = mediaToSync as any;
    propertyToNormalize.offerings = property.offerings || [];

    const offeringsToInsert = normalizeOfferings(property.offerings || [], propertyToNormalize);

    const offeringsRows = offeringsToInsert.map(offering => ({
      property_id: data.id,
      mode: offering.mode,
      status: offering.status,
      visibility: offering.visibility,
      title: offering.title || property.title,
      description: offering.description || property.description,
      price_amount: offering.priceAmount,
      currency: offering.currency || 'USD',
      billing_period: offering.billingPeriod,
      deposit_amount: offering.depositAmount,
      security_deposit_amount: offering.securityDepositAmount,
      advance_months: offering.advanceMonths,
      requires_guarantor: offering.requiresGuarantor,
      requires_legal_policy: offering.requiresLegalPolicy,
      cleaning_fee_amount: offering.cleaningFeeAmount,
      service_fee_percent: offering.serviceFeePercent,
      commission_percent: offering.commissionPercent,
      commission_total_pct: offering.commissionTotalPct,
      commission_shared_pct: offering.commissionSharedPct,
      agent_responsible_id: offering.agentResponsibleId,
      min_nights: offering.minNights,
      max_nights: offering.maxNights,
      min_months: offering.minMonths,
      max_months: offering.maxMonths,
      is_price_negotiable: offering.isPriceNegotiable,
      accepts_offers: offering.acceptsOffers,
      requires_approval: offering.requiresApproval,
      allow_instant_request: offering.allowInstantRequest,
      swap_preferences: offering.swapPreferences || {},
      swap_value_tier: offering.swapValueTier || property.valueRating,
      aura_score_override: offering.auraScoreOverride ?? property.auraScore ?? null,
      available_from: offering.availableFrom,
      available_until: offering.availableUntil,
      is_featured: offering.isFeatured,
      featured_until: offering.featuredUntil,
      featured_rank: offering.featuredRank,
      accepts_bank_credit: offering.acceptsBankCredit,
      accepts_infonavit: offering.acceptsInfonavit,
      accepts_fovissste: offering.acceptsFovissste,
      accepts_cash: offering.acceptsCash,
      developer_financing: offering.developerFinancing,
      swap_min_value: offering.swapMinValue,
      swap_max_value: offering.swapMaxValue,
      swap_cash_difference_allowed: offering.swapCashDifferenceAllowed,
      annual_property_tax: offering.annualPropertyTax,
      water_monthly_avg: offering.waterMonthlyAvg,
      electricity_monthly_avg: offering.electricityMonthlyAvg,
      gas_monthly_avg: offering.gasMonthlyAvg,
      estimated_delivery_date: offering.estimatedDeliveryDate,
      metadata: offering.metadata || {}
    }));

    const { error: offeringError } = await supabase
      .from('property_offerings')
      .insert(offeringsRows);

    if (offeringError && !isMissingOfferingsRelationError(offeringError)) {
      await supabase.from('properties').delete().eq('id', data.id);
      throw new Error(`[SupabasePropertyService] Error creating property offerings (rolled back property): ${offeringError.message}`);
    }

    clearPropertyReadCaches();
    return this.getById(data.id) as Promise<Property>;
  }

  async update(id: string, property: Partial<Property>): Promise<Property> {
    const current = await this.getById(id);
    const sensitiveFields: Array<keyof Property> = [
      'title', 'description', 'type', 'location', 'country', 'address',
      'latitude', 'longitude', 'bedrooms', 'bathrooms', 'parkingSpaces',
      'surfaceTotal', 'surfaceBuilt', 'images', 'media', 'offerings',
      'legalDebtFree', 'legalPublicDeed', 'legalTaxCurrent', 'legalServicesPaid',
    ];
    const requiresReview = current?.isPublished === true
      && sensitiveFields.some((key) => (
        property[key] !== undefined
        && JSON.stringify(property[key]) !== JSON.stringify(current[key])
      ));
    if (requiresReview) {
      property = {
        ...property,
        isPublished: false,
        folderStatus: 'UNDER_REVIEW',
      };
    }
    const merged = {
      ...(current || {}),
      ...property,
      description: property.description?.trim()
        || current?.description?.trim()
        || 'Información pendiente de revisión por Towers México.',
      type: property.type || current?.type || 'Apartment',
      valueRating: property.valueRating || current?.valueRating || 'Premium',
      country: property.country?.trim() || current?.country?.trim() || 'México',
    };

    // Auditar campos obligatorios en el objeto fusionado antes de actualizar
    const missingFields: string[] = [];
    const notNullFields = ['hostId', 'title', 'location', 'latitude', 'longitude'];
    notNullFields.forEach(field => {
      const val = merged[field as keyof Property];
      if (val == null || (typeof val === 'string' && !val.trim())) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      console.log('❌ Property cannot be updated');
      console.log('Missing fields:\n' + missingFields.map(f => `• ${f}`).join('\n'));
      throw new Error(`[Property Audit Error] Missing fields: ${missingFields.join(', ')}`);
    }

    // Dump completo del payload fusionado
    console.group("[Publish] Payload Update Final (Merged)");
    console.table({
      hostId: merged.hostId,
      title: merged.title,
      description: merged.description,
      type: merged.type,
      location: merged.location,
      country: merged.country,
      latitude: merged.latitude,
      longitude: merged.longitude,
      valueRating: merged.valueRating,
    });
    console.log(merged);
    console.groupEnd();

    const tStartVal = performance.now();
    const validation = PropertyValidator.validatePropertyBeforeInsert(
      merged,
      merged.isPublished
        ? 'PUBLICATION'
        : merged.folderStatus === 'DRAFT'
          ? 'DRAFT'
          : 'REVIEW',
    );
    const tEndVal = performance.now();

    if (!validation.success) {
      console.log('[Property Validation] ❌ Validation failed for update:');
      validation.errors.forEach(err => console.log(`  ❌ ${err.field}: ${err.message}`));
      throw new Error(`[Property Validation Error] ${JSON.stringify(validation.errors)}`);
    } else {
      console.log(`[Property Validation] [Validator] ✔ ${Math.round(tEndVal - tStartVal)} ms`);
    }

    const tStartMap = performance.now();
    const filteredPayload = PropertyMapper.mapClientToPostgres(property);
    const tEndMap = performance.now();
    console.log(`[Property Validation] [Mapper] ✔ ${Math.round(tEndMap - tStartMap)} ms`);
    console.log('[Publish] Payload de actualización mapeado para Supabase (filteredPayload):', filteredPayload);
    console.log('[GeoTrace] [Fase F] Después del mapper (filteredPayload):', { latitude: filteredPayload.latitude, longitude: filteredPayload.longitude });

    const tStartUpdate = performance.now();
    console.log('[GeoTrace] [Fase G] Antes del UPDATE en properties');
    const { data, error } = await supabase
      .from('properties')
      .update(filteredPayload)
      .eq('id', id)
      .select()
      .single();
    const tEndUpdate = performance.now();

    if (error) {
      console.log(`[Property Validation] [Supabase Update] ❌ Failed after ${Math.round(tEndUpdate - tStartUpdate)} ms:`, error);
      console.error('[Publish] ❌ Error de Supabase al actualizar propiedad:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error; // Lanzar el error completo para ser atrapado y mapeado en la UI
    } else {
      console.log(`[Property Validation] [Supabase Update] ✔ ${Math.round(tEndUpdate - tStartUpdate)} ms`);
    }

    // Synchronize consolidated media
    if (property.media !== undefined || property.images !== undefined) {
      const mediaService = new SupabasePropertyMediaService();
      let mediaToSync: Partial<PropertyMedia>[] | undefined = property.media;
      
      if (mediaToSync === undefined && property.images !== undefined) {
        // Fallback: convert images to IMAGE media records
        mediaToSync = property.images.map((url, idx) => ({
          mediaType: 'IMAGE' as const,
          url,
          displayOrder: idx,
          isPrimary: idx === 0,
          metadata: {}
        }));
      }

      if (mediaToSync) {
        try {
          await mediaService.saveBatch(id, mediaToSync);
        } catch (mediaError) {
          console.error('[SupabasePropertyService] Error syncing property media during update:', mediaError);
        }
      }
    }

    // Sync and update offerings if passed
    if (property.offerings !== undefined) {
      // 1. Fetch current database offerings
      const { data: dbOfferings, error: getOfferingsError } = await supabase
        .from('property_offerings')
        .select('*')
        .eq('property_id', id);

      if (getOfferingsError && !isMissingOfferingsRelationError(getOfferingsError)) {
        console.error('[SupabasePropertyService] Error fetching offerings for update:', getOfferingsError.message);
        throw new Error(`[SupabasePropertyService] Error loading property offerings: ${getOfferingsError.message}`);
      }

      const existingOfferings = (dbOfferings || []).map(mapPostgresOffering);
      const syncedOfferings = syncPropertyOfferings(existingOfferings, property.offerings);

      // 2. Delete offerings that are NOT in the synced list
      const modesToKeep = syncedOfferings.map(o => o.mode);
      if (modesToKeep.length > 0) {
        const { error: deleteOfferingsError } = await supabase
          .from('property_offerings')
          .delete()
          .eq('property_id', id)
          .not('mode', 'in', `(${modesToKeep.join(',')})`);

        if (deleteOfferingsError && !isMissingOfferingsRelationError(deleteOfferingsError)) {
          console.error('[SupabasePropertyService] Error deleting removed offerings:', deleteOfferingsError.message);
          throw new Error(`[SupabasePropertyService] Error removing property offerings: ${deleteOfferingsError.message}`);
        }
      } else {
        await supabase
          .from('property_offerings')
          .delete()
          .eq('property_id', id);
      }

      // 3. Upsert the synced offerings (on Conflict property_id, mode)
      const offeringsRows = syncedOfferings.map(offering => {
        const isTempId = offering.id.startsWith('legacy-swap-') || offering.id.startsWith('offering-');
        return {
          id: isTempId ? undefined : offering.id,
          property_id: id,
          mode: offering.mode,
          status: offering.status,
          visibility: offering.visibility,
          title: offering.title || property.title,
          description: offering.description || property.description,
          price_amount: offering.priceAmount,
          currency: offering.currency || 'USD',
          billing_period: offering.billingPeriod,
          deposit_amount: offering.depositAmount,
          security_deposit_amount: offering.securityDepositAmount,
          advance_months: offering.advanceMonths,
          requires_guarantor: offering.requiresGuarantor,
          requires_legal_policy: offering.requiresLegalPolicy,
          cleaning_fee_amount: offering.cleaningFeeAmount,
          service_fee_percent: offering.serviceFeePercent,
          commission_percent: offering.commissionPercent,
          commission_total_pct: offering.commissionTotalPct,
          commission_shared_pct: offering.commissionSharedPct,
          agent_responsible_id: offering.agentResponsibleId,
          min_nights: offering.minNights,
          max_nights: offering.maxNights,
          min_months: offering.minMonths,
          max_months: offering.maxMonths,
          is_price_negotiable: offering.isPriceNegotiable,
          accepts_offers: offering.acceptsOffers,
          requires_approval: offering.requiresApproval,
          allow_instant_request: offering.allowInstantRequest,
          swap_preferences: offering.swapPreferences || {},
          swap_value_tier: offering.swapValueTier || property.valueRating,
          aura_score_override: offering.auraScoreOverride ?? property.auraScore ?? null,
          available_from: offering.availableFrom,
          available_until: offering.availableUntil,
          is_featured: offering.isFeatured,
          featured_until: offering.featuredUntil,
          featured_rank: offering.featuredRank,
          accepts_bank_credit: offering.acceptsBankCredit,
          accepts_infonavit: offering.acceptsInfonavit,
          accepts_fovissste: offering.acceptsFovissste,
          accepts_cash: offering.acceptsCash,
          developer_financing: offering.developerFinancing,
          swap_min_value: offering.swapMinValue,
          swap_max_value: offering.swapMaxValue,
          swap_cash_difference_allowed: offering.swapCashDifferenceAllowed,
          annual_property_tax: offering.annualPropertyTax,
          water_monthly_avg: offering.waterMonthlyAvg,
          electricity_monthly_avg: offering.electricityMonthlyAvg,
          gas_monthly_avg: offering.gasMonthlyAvg,
          estimated_delivery_date: offering.estimatedDeliveryDate,
          metadata: offering.metadata || {}
        };
      });

      const { error: upsertErr } = await supabase
        .from('property_offerings')
        .upsert(offeringsRows, { onConflict: 'property_id,mode' });

      if (upsertErr && !isMissingOfferingsRelationError(upsertErr)) {
        console.error('[SupabasePropertyService] Error upserting synced offerings:', upsertErr.message);
        throw new Error(`[SupabasePropertyService] Error updating property offerings: ${upsertErr.message}`);
      }
    } else {
      await this.syncLegacySwapOffering(id, property);
    }

    clearPropertyReadCaches();
    return this.getById(data.id) as Promise<Property>;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[SupabasePropertyService] Error deleting property ${id}:`, error);
      return false;
    }
    clearPropertyReadCaches();
    return true;
  }

  async togglePublish(id: string): Promise<Property> {
    const property = await this.getById(id);
    if (!property) throw new Error('Property not found');
    const nextPublished = property.isPublished !== true;
    const nextOfferings = (property.offerings || []).map((offering) => ({
      ...offering,
      status: (nextPublished ? 'ACTIVE' : 'PAUSED') as PropertyOffering['status'],
    }));

    if (nextPublished) {
      const validation = PropertyValidator.validateForPublication({
        ...property,
        isPublished: true,
        folderStatus: 'PUBLISHED',
        offerings: nextOfferings,
      });
      if (!validation.success) {
        throw new Error(`[Property Publication Gate] ${JSON.stringify(validation.errors)}`);
      }

      const { error: approvalError } = await supabase.rpc('approve_property_publication', {
        target_property_id: id,
      });
      if (approvalError) {
        throw new Error(`[SupabasePropertyService] Error approving property: ${approvalError.message}`);
      }

      clearPropertyReadCaches();
      const approvedProperty = await this.getById(id);
      if (!approvedProperty) {
        throw new Error('[SupabasePropertyService] The approved property could not be reloaded.');
      }
      return approvedProperty;
    }

    const { data, error } = await supabase
      .from('properties')
      .update({
        is_published: false,
        folder_status: 'PAUSED',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabasePropertyService] Error toggling publish status: ${error.message}`);
    }

    const { error: offeringError } = await supabase
      .from('property_offerings')
      .update({ status: 'PAUSED' })
      .eq('property_id', id)
      .in('mode', nextOfferings.map((offering) => offering.mode));

    if (offeringError && !isMissingOfferingsRelationError(offeringError)) {
      console.error('[SupabasePropertyService] Error syncing SWAP offering publish status:', offeringError.message);
    }

    clearPropertyReadCaches();
    return this.getById(data.id) as Promise<Property>;
  }

  async toggleFeature(id: string): Promise<Property> {
    const property = await this.getById(id);
    if (!property) throw new Error('Property not found');

    const isFeatured = (property as any).isFeatured ?? false;
    const { data, error } = await supabase
      .from('properties')
      .update({ is_featured: !isFeatured })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabasePropertyService] Error toggling feature status: ${error.message}`);
    }

    const { error: offeringError } = await supabase
      .from('property_offerings')
      .update({ is_featured: !isFeatured })
      .eq('property_id', id)
      .eq('mode', 'SWAP');

    if (offeringError && !isMissingOfferingsRelationError(offeringError)) {
      console.error('[SupabasePropertyService] Error syncing SWAP offering feature status:', offeringError.message);
    }

    clearPropertyReadCaches();
    return this.getById(data.id) as Promise<Property>;
  }

  private async syncLegacySwapOffering(id: string, property: Partial<Property>): Promise<void> {
    const payload: any = {};
    if (property.title !== undefined) payload.title = property.title;
    if (property.description !== undefined) payload.description = property.description;
    if (property.valueRating !== undefined) payload.swap_value_tier = property.valueRating;
    if (property.auraScore !== undefined) payload.aura_score_override = property.auraScore;
    if (property.availableStart !== undefined) payload.available_from = property.availableStart;
    if (property.availableEnd !== undefined) payload.available_until = property.availableEnd;
    if (property.isPublished !== undefined) payload.status = property.isPublished === false ? 'PAUSED' : 'ACTIVE';
    if (property.isFeatured !== undefined) payload.is_featured = property.isFeatured;
    if (property.featuredUntil !== undefined) payload.featured_until = property.featuredUntil;
    if (property.featuredRank !== undefined) payload.featured_rank = property.featuredRank;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase
      .from('property_offerings')
      .update(payload)
      .eq('property_id', id)
      .eq('mode', 'SWAP');

    if (error && !isMissingOfferingsRelationError(error)) {
      console.error('[SupabasePropertyService] Error syncing legacy SWAP offering:', error.message);
    }
  }
}

export { SupabaseUserService } from './supabase/SupabaseUserService';
export { SupabaseSwapService } from './supabase/SupabaseSwapService';
export { SupabaseMessageService } from './supabase/SupabaseMessageService';
export { SupabaseLeadService } from './supabase/SupabaseLeadService';
export { SupabaseNotificationService } from './supabase/SupabaseNotificationService';
