import type { Property, PropertyOffering, PropertyOfferingMode } from './types';

export const PROPERTY_AVAILABILITY_STATUSES = [
  'Disponible',
  'Apartada',
  'Rentada',
  'No disponible',
] as const;

export type PropertyAvailabilityStatus = typeof PROPERTY_AVAILABILITY_STATUSES[number];

const AVAILABILITY_SET = new Set<string>(PROPERTY_AVAILABILITY_STATUSES);

export function normalizePropertyAvailability(value: unknown): PropertyAvailabilityStatus {
  if (typeof value === 'string' && AVAILABILITY_SET.has(value)) {
    return value as PropertyAvailabilityStatus;
  }

  if (value === 'Promesa de Compra' || value === 'En Escrituración' || value === 'Bajo Oferta' || value === 'En negociación') {
    return 'Apartada';
  }

  if (value === 'Vendida' || value === 'Suspendida') {
    return 'No disponible';
  }

  return 'Disponible';
}

export function getPropertyAvailability(property: Pick<Property, 'commercialStatus' | 'offerings' | 'primaryOperation'>): PropertyAvailabilityStatus {
  if (property.commercialStatus) {
    return normalizePropertyAvailability(property.commercialStatus);
  }

  const offerings = property.offerings || [];
  const primaryMode = property.primaryOperation as PropertyOfferingMode | undefined;
  const primaryOffering = offerings.find((offering) => offering.mode === primaryMode);
  const persistedStatus = primaryOffering?.metadata?.commercialStatus
    ?? offerings.find((offering) => offering.metadata?.commercialStatus)?.metadata?.commercialStatus;

  return normalizePropertyAvailability(persistedStatus);
}

export function persistPropertyAvailability(
  offerings: PropertyOffering[],
  status: PropertyAvailabilityStatus,
): PropertyOffering[] {
  return offerings.map((offering) => ({
    ...offering,
    metadata: {
      ...(offering.metadata || {}),
      commercialStatus: status,
    },
  }));
}
