import { Property, PropertyOffering } from '../types';
import { PropertyMediaMapper } from './PropertyMediaMapper';
import { PROPERTY_COLUMNS } from '../db/propertySchema';

// Excepciones específicas de conversión camelCase <-> snake_case
const camelToSnakeMap: Record<string, string> = {
  security24_7: 'security_24_7',
  isDemo: 'is_demo'
};

const snakeToCamelMap: Record<string, string> = {
  security_24_7: 'security24_7',
  is_demo: 'isDemo'
};

export const toSnakeCase = (str: string): string => {
  if (camelToSnakeMap[str]) return camelToSnakeMap[str];
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

export const toCamelCase = (str: string): string => {
  if (snakeToCamelMap[str]) return snakeToCamelMap[str];
  return str.replace(/([-_][a-z0-9])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
};

export const isUuid = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
};

const mapOfferingMetadata = (row: any): Record<string, unknown> => {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? { ...row.metadata }
    : {};

  // The public offerings view intentionally does not expose the complete
  // metadata object. Rebuild only the rental fields that are safe and useful
  // on the public property page.
  if (row.rental_furnishing_status != null) {
    metadata.rentalFurnishingStatus = row.rental_furnishing_status;
  }
  if (Array.isArray(row.included_rental_services)) {
    metadata.includedRentalServices = row.included_rental_services;
    metadata.includesServices = row.included_rental_services.length > 0;
  }
  if (row.accepts_pets != null) {
    metadata.acceptsPets = row.accepts_pets === true;
  }
  if (row.includes_maintenance != null) {
    metadata.includesMaintenance = row.includes_maintenance === true;
  }

  return metadata;
};

export const mapPostgresOffering = (row: any): PropertyOffering => ({
  id: row.id,
  propertyId: row.property_id,
  commercialCode: row.commercial_code,
  mode: row.mode,
  status: row.status,
  visibility: row.visibility,
  title: row.title,
  description: row.description,
  priceAmount: row.price_amount == null ? null : Number(row.price_amount),
  currency: row.currency || '',
  billingPeriod: row.billing_period || 'NONE',
  depositAmount: row.deposit_amount == null ? null : Number(row.deposit_amount),
  securityDepositAmount: row.security_deposit_amount == null ? null : Number(row.security_deposit_amount),
  advanceMonths: row.advance_months == null ? undefined : Number(row.advance_months),
  requiresGuarantor: row.requires_guarantor == null ? undefined : row.requires_guarantor === true,
  requiresLegalPolicy: row.requires_legal_policy == null ? undefined : row.requires_legal_policy === true,
  cleaningFeeAmount: row.cleaning_fee_amount == null ? null : Number(row.cleaning_fee_amount),
  serviceFeePercent: row.service_fee_percent == null ? null : Number(row.service_fee_percent),
  commissionPercent: row.commission_percent == null ? null : Number(row.commission_percent),
  minNights: row.min_nights,
  maxNights: row.max_nights,
  minMonths: row.min_months,
  maxMonths: row.max_months,
  isPriceNegotiable: row.is_price_negotiable,
  acceptsOffers: row.accepts_offers,
  requiresApproval: row.requires_approval,
  allowInstantRequest: row.allow_instant_request,
  swapPreferences: row.swap_preferences || {},
  swapValueTier: row.swap_value_tier,
  swapEstimatedValue: row.swap_estimated_value == null ? null : Number(row.swap_estimated_value),
  swapMinValue: row.swap_min_value == null ? null : Number(row.swap_min_value),
  swapMaxValue: row.swap_max_value == null ? null : Number(row.swap_max_value),
  swapCashDifferenceAllowed: row.swap_cash_difference_allowed,
  acceptsBankCredit: row.accepts_bank_credit,
  acceptsInfonavit: row.accepts_infonavit,
  acceptsFovissste: row.accepts_fovissste,
  acceptsCash: row.accepts_cash,
  developerFinancing: row.developer_financing,
  commissionTotalPct: row.commission_total_pct == null ? null : Number(row.commission_total_pct),
  commissionSharedPct: row.commission_shared_pct == null ? null : Number(row.commission_shared_pct),
  agentResponsibleId: row.agent_responsible_id,
  estimatedDeliveryDate: row.estimated_delivery_date,
  auraScoreOverride: row.aura_score_override,
  availableFrom: row.available_from,
  availableUntil: row.available_until,
  isFeatured: row.is_featured,
  featuredUntil: row.featured_until,
  featuredRank: row.featured_rank,
  metadata: mapOfferingMetadata(row),
  createdAt: row.created_at,
  availability: (row.property_offering_availability || []).map((avail: any) => ({
    id: avail.id,
    offeringId: avail.offering_id,
    startDate: avail.start_date,
    endDate: avail.end_date,
    isBooked: avail.is_booked,
    metadata: avail.metadata || {},
    createdAt: avail.created_at,
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
  updatedAt: row.updated_at,
});

export class PropertyMapper {
  /**
   * Convierte un objeto frontend camelCase a un objeto snake_case filtrado por la whitelist.
   */
  public static mapClientToPostgres(property: Partial<Property>): Record<string, any> {
    const rawPayload: Record<string, any> = {};

    const uuidColumns = [
      'conservation_state_id',
      'construction_type_id',
      'view_type_id',
      'orientation_id',
      'company_id',
      'owner_profile_id'
    ];

    for (const [key, value] of Object.entries(property)) {
      const snakeKey = toSnakeCase(key);
      if (uuidColumns.includes(snakeKey)) {
        rawPayload[snakeKey] = isUuid(value) ? value : null;
      } else {
        rawPayload[snakeKey] = value;
      }
    }

    // Filtrar el objeto manteniendo únicamente las columnas válidas de la whitelist
    return Object.fromEntries(
      Object.entries(rawPayload).filter(([key]) => PROPERTY_COLUMNS.includes(key))
    );
  }

  /**
   * Convierte un registro de base de datos snake_case a un objeto camelCase del cliente.
   */
  public static mapPostgresToClient(row: any): Property {
    const property: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (key === 'profiles' || key === 'publisher_contact' || key === 'property_images' || key === 'property_offerings' || key === 'property_media') {
        continue;
      }
      const camelKey = toCamelCase(key);
      property[camelKey] = value;
    }

    // Process and sort unified media records
    const rawMedia = row.property_media || [];
    const media = rawMedia
      .filter((m: any) => !m.deleted_at)
      .map((m: any) => PropertyMediaMapper.mapPostgresToClient(m))
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Extract images for backwards compatibility with carousel / cards
    const images = media
      .filter((m: any) => m.mediaType === 'IMAGE')
      .map((m: any) => m.url);

    const hostProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const publisherContact = Array.isArray(row.publisher_contact)
      ? row.publisher_contact[0]
      : row.publisher_contact;

    return {
      ...property,
      media,
      images,
      hostName: hostProfile?.name || '',
      hostAvatar: hostProfile?.avatar_url || '',
      hostVerified: hostProfile?.is_verified === true,
      brokerProfile: publisherContact ? {
        photo: hostProfile?.avatar_url || '',
        name: publisherContact.full_name || hostProfile?.name || '',
        company: publisherContact.organization_name || '',
        position: '',
        representativeType: publisherContact.representative_type,
        responseTime: '',
        phone: publisherContact.phone || '',
        whatsapp: publisherContact.whatsapp || '',
        email: publisherContact.contact_email || '',
      } : undefined,
      hostRating: row.host_rating == null ? 0 : Number(row.host_rating),
      hostReviewsCount: row.host_reviews_count == null ? 0 : Number(row.host_reviews_count),
      availableStart: row.available_start || '',
      availableEnd: row.available_end || '',
      offerings: row.property_offerings ? row.property_offerings.map(mapPostgresOffering) : [],
    } as unknown as Property;
  }
}
