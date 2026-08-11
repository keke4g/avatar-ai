import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!supabaseUrl || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
}

const snapshotPaths = process.argv
  .filter((argument) => argument.startsWith('--snapshot='))
  .map((argument) => argument.slice('--snapshot='.length));
if (snapshotPaths.length === 0) {
  throw new Error('Pass at least one --snapshot=path/to/observations.jsonl');
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stableUuid = (sourceCode: string, externalReference: string): string => {
  const hash = createHash('sha256').update(`${sourceCode}:${externalReference}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

const readObservations = (): MarketObservationRow[] => snapshotPaths.flatMap((path) => (
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const row = JSON.parse(line) as Omit<MarketObservationRow, 'id' | 'usage_authorization'>;
      return {
        ...row,
        id: stableUuid(row.source_code, row.external_reference),
        usage_authorization: 'RESEARCH_ONLY' as const,
      };
    })
));

const fetchPublicCatalog = async (): Promise<Property[]> => {
  const [{ data: propertyRows, error: propertyError }, { data: offeringRows, error: offeringError }] = await Promise.all([
    client.from('public_properties_view').select('*'),
    client.from('public_property_offerings_view').select('*'),
  ]);
  if (propertyError) throw propertyError;
  if (offeringError) throw offeringError;
  const offeringsByProperty = new Map<string, Record<string, unknown>[]>();
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

const main = async () => {
  const [properties, rows] = await Promise.all([
    fetchPublicCatalog(),
    Promise.resolve(readObservations()),
  ]);
  const marketCatalog = rows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is ValuationCatalogProperty => item !== null);
  const catalog: ValuationCatalogProperty[] = [...properties, ...marketCatalog];
  const results = properties.map((property) => {
    const valuation = ValuationEngine.evaluate(property, catalog);
    const marketKey = getPropertyMicroMarketKey(property);
    return {
      propertyId: property.id,
      title: property.title,
      marketKey,
      externalSameMarket: marketCatalog.filter((candidate) => (
        getPropertyMicroMarketKey(candidate) === marketKey
      )).length,
      comparableCount: valuation.comparableCount,
      confidence: valuation.confidence,
      confidenceScore: valuation.confidenceScore,
      estimatedSaleValue: valuation.estimatedSaleValue,
      warnings: valuation.warnings,
      sources: [...new Set(valuation.comparables.map((item) => item.sourceCode).filter(Boolean))],
    };
  });
  console.log(JSON.stringify({
    snapshots: snapshotPaths,
    publicProperties: properties.length,
    researchObservations: marketCatalog.length,
    sources: [...new Set(marketCatalog.map((item) => item.valuationSource?.sourceCode).filter(Boolean))],
    results,
  }, null, 2));
};

void main();
