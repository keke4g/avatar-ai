import { getActiveOfferings } from '@/lib/propertyOfferings';
import type { Property, PropertyOffering, PropertyOfferingMode } from '@/lib/types';
export { getPropertyGalleryMedia } from '@/lib/propertyMedia';
export type { PropertyGalleryMediaItem } from '@/lib/propertyMedia';

export interface PublicResponsible {
  name: string;
  photo?: string;
  company?: string;
  position?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  profileId: string;
  representativeType?: NonNullable<Property['brokerProfile']>['representativeType'];
}
export interface ActivePropertyOfferingSummary {
  activeOfferingModes: PropertyOfferingMode[];
  activeRentOffering: PropertyOffering | null;
  activeSaleOffering: PropertyOffering | null;
  activeSwapOffering: PropertyOffering | null;
}

export const OFFERING_BADGE_ORDER: PropertyOfferingMode[] = [
  'SWAP',
  'SHORT_RENT',
  'MONTHLY_RENT',
  'SALE',
];

export const OFFERING_BADGE_META: Record<
  PropertyOfferingMode,
  { label: string; className: string; dotClassName: string }
> = {
  SWAP: {
    label: 'Intercambio',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    dotClassName: 'bg-violet-500',
  },
  SHORT_RENT: {
    label: 'Renta temporal',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClassName: 'bg-emerald-500',
  },
  MONTHLY_RENT: {
    label: 'Renta mensual',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    dotClassName: 'bg-sky-500',
  },
  SALE: {
    label: 'Venta',
    className: 'border-neutral-950 bg-neutral-950 text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,0.8)]',
    dotClassName: 'bg-amber-400',
  },
};

export const REPRESENTATIVE_LABELS: Record<
  NonNullable<NonNullable<Property['brokerProfile']>['representativeType']>,
  { es: string; en: string }
> = {
  OWNER: { es: 'Propietario', en: 'Owner' },
  REAL_ESTATE_ADVISOR: { es: 'Asesor de una inmobiliaria', en: 'Real estate advisor' },
  INDEPENDENT_ADVISOR: { es: 'Asesor independiente', en: 'Independent advisor' },
  REAL_ESTATE_AGENCY: { es: 'Inmobiliaria', en: 'Real estate agency' },
  CONSTRUCTION_COMPANY: { es: 'Constructora', en: 'Construction company' },
  DEVELOPER: { es: 'Desarrollador', en: 'Developer' },
  PROPERTY_MANAGER: { es: 'Administrador de propiedades', en: 'Property manager' },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEHOLDER_RESPONSIBLE_PATTERN = /^(agente|asesor|responsable|propietario|host|usuario|user)(\s+(responsable|inmobiliario|comercial))?$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePhone = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.replace(/\D/g, '').length >= 10 ? normalized : undefined;
};

const normalizeWhatsapp = (value?: string | null): string | undefined => {
  const normalized = normalizePhone(value);
  return normalized?.replace(/\D/g, '');
};

export function getPublicResponsible(property: Property): PublicResponsible | null {
  if (property.isDemo || property.is_demo || !UUID_PATTERN.test(property.hostId || '')) return null;

  const broker = property.brokerProfile;
  const name = (broker?.name || property.hostName || '').trim();
  if (!name || PLACEHOLDER_RESPONSIBLE_PATTERN.test(name)) return null;

  const email = broker?.email?.trim();
  return {
    name,
    photo: broker?.photo || property.hostAvatar || undefined,
    company: broker?.company?.trim() || undefined,
    position: broker?.position?.trim() || undefined,
    phone: normalizePhone(broker?.phone),
    whatsapp: normalizeWhatsapp(broker?.whatsapp),
    email: email && EMAIL_PATTERN.test(email) ? email : undefined,
    profileId: property.hostId,
    representativeType: broker?.representativeType,
  };
}
export function getActivePropertyOfferingSummary(
  property?: Property,
): ActivePropertyOfferingSummary {
  if (!property) {
    return {
      activeOfferingModes: [],
      activeRentOffering: null,
      activeSaleOffering: null,
      activeSwapOffering: null,
    };
  }

  const firstOfferingByMode = new Map<PropertyOfferingMode, PropertyOffering>();
  for (const offering of getActiveOfferings(property)) {
    if (!firstOfferingByMode.has(offering.mode)) {
      firstOfferingByMode.set(offering.mode, offering);
    }
  }

  return {
    activeOfferingModes: OFFERING_BADGE_ORDER.filter((mode) => firstOfferingByMode.has(mode)),
    activeRentOffering: firstOfferingByMode.get('SHORT_RENT')
      || firstOfferingByMode.get('MONTHLY_RENT')
      || null,
    activeSaleOffering: firstOfferingByMode.get('SALE') || null,
    activeSwapOffering: firstOfferingByMode.get('SWAP') || null,
  };
}
