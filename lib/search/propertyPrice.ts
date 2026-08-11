import type {
  Property,
  PropertyBillingPeriod,
  PropertyOffering,
  PropertyOfferingMode,
} from '../types';

export type PropertyPriceOperation = 'sale' | 'rent';

export interface PropertyPriceSnapshot {
  amount: number;
  currency: string;
  mode: PropertyOfferingMode;
  billingPeriod: PropertyBillingPeriod;
  comparisonBasis: 'sale_total' | 'rent_monthly' | 'rent_short';
}

const hasPublishedPrice = (offering: PropertyOffering): boolean => (
  offering.status === 'ACTIVE'
  && Number.isFinite(Number(offering.priceAmount))
  && Number(offering.priceAmount) > 0
);

function findOffering(
  property: Property,
  operation?: PropertyPriceOperation,
): PropertyOffering | undefined {
  const active = (property.offerings || []).filter(hasPublishedPrice);

  if (operation === 'sale') {
    return active.find((offering) => offering.mode === 'SALE');
  }
  if (operation === 'rent') {
    return active.find((offering) => offering.mode === 'MONTHLY_RENT')
      || active.find((offering) => offering.mode === 'SHORT_RENT');
  }

  if (property.primaryOperation === 'SALE') {
    return active.find((offering) => offering.mode === 'SALE');
  }
  if (property.primaryOperation === 'RENT') {
    return active.find((offering) => offering.mode === 'MONTHLY_RENT')
      || active.find((offering) => offering.mode === 'SHORT_RENT');
  }

  return active.find((offering) => offering.mode === 'SALE') || active[0];
}

export function getPropertyPriceSnapshot(
  property: Property,
  operation?: PropertyPriceOperation,
): PropertyPriceSnapshot | null {
  const offering = findOffering(property, operation);
  const amount = Number(offering?.priceAmount);
  if (!offering || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    currency: offering.currency?.trim().toUpperCase() || 'MXN',
    mode: offering.mode,
    billingPeriod: offering.billingPeriod,
    comparisonBasis: offering.mode === 'SALE'
      ? 'sale_total'
      : offering.mode === 'MONTHLY_RENT'
        ? 'rent_monthly'
        : 'rent_short',
  };
}
