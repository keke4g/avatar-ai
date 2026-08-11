import { supabase } from '../supabaseClient';
import { useSupabase } from './ServiceFactory';

export type PublisherRepresentativeType =
  | 'REAL_ESTATE_ADVISOR'
  | 'INDEPENDENT_ADVISOR'
  | 'REAL_ESTATE_AGENCY'
  | 'CONSTRUCTION_COMPANY'
  | 'DEVELOPER'
  | 'OWNER'
  | 'PROPERTY_MANAGER';

export type PublisherProfile = {
  userId: string;
  representativeType: PublisherRepresentativeType;
  fullName: string;
  organizationName: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  completedAt: string;
};

export type PublisherProfileInput = Omit<PublisherProfile, 'userId' | 'completedAt'>;

const memoryKey = (userId: string) => `auraswap_publisher_profile_${userId}`;

export class PublisherSessionRequiredError extends Error {
  readonly code = 'PUBLISHER_SESSION_REQUIRED';

  constructor() {
    super('Tu sesión no está activa. Inicia sesión nuevamente para publicar.');
    this.name = 'PublisherSessionRequiredError';
  }
}

async function requirePublisherSession(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== userId) {
    throw new PublisherSessionRequiredError();
  }
}

const mapRow = (row: Record<string, unknown>): PublisherProfile => ({
  userId: String(row.user_id ?? row.userId ?? ''),
  representativeType: String(
    row.representative_type ?? row.representativeType,
  ) as PublisherRepresentativeType,
  fullName: String(row.full_name ?? row.fullName ?? ''),
  organizationName: (row.organization_name ?? row.organizationName ?? null) as string | null,
  phone: String(row.phone ?? ''),
  whatsapp: String(row.whatsapp ?? ''),
  email: String(row.contact_email ?? row.email ?? ''),
  completedAt: String(row.completed_at ?? row.completedAt ?? ''),
});

export async function getMyPublisherProfile(userId: string): Promise<PublisherProfile | null> {
  if (!useSupabase) {
    const stored = localStorage.getItem(memoryKey(userId));
    return stored ? JSON.parse(stored) as PublisherProfile : null;
  }

  await requirePublisherSession(userId);

  const { data, error } = await supabase
    .from('publisher_profiles')
    .select('user_id,representative_type,full_name,organization_name,phone,whatsapp,contact_email,completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo comprobar el perfil de publicación: ${error.message}`);
  }

  return data ? mapRow(data) : null;
}

export async function saveMyPublisherProfile(
  userId: string,
  input: PublisherProfileInput,
): Promise<PublisherProfile> {
  if (!useSupabase) {
    const profile: PublisherProfile = {
      ...input,
      userId,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(memoryKey(userId), JSON.stringify(profile));
    return profile;
  }

  await requirePublisherSession(userId);

  const { data, error } = await supabase.rpc('upsert_my_publisher_profile', {
    publisher_payload: {
      representativeType: input.representativeType,
      fullName: input.fullName,
      organizationName: input.organizationName,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
    },
  });

  if (error) {
    throw new Error(error.message || 'No se pudo guardar la comprobación de contacto.');
  }

  return mapRow((data ?? {}) as Record<string, unknown>);
}
