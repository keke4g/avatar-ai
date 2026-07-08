import { supabase } from '../supabaseClient';
import { Property, PropertyOffering, User, SwapRequest, ChatMessage, Notification, SwapStatus, SwapTravelDetails, Lead } from '../types';
import { ensurePropertyOfferings, normalizeOfferings, syncPropertyOfferings } from '../propertyOfferings';
import { IPropertyService, IUserService, ISwapService, IMessageService, INotificationService, ILeadService } from './types';
import { PropertyMapper } from './PropertyMapper';
import { PropertyValidator } from './PropertyValidator';
import { searchProperties } from '../search/SearchEngine';
import { PropertySearchFilters, SearchResult, ProviderCapabilities } from '../search/types';
import { PROPERTY_TYPE_MAPPING } from '../searchFilters';
import { searchCache } from '../search/SearchCache';
import { measureExecution } from '../search/measureExecution';
import { searchLogger } from '../search/searchLogger';

const HYBRID_PROPERTY_SELECT = '*, property_images(image_url, display_order), profiles:public_profiles_view!host_id(name, avatar_url, is_verified), property_offerings(*, property_offering_availability(*), property_offering_pricing_rules(*))';
const LEGACY_PROPERTY_SELECT = '*, property_images(image_url, display_order), profiles:public_profiles_view!host_id(name, avatar_url, is_verified)';


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
      let query = supabase.from('public_properties_view').select(HYBRID_PROPERTY_SELECT);
      
      if (filters.type) {
        const allowedTypes = PROPERTY_TYPE_MAPPING[filters.type] || [filters.type];
        const capitalizedTypes = allowedTypes.map(t => {
          return t.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        });
        const dbTypes = Array.from(new Set([...allowedTypes, ...capitalizedTypes]));
        query = query.in('type', dbTypes);
      }

      query = query.eq('is_published', true);

      let { data, error } = await query;

      if (error && isMissingOfferingsRelationError(error)) {
        let legacyQuery = supabase.from('public_properties_view').select(LEGACY_PROPERTY_SELECT);
        if (filters.type) {
          const allowedTypes = PROPERTY_TYPE_MAPPING[filters.type] || [filters.type];
          const capitalizedTypes = allowedTypes.map(t => {
            return t.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          });
          const dbTypes = Array.from(new Set([...allowedTypes, ...capitalizedTypes]));
          legacyQuery = legacyQuery.in('type', dbTypes);
        }
        legacyQuery = legacyQuery.eq('is_published', true);
        const legacy = await legacyQuery;
        data = legacy.data;
        error = legacy.error;
      }

      if (error) {
        searchLogger.error('[SupabasePropertyService] Error during search pre-filter:', error);
        return { results: [], total: 0, filters, provider: 'supabase', executionTime: 0 };
      }

      const candidates = (data || []).map(mapPostgresProperty);
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
    let { data, error } = await supabase
      .from('public_properties_view')
      .select(HYBRID_PROPERTY_SELECT);

    if (error && isMissingOfferingsRelationError(error)) {
      console.warn('[SupabasePropertyService] property_offerings relation not available yet. Falling back to legacy property select.');
      const legacy = await supabase
        .from('public_properties_view')
        .select(LEGACY_PROPERTY_SELECT);
      data = legacy.data;
      error = legacy.error;
    }

    if (error) {
      console.error('[SupabasePropertyService] Error fetching properties:', error);
      return [];
    }

    return (data || []).map(mapPostgresProperty);
  }

  async getById(id: string): Promise<Property | null> {
    let { data, error } = await supabase
      .from('public_properties_view')
      .select(HYBRID_PROPERTY_SELECT)
      .eq('id', id)
      .single();

    if (error && isMissingOfferingsRelationError(error)) {
      console.warn('[SupabasePropertyService] property_offerings relation not available yet. Falling back to legacy property select.');
      const legacy = await supabase
        .from('public_properties_view')
        .select(LEGACY_PROPERTY_SELECT)
        .eq('id', id)
        .single();
      data = legacy.data;
      error = legacy.error;
    }

    if (error) {
      console.error(`[SupabasePropertyService] Error fetching property ${id}:`, error);
      return null;
    }

    return data ? mapPostgresProperty(data) : null;
  }

  async create(property: Partial<Property> & { title: string; hostId: string }): Promise<Property> {
    // Auditar campos obligatorios antes de insertar
    const missingFields: string[] = [];
    const notNullFields = ['hostId', 'title', 'description', 'location', 'country', 'latitude', 'longitude', 'type', 'valueRating'];
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
    const validation = PropertyValidator.validatePropertyBeforeInsert(property);
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

    // 2. Insert property images
    const imagesToInsert = property.images && property.images.length > 0 
      ? property.images.map((url, idx) => ({ property_id: data.id, image_url: url, display_order: idx }))
      : [{ property_id: data.id, image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', display_order: 0 }];

    const { error: imgError } = await supabase
      .from('property_images')
      .insert(imagesToInsert);

    if (imgError) {
      console.error('[SupabasePropertyService] Error saving property images:', imgError);
    }

    const propertyToNormalize = PropertyMapper.mapPostgresToClient(data);
    propertyToNormalize.images = property.images || [];
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
      security_deposit_amount: offering.securityDepositAmount,
      cleaning_fee_amount: offering.cleaningFeeAmount,
      service_fee_percent: offering.serviceFeePercent,
      commission_percent: offering.commissionPercent,
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
      aura_score_override: offering.auraScoreOverride || property.auraScore,
      available_from: offering.availableFrom,
      available_until: offering.availableUntil,
      is_featured: offering.isFeatured,
      featured_until: offering.featuredUntil,
      featured_rank: offering.featuredRank,
      metadata: offering.metadata || {}
    }));

    const { error: offeringError } = await supabase
      .from('property_offerings')
      .insert(offeringsRows);

    if (offeringError && !isMissingOfferingsRelationError(offeringError)) {
      await supabase.from('properties').delete().eq('id', data.id);
      throw new Error(`[SupabasePropertyService] Error creating property offerings (rolled back property): ${offeringError.message}`);
    }

    searchCache.clear();
    return this.getById(data.id) as Promise<Property>;
  }

  async update(id: string, property: Partial<Property>): Promise<Property> {
    const current = await this.getById(id);
    const merged = current ? { ...current, ...property } : property;

    // Auditar campos obligatorios en el objeto fusionado antes de actualizar
    const missingFields: string[] = [];
    const notNullFields = ['hostId', 'title', 'description', 'location', 'country', 'latitude', 'longitude', 'type', 'valueRating'];
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
    const validation = PropertyValidator.validatePropertyBeforeInsert(merged);
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

    // Synchronize normalized property images table
    if (property.images) {
      const { error: deleteErr } = await supabase
        .from('property_images')
        .delete()
        .eq('property_id', id);

      if (deleteErr) {
        console.error('[SupabasePropertyService] Error clearing old property images:', deleteErr.message);
      } else if (property.images.length > 0) {
        const imagesToInsert = property.images.map((url, idx) => ({
          property_id: id,
          image_url: url,
          display_order: idx
        }));
        
        const { error: insertErr } = await supabase
          .from('property_images')
          .insert(imagesToInsert);

        if (insertErr) {
          console.error('[SupabasePropertyService] Error inserting new property images:', insertErr.message);
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
          security_deposit_amount: offering.securityDepositAmount,
          cleaning_fee_amount: offering.cleaningFeeAmount,
          service_fee_percent: offering.serviceFeePercent,
          commission_percent: offering.commissionPercent,
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
          aura_score_override: offering.auraScoreOverride || property.auraScore,
          available_from: offering.availableFrom,
          available_until: offering.availableUntil,
          is_featured: offering.isFeatured,
          featured_until: offering.featuredUntil,
          featured_rank: offering.featuredRank,
          metadata: offering.metadata || {}
        };
      });

      const { error: upsertErr } = await supabase
        .from('property_offerings')
        .upsert(offeringsRows, { onConflict: 'property_id,mode' });

      if (upsertErr && !isMissingOfferingsRelationError(upsertErr)) {
        console.error('[SupabasePropertyService] Error upserting synced offerings:', upsertErr.message);
      }
    } else {
      await this.syncLegacySwapOffering(id, property);
    }

    searchCache.clear();
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
    searchCache.clear();
    return true;
  }

  async togglePublish(id: string): Promise<Property> {
    const property = await this.getById(id);
    if (!property) throw new Error('Property not found');

    const { data, error } = await supabase
      .from('properties')
      .update({ is_published: !property.isPublished })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabasePropertyService] Error toggling publish status: ${error.message}`);
    }

    const { error: offeringError } = await supabase
      .from('property_offerings')
      .update({ status: property.isPublished === false ? 'ACTIVE' : 'PAUSED' })
      .eq('property_id', id)
      .eq('mode', 'SWAP');

    if (offeringError && !isMissingOfferingsRelationError(offeringError)) {
      console.error('[SupabasePropertyService] Error syncing SWAP offering publish status:', offeringError.message);
    }

    searchCache.clear();
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

    searchCache.clear();
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

export class SupabaseUserService implements IUserService {
  async getAll(): Promise<User[]> {
    console.log('[SupabaseUserService] Querying public_profiles_view.getAll()...');
    const { data, error } = await supabase
      .from('public_profiles_view')
      .select('*');

    if (error) {
      console.error('[SupabaseUserService] Error fetching profiles. Code:', error.code, 'Message:', error.message, 'Full Error:', error);
      return [];
    }

    console.log('[SupabaseUserService] Query public_profiles_view.getAll() success. Row count:', data?.length, 'Exact Data Result:', data);
    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      role: row.role,
      isVerified: row.is_verified,
      kycStatus: row.kyc_status,
      joinDate: row.created_at?.split('T')[0] || '2026-05-01',
      swapsCount: 0,
      isSuspended: false,
      favorites: [],
      companyId: row.company_id,
      officeId: row.office_id,
      profileType: row.profile_type
    }));
  }

  async getById(id: string): Promise<User | null> {
    console.log(`[SupabaseUserService] Querying profile.getById(${id})...`);
    
    // Dynamically query profiles table for self to see email, or public_profiles_view for others
    const currentUser = (await supabase.auth.getUser()).data.user;
    const isSelf = currentUser?.id === id;
    const targetSource = isSelf ? 'profiles' : 'public_profiles_view';

    const { data, error } = await supabase
      .from(targetSource)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[SupabaseUserService] Error fetching profile ${id} from ${targetSource}. Code:`, error.code, 'Message:', error.message, 'Full Error:', error);
      return null;
    }

    console.log(`[SupabaseUserService] Query profile.getById(${id}) from ${targetSource} success. Exact Data Result:`, data);


    return data ? {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      role: data.role,
      isVerified: data.is_verified,
      kycStatus: data.kyc_status,
      joinDate: data.created_at?.split('T')[0] || '2026-05-01',
      swapsCount: 0,
      isSuspended: false,
      favorites: [],
      companyId: data.company_id,
      officeId: data.office_id,
      profileType: data.profile_type
    } : null;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const payload: any = {};
    if (userData.name !== undefined) payload.name = userData.name;
    if (userData.avatar !== undefined) payload.avatar_url = userData.avatar;
    if (userData.role !== undefined) payload.role = userData.role;
    if (userData.kycStatus !== undefined) {
      payload.kyc_status = userData.kycStatus;
      payload.is_verified = userData.kycStatus === 'VERIFIED';
    }
    if (userData.isVerified !== undefined) payload.is_verified = userData.isVerified;
    if (userData.companyId !== undefined) payload.company_id = userData.companyId;
    if (userData.officeId !== undefined) payload.office_id = userData.officeId;
    if (userData.profileType !== undefined) payload.profile_type = userData.profileType;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseUserService] Error updating profile ${id}: ${error.message}`);
    }

    return this.getById(data.id) as Promise<User>;
  }

  async updateVerification(id: string, isVerified: boolean, kycStatus: 'VERIFIED' | 'FAILED' | 'PENDING'): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_verified: isVerified, kyc_status: kycStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseUserService] Error updating profile verification: ${error.message}`);
    }

    return this.getById(data.id) as Promise<User>;
  }
}

export class SupabaseSwapService implements ISwapService {
  async getAll(): Promise<SwapRequest[]> {
    const { data, error } = await supabase
      .from('swaps')
      .select('*');

    if (error) {
      console.error('[SupabaseSwapService] Error fetching swaps:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderPropertyId: row.sender_property_id,
      receiverId: row.receiver_id,
      receiverPropertyId: row.receiver_property_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      message: row.message || '',
      createdAt: row.created_at,
      isDisputed: row.is_disputed,
      disputeReason: row.dispute_reason,
      senderConfirmedComplete: row.sender_confirmed_complete,
      receiverConfirmedComplete: row.receiver_confirmed_complete,
    }));
  }

  async getById(id: string): Promise<SwapRequest | null> {
    const { data, error } = await supabase
      .from('swaps')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[SupabaseSwapService] Error fetching swap request ${id}:`, error);
      return null;
    }

    return data ? {
      id: data.id,
      senderId: data.sender_id,
      senderPropertyId: data.sender_property_id,
      receiverId: data.receiver_id,
      receiverPropertyId: data.receiver_property_id,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      message: data.message || '',
      createdAt: data.created_at,
      isDisputed: data.is_disputed,
      disputeReason: data.dispute_reason,
      senderConfirmedComplete: data.sender_confirmed_complete,
      receiverConfirmedComplete: data.receiver_confirmed_complete,
    } : null;
  }

  async create(swap: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>): Promise<SwapRequest> {
    const { data, error } = await supabase
      .from('swaps')
      .insert({
        sender_id: swap.senderId,
        sender_property_id: swap.senderPropertyId,
        receiver_id: swap.receiverId,
        receiver_property_id: swap.receiverPropertyId,
        start_date: swap.startDate,
        end_date: swap.endDate,
        status: 'PENDING',
        message: swap.message || ''
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error creating swap request: ${error.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async updateStatus(id: string, status: SwapStatus): Promise<SwapRequest> {
    const { data, error } = await supabase
      .from('swaps')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error updating swap status: ${error.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async confirmCompletion(id: string, userId: string): Promise<SwapRequest> {
    const swap = await this.getById(id);
    if (!swap) throw new Error('Swap request not found');

    const updateFields: any = {};
    if (swap.senderId === userId) {
      updateFields.sender_confirmed_complete = true;
    } else if (swap.receiverId === userId) {
      updateFields.receiver_confirmed_complete = true;
    } else {
      throw new Error('No estás autorizado para finalizar este intercambio.');
    }

    const { data: updatedData, error } = await supabase
      .from('swaps')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseSwapService] Error confirming completion: ${error.message}`);
    }

    // If both sender and receiver confirmed completion, transition state to COMPLETED
    if (updatedData.sender_confirmed_complete && updatedData.receiver_confirmed_complete) {
      return this.updateStatus(id, 'COMPLETED');
    }

    return this.getById(id) as Promise<SwapRequest>;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('swaps')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseSwapService] Error deleting swap ${id}:`, error);
      return false;
    }
    return true;
  }

  async createDispute(swapId: string, reason: string): Promise<SwapRequest> {
    // 1. Insert row in disputes
    const { error: disputeErr } = await supabase
      .from('disputes')
      .insert({
        swap_id: swapId,
        reason,
        status: 'OPEN'
      });

    if (disputeErr) {
      throw new Error(`[SupabaseSwapService] Error creating dispute: ${disputeErr.message}`);
    }

    // 2. Update swaps table is_disputed flag
    const { data, error: swapErr } = await supabase
      .from('swaps')
      .update({ is_disputed: true })
      .eq('id', swapId)
      .select()
      .single();

    if (swapErr) {
      throw new Error(`[SupabaseSwapService] Error updating swap flag: ${swapErr.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async resolveDispute(swapId: string): Promise<SwapRequest> {
    // 1. Update dispute record to RESOLVED
    const { error: disputeErr } = await supabase
      .from('disputes')
      .update({ status: 'RESOLVED' })
      .eq('swap_id', swapId);

    if (disputeErr) {
      console.warn('[SupabaseSwapService] Dispute record resolve failed or not found:', disputeErr.message);
    }

    // 2. Update swaps table is_disputed flag
    const { data, error: swapErr } = await supabase
      .from('swaps')
      .update({ is_disputed: false })
      .eq('id', swapId)
      .select()
      .single();

    if (swapErr) {
      throw new Error(`[SupabaseSwapService] Error resolving swap flag: ${swapErr.message}`);
    }

    return this.getById(data.id) as Promise<SwapRequest>;
  }

  async getTravelDetails(swapId: string, travelerId: string): Promise<SwapTravelDetails | null> {
    const { data, error } = await supabase
      .from('swap_travel_details')
      .select('*')
      .eq('swap_id', swapId)
      .eq('traveler_id', travelerId)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseSwapService] Error fetching travel details for swap ${swapId}:`, error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      swapId: data.swap_id,
      travelerId: data.traveler_id,
      propertyId: data.property_id,
      wifiName: data.wifi_name || '',
      wifiPassword: data.wifi_password || '',
      accessCode: data.access_code || '',
      checkinInstructions: data.checkin_instructions || '',
      checkinTime: data.checkin_time || '15:00',
      checkoutTime: data.checkout_time || '11:00',
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      hostNotes: data.host_notes || '',
      createdAt: data.created_at
    };
  }

  async upsertTravelDetails(details: Partial<SwapTravelDetails> & { swapId: string; travelerId: string; propertyId: string }): Promise<SwapTravelDetails> {
    const payload = {
      swap_id: details.swapId,
      traveler_id: details.travelerId,
      property_id: details.propertyId,
      wifi_name: details.wifiName,
      wifi_password: details.wifiPassword,
      access_code: details.accessCode,
      checkin_instructions: details.checkinInstructions,
      checkin_time: details.checkinTime || '15:00',
      checkout_time: details.checkoutTime || '11:00',
      emergency_contact_name: details.emergencyContactName,
      emergency_contact_phone: details.emergencyContactPhone,
      host_notes: details.hostNotes
    };

    const { data, error } = await supabase
      .from('swap_travel_details')
      .upsert(payload, { onConflict: 'swap_id,traveler_id' })
      .select()
      .single();

    if (error) {
      console.error(`[SupabaseSwapService] Error upserting travel details:`, error);
      throw new Error(`[SupabaseSwapService] Error upserting travel details: ${error.message}`);
    }

    return {
      id: data.id,
      swapId: data.swap_id,
      travelerId: data.traveler_id,
      propertyId: data.property_id,
      wifiName: data.wifi_name || '',
      wifiPassword: data.wifi_password || '',
      accessCode: data.access_code || '',
      checkinInstructions: data.checkin_instructions || '',
      checkinTime: data.checkin_time || '15:00',
      checkoutTime: data.checkout_time || '11:00',
      emergencyContactName: data.emergency_contact_name || '',
      emergencyContactPhone: data.emergency_contact_phone || '',
      hostNotes: data.host_notes || '',
      createdAt: data.created_at
    };
  }

  async getAllTravelDetails(): Promise<SwapTravelDetails[]> {
    const { data, error } = await supabase
      .from('swap_travel_details')
      .select('*');

    if (error) {
      console.error('[SupabaseSwapService] Error fetching all travel details:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      swapId: row.swap_id,
      travelerId: row.traveler_id,
      propertyId: row.property_id,
      wifiName: row.wifi_name || '',
      wifiPassword: row.wifi_password || '',
      accessCode: row.access_code || '',
      checkinInstructions: row.checkin_instructions || '',
      checkinTime: row.checkin_time || '15:00',
      checkoutTime: row.checkout_time || '11:00',
      emergencyContactName: row.emergency_contact_name || '',
      emergencyContactPhone: row.emergency_contact_phone || '',
      hostNotes: row.host_notes || '',
      createdAt: row.created_at
    }));
  }
}

export class SupabaseMessageService implements IMessageService {
  async getAllForUser(userId: string): Promise<ChatMessage[]> {
    // Fetch all messages. RLS guarantees only matching messages are returned
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(name)');

    if (error) {
      console.error('[SupabaseMessageService] Error fetching messages:', error);
      return [];
    }

    return (data || []).map(row => {
      const senderProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        swapRequestId: row.swap_id,
        senderId: row.sender_id || 'system',
        senderName: row.sender_id ? (senderProfile?.name || 'Host') : 'AuraSwap',
        content: row.content,
        createdAt: row.created_at,
        isRead: row.is_read ?? false
      };
    });
  }

  async send(swapRequestId: string, content: string, senderId: string): Promise<ChatMessage> {
    const isSystem = senderId === 'system';
    // 1. Insert message row into messages
    const { data, error } = await supabase
      .from('messages')
      .insert({
        swap_id: swapRequestId,
        sender_id: isSystem ? null : senderId,
        content,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseMessageService] Error sending message: ${error.message}`);
    }

    // 2. Fetch profiles join to map back senderName
    let senderName = 'AuraSwap';
    if (!isSystem) {
      const { data: profile } = await supabase
        .from('public_profiles_view')
        .select('name')
        .eq('id', senderId)
        .single();
      senderName = profile?.name || 'Host';
    }

    return {
      id: data.id,
      swapRequestId: data.swap_id,
      senderId: data.sender_id || 'system',
      senderName,
      content: data.content,
      createdAt: data.created_at,
      isRead: data.is_read ?? false
    };
  }

  async markAsRead(swapRequestId: string, userId: string): Promise<void> {
    // Mark all messages as read for this swap thread where the sender is NOT the active user
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('swap_id', swapRequestId)
      .neq('sender_id', userId);

    if (error) {
      console.error(`[SupabaseMessageService] Error marking messages as read for swap ${swapRequestId}:`, error.message);
    }
  }
}

export class SupabaseLeadService implements ILeadService {
  async getAllForUser(userId: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseLeadService] Error fetching leads:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      offeringId: row.offering_id,
      userId: row.user_id,
      leadType: row.lead_type,
      message: row.message || '',
      status: row.status || 'NEW',
      createdAt: row.created_at,
    }));
  }

  async create(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        property_id: lead.propertyId,
        offering_id: lead.offeringId,
        user_id: lead.userId,
        lead_type: lead.leadType,
        message: lead.message,
        status: 'NEW',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseLeadService] Error creating lead: ${error.message}`);
    }

    return {
      id: data.id,
      propertyId: data.property_id,
      offeringId: data.offering_id,
      userId: data.user_id,
      leadType: data.lead_type,
      message: data.message || '',
      status: data.status || 'NEW',
      createdAt: data.created_at,
    };
  }
}

export class SupabaseNotificationService implements INotificationService {
  async getAllForUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseNotificationService] Error fetching notifications:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      isRead: row.is_read,
      createdAt: row.created_at
    }));
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId,
        title: notification.title,
        content: notification.content,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseNotificationService] Error creating notification: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      content: data.content,
      isRead: data.is_read,
      createdAt: data.created_at
    };
  }

  async markAsRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseNotificationService] Error marking notification ${id} as read:`, error);
      return false;
    }
    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) {
      console.error(`[SupabaseNotificationService] Error marking all notifications as read for user ${userId}:`, error);
      return false;
    }
    return true;
  }
}
