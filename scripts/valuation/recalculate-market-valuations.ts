import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { PropertyMapper } from '../../lib/services/PropertyMapper';
import type { Property } from '../../lib/types';
import {
  getPropertyMicroMarketKey,
  ValuationEngine,
  type ValuationCatalogProperty,
} from '../../lib/valuation/ValuationEngine';
import {
  mapMarketObservationToCatalogProperty,
  type MarketObservationRow,
} from '../../lib/valuation/MarketObservationMapper';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fetchPublicProperties = async (): Promise<Property[]> => {
  const { data: propertyRows, error: propertyError } = await client
    .from('properties')
    .select('*')
    .eq('is_published', true)
    .eq('folder_status', 'PUBLISHED')
    .eq('is_demo', false);
  if (propertyError) throw propertyError;
  const ids = (propertyRows || []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data: offeringRows, error: offeringError } = await client
    .from('property_offerings')
    .select('*')
    .in('property_id', ids);
  if (offeringError) throw offeringError;

  const offeringsByProperty = new Map<string, any[]>();
  (offeringRows || []).forEach((row) => {
    const current = offeringsByProperty.get(row.property_id) || [];
    current.push({
      ...row,
      property_offering_availability: [],
      property_offering_pricing_rules: [],
    });
    offeringsByProperty.set(row.property_id, current);
  });

  return (propertyRows || []).map((row) => PropertyMapper.mapPostgresToClient({
    ...row,
    property_media: [],
    property_offerings: offeringsByProperty.get(row.id) || [],
    profiles: null,
    publisher_contact: null,
  }));
};

const fetchMarketObservations = async (): Promise<MarketObservationRow[]> => {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const { data, error } = await client.rpc('get_market_observations_for_valuation', {
    p_since: since.toISOString().slice(0, 10),
    p_city: null,
    p_state: null,
  });
  if (error) throw error;
  return (data || []) as MarketObservationRow[];
};

interface PropertySubjectOverrideRow {
  property_id: string;
  surface_built_m2: number | null;
  surface_total_m2: number | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

const fetchPropertySubjectOverrides = async (): Promise<PropertySubjectOverrideRow[]> => {
  const { data, error } = await client
    .schema('valuation')
    .from('property_subject_overrides')
    .select('property_id,surface_built_m2,surface_total_m2,neighborhood,city,state')
    .eq('review_status', 'VERIFIED');
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }
  return (data || []) as PropertySubjectOverrideRow[];
};

const applySubjectOverride = (
  property: Property,
  override: PropertySubjectOverrideRow | undefined,
): Property => {
  if (!override) return property;
  return {
    ...property,
    surfaceBuilt: override.surface_built_m2 ?? property.surfaceBuilt,
    surfaceTotal: override.surface_total_m2 ?? property.surfaceTotal,
    neighborhood: override.neighborhood || property.neighborhood,
    privateNeighborhood: override.neighborhood || property.privateNeighborhood,
    city: override.city || property.city,
    state: override.state || property.state,
  };
};

const main = async () => {
  const includeDiagnostics = process.argv.includes('--diagnostics');
  const dryRun = process.argv.includes('--dry-run');
  const requestedPropertyId = process.argv
    .find((argument) => argument.startsWith('--property='))
    ?.split('=')[1];
  const [rawProperties, observationRows, subjectOverrides] = await Promise.all([
    fetchPublicProperties(),
    fetchMarketObservations(),
    fetchPropertySubjectOverrides(),
  ]);
  const overrideByProperty = new Map(subjectOverrides.map((override) => [override.property_id, override]));
  const properties = rawProperties.map((property) => applySubjectOverride(
    property,
    overrideByProperty.get(property.id),
  ));
  const marketCatalog = observationRows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is ValuationCatalogProperty => item !== null);
  const catalog: ValuationCatalogProperty[] = [...properties, ...marketCatalog];
  const targets = requestedPropertyId
    ? properties.filter((property) => property.id === requestedPropertyId)
    : properties;
  if (requestedPropertyId && targets.length === 0) {
    throw new Error(`Published property not found: ${requestedPropertyId}`);
  }

  const availableSourceCodes = [...new Set(marketCatalog.map((item) => item.valuationSource?.sourceCode).filter(Boolean))];
  const results: Array<Record<string, unknown>> = [];
  for (const property of targets) {
    const valuation = ValuationEngine.evaluate(property, catalog);
    const primaryOperation = property.offerings?.some((offering) => (
      offering.mode === 'MONTHLY_RENT'
      && offering.status === 'ACTIVE'
      && offering.visibility === 'PUBLIC'
    )) ? 'MONTHLY_RENT' : 'SALE';
    const sourceCodes = [...new Set(valuation.comparables
      .filter((comparable) => comparable.operation === primaryOperation)
      .map((comparable) => comparable.sourceCode)
      .filter((sourceCode): sourceCode is string => Boolean(sourceCode)))];
    let persistence: unknown = null;
    if (!dryRun) {
      const { data, error } = await client.rpc('save_market_valuation_run', {
        p_payload: {
          propertyId: property.id,
          valuation,
          sourceCodes,
          evidenceTier: valuation.evidenceTier,
        },
      });
      if (error) throw error;
      persistence = data;
    }
    results.push({
      propertyId: property.id,
      title: property.title,
      confidence: valuation.confidence,
      comparables: valuation.comparableCount,
      estimatedSaleValue: valuation.estimatedSaleValue,
      areaReferenceValue: valuation.areaReferenceValue,
      evidenceTier: valuation.evidenceTier,
      sourceCodes,
      persistence,
      ...(includeDiagnostics ? {
        diagnostics: {
          confidenceScore: valuation.confidenceScore,
          warnings: valuation.warnings,
          targetType: property.type,
          targetMicroMarket: getPropertyMicroMarketKey(property),
          externalSameMicroMarket: marketCatalog.filter((candidate) => (
            getPropertyMicroMarketKey(candidate) === getPropertyMicroMarketKey(property)
          )).length,
          externalSameMicroMarketAndType: marketCatalog.filter((candidate) => (
            getPropertyMicroMarketKey(candidate) === getPropertyMicroMarketKey(property)
            && candidate.type.trim().toLocaleLowerCase('es-MX') === property.type.trim().toLocaleLowerCase('es-MX')
          )).length,
          externalSameMicroMarketTypeAndOperation: marketCatalog.filter((candidate) => (
            getPropertyMicroMarketKey(candidate) === getPropertyMicroMarketKey(property)
            && candidate.type.trim().toLocaleLowerCase('es-MX') === property.type.trim().toLocaleLowerCase('es-MX')
            && candidate.offerings?.some((offering) => property.offerings?.some((targetOffering) => (
              targetOffering.mode === offering.mode
            )))
          )).length,
        },
      } : {}),
    });
  }

  console.log(JSON.stringify({
    propertiesEvaluated: targets.length,
    marketObservations: marketCatalog.length,
    availableSourceCodes,
    results,
  }, null, 2));
};

void main();
