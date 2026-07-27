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

export interface InternalPropertyOwnerContact {
  propertyId: string;
  relationship: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  contactPreference: string | null;
  viewingDays: string[];
  viewingStartTime: string | null;
  viewingEndTime: string | null;
  hasKeys: boolean | null;
  occupancyStatus: string | null;
  appointmentNoticeHours: number | null;
  visitInstructions: string | null;
  extraNotes: string | null;
}

export type InternalPropertyOwnerContactInput = Omit<InternalPropertyOwnerContact, 'propertyId'>;

type InternalPropertyMarketplaceDossierRow = {
  property_id?: string;
  captured_price_amount?: number | string | null;
  currency?: string | null;
  commission_total_pct?: number | string | null;
  commission_shared_pct?: number | string | null;
  operation_mode?: string | null;
  exact_address?: string | null;
};

type InternalPropertyOwnerContactRow = {
  property_id?: string;
  relationship?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_preference?: string | null;
  viewing_days?: string[] | null;
  viewing_start_time?: string | null;
  viewing_end_time?: string | null;
  has_keys?: boolean | null;
  occupancy_status?: string | null;
  appointment_notice_hours?: number | string | null;
  visit_instructions?: string | null;
  extra_notes?: string | null;
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

export async function saveInternalPropertyOwnerContact(
  propertyId: string,
  input: InternalPropertyOwnerContactInput,
): Promise<void> {
  const { error } = await supabase.rpc(
    'upsert_internal_property_owner_contact',
    {
      target_property_id: propertyId,
      owner_payload: input,
    },
  );

  if (error) {
    console.error('[InternalPropertyDossier] Unable to save owner contact:', error.message);
    throw error;
  }
}

export async function getAdminPropertyOwnerContact(
  propertyId: string,
): Promise<InternalPropertyOwnerContact | null> {
  const { data, error } = await supabase.rpc(
    'get_admin_property_owner_contact',
    { target_property_id: propertyId },
  );

  if (error) {
    if (error.code !== '42501') {
      console.error('[InternalPropertyDossier] Unable to load owner contact:', error.message);
    }
    return null;
  }

  const row = data as InternalPropertyOwnerContactRow | null;
  if (!row?.property_id) return null;

  return {
    propertyId: row.property_id,
    relationship: row.relationship?.trim() || null,
    fullName: row.full_name?.trim() || null,
    phone: row.phone?.trim() || null,
    email: row.email?.trim() || null,
    contactPreference: row.contact_preference?.trim() || null,
    viewingDays: Array.isArray(row.viewing_days) ? row.viewing_days.filter(Boolean) : [],
    viewingStartTime: row.viewing_start_time || null,
    viewingEndTime: row.viewing_end_time || null,
    hasKeys: typeof row.has_keys === 'boolean' ? row.has_keys : null,
    occupancyStatus: row.occupancy_status?.trim() || null,
    appointmentNoticeHours: optionalNumber(row.appointment_notice_hours),
    visitInstructions: row.visit_instructions?.trim() || null,
    extraNotes: row.extra_notes?.trim() || null,
  };
}
