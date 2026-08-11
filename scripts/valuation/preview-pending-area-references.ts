import { readFileSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { PropertyMapper } from '../../lib/services/PropertyMapper';
import type { Property } from '../../lib/types';
import { ValuationEngine, type ValuationCatalogProperty } from '../../lib/valuation/ValuationEngine';
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

const subjectOverrides = new Map<string, Partial<Property>>([
  ['322e2053-3778-4331-a268-f4e68e07ba3d', { surfaceBuilt: 163.51, privateNeighborhood: 'Desarrollo Urbano Tres Ríos', city: 'Culiacán Rosales', state: 'Sinaloa' }],
  ['6280c0b5-f3d0-4be6-b57b-363407af3b9b', { surfaceBuilt: 50, privateNeighborhood: 'Villa Universidad', city: 'Culiacán Rosales', state: 'Sinaloa' }],
  ['e83974de-bd16-4ccd-bba3-ffa31f381c48', { surfaceBuilt: 60, surfaceTotal: 60, privateNeighborhood: 'Tetlán', city: 'Guadalajara', state: 'Jalisco' }],
  ['9659584a-b8f7-4a03-8ebb-d49b72b95605', { surfaceBuilt: 181, surfaceTotal: 181, privateNeighborhood: 'Zona Dorada', city: 'Mazatlán', state: 'Sinaloa' }],
  ['bf28aec2-f369-48c0-a1cb-ab9878ecfbf9', { privateNeighborhood: 'Villas de Oriente II', city: 'Tonalá', state: 'Jalisco' }],
]);

const fetchProperties = async (): Promise<Property[]> => {
  const { data: propertyRows, error: propertyError } = await client
    .from('properties')
    .select('*')
    .eq('is_published', true)
    .eq('folder_status', 'PUBLISHED')
    .eq('is_demo', false);
  if (propertyError) throw propertyError;
  const ids = (propertyRows || []).map((row) => row.id);
  const { data: offeringRows, error: offeringError } = await client
    .from('property_offerings')
    .select('*')
    .in('property_id', ids);
  if (offeringError) throw offeringError;
  const offeringsByProperty = new Map<string, unknown[]>();
  for (const row of offeringRows || []) {
    offeringsByProperty.set(row.property_id, [
      ...(offeringsByProperty.get(row.property_id) || []),
      { ...row, property_offering_availability: [], property_offering_pricing_rules: [] },
    ]);
  }
  return (propertyRows || []).map((row) => {
    const property = PropertyMapper.mapPostgresToClient({
      ...row,
      property_media: [],
      property_offerings: offeringsByProperty.get(row.id) || [],
      profiles: null,
      publisher_contact: null,
    });
    return { ...property, ...(subjectOverrides.get(property.id) || {}) };
  });
};

const fetchCurrentObservations = async (): Promise<MarketObservationRow[]> => {
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

const readPendingObservations = (): MarketObservationRow[] => {
  const sql = readFileSync(
    'supabase/migrations/20260809235600_ingest_verified_area_reference_observations.sql',
    'utf8',
  );
  const rows: MarketObservationRow[] = [];
  for (const match of sql.matchAll(/\$rows\$(\[[\s\S]*?\])\$rows\$/g)) {
    const parsed = JSON.parse(match[1]) as Array<Record<string, unknown>>;
    for (const row of parsed) {
      rows.push({
        ...(row as unknown as MarketObservationRow),
        id: `pending:${String(row.source_code)}:${String(row.external_reference)}`,
        usage_authorization: 'RESEARCH_ONLY',
      });
    }
  }
  return rows;
};

const main = async () => {
  const [properties, currentRows] = await Promise.all([
    fetchProperties(),
    fetchCurrentObservations(),
  ]);
  const rowsByIdentity = new Map<string, MarketObservationRow>();
  for (const row of [...currentRows, ...readPendingObservations()]) {
    rowsByIdentity.set(`${row.source_code}|${row.external_reference}`, row);
  }
  const marketCatalog = [...rowsByIdentity.values()]
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is ValuationCatalogProperty => item !== null);
  const catalog: ValuationCatalogProperty[] = [...properties, ...marketCatalog];
  const results = properties.map((property) => {
    const valuation = ValuationEngine.evaluate(property, catalog);
    return {
      propertyId: property.id,
      title: property.title,
      evidenceTier: valuation.evidenceTier,
      confidence: valuation.confidence,
      confidenceScore: valuation.confidenceScore,
      comparableCount: valuation.comparableCount,
      areaReferenceValue: valuation.areaReferenceValue,
      areaRangeLow: valuation.areaRangeLow,
      areaRangeHigh: valuation.areaRangeHigh,
      warnings: valuation.warnings,
      sources: [...new Set(valuation.comparables.map((item) => item.sourceCode).filter(Boolean))],
    };
  });
  console.log(JSON.stringify({
    propertiesEvaluated: properties.length,
    pendingObservations: readPendingObservations().length,
    totalObservations: marketCatalog.length,
    referencesReady: results.filter((result) => result.evidenceTier === 'AREA_REFERENCE').length,
    results,
  }, null, 2));
};

void main();
