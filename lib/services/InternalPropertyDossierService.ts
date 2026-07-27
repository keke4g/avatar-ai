import { supabase } from '../supabaseClient';

export interface InternalPropertyMarketplaceDossier {
  propertyId: string;
  capturedPriceAmount: number | null;
  currency: string;
  commissionTotalPct: number | null;
  commissionSharedPct: number | null;
  operationMode: string | null;
  exactAddress: string | null;
}

type InternalPropertyMarketplaceDossierRow = {
  property_id?: string;
  captured_price_amount?: number | string | null;
  currency?: string | null;
  commission_total_pct?: number | string | null;
  commission_shared_pct?: number | string | null;
  operation_mode?: string | null;
  exact_address?: string | null;
};

const optionalNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function getInternalPropertyMarketplaceDossier(
  propertyId: string,
): Promise<InternalPropertyMarketplaceDossier | null> {
  const { data, error } = await supabase.rpc(
    'get_internal_property_marketplace_dossier',
    { target_property_id: propertyId },
  );

  if (error) {
    if (error.code !== '42501') {
      console.error('[InternalPropertyDossier] Unable to load staff dossier:', error.message);
    }
    return null;
  }

  const row = data as InternalPropertyMarketplaceDossierRow | null;
  if (!row?.property_id) return null;

  return {
    propertyId: row.property_id,
    capturedPriceAmount: optionalNumber(row.captured_price_amount),
    currency: row.currency || 'MXN',
    commissionTotalPct: optionalNumber(row.commission_total_pct),
    commissionSharedPct: optionalNumber(row.commission_shared_pct),
    operationMode: row.operation_mode || null,
    exactAddress: row.exact_address?.trim() || null,
  };
}
