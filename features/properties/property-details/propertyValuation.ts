import type { TowersPropertyValuation } from '@/components/property/sections/TowersValuationPanel';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type {
  PropertyOffering,
  PropertyOfferingMode,
  PropertyValuation,
} from '@/lib/types';

interface BuildPresentationValuationOptions {
  automatedValuation: PropertyValuation | null;
  language: LanguageType;
  offerings?: PropertyOffering[];
  selectedMode: PropertyOfferingMode | null;
}

export function buildPresentationValuation({
  automatedValuation,
  language,
  offerings,
  selectedMode,
}: BuildPresentationValuationOptions): TowersPropertyValuation | null {
  if (!automatedValuation) return null;

  const rentalMode = selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT';
  const isAreaReference = automatedValuation.evidenceTier === 'AREA_REFERENCE';
  const estimatedReference = isAreaReference
    ? automatedValuation.areaReferenceValue
    : rentalMode
      ? automatedValuation.estimatedMonthlyRent
      : automatedValuation.estimatedSaleValue;
  const publishedOffering = offerings?.find((offering) => (
    offering.mode === selectedMode
    && offering.status === 'ACTIVE'
    && offering.visibility === 'PUBLIC'
  ));
  const publishedPrice = publishedOffering?.priceAmount || null;
  const differencePercent = !isAreaReference && publishedPrice && estimatedReference
    ? Number(((publishedPrice - estimatedReference) / estimatedReference * 100).toFixed(2))
    : null;
  const marketPosition = differencePercent === null
    ? null
    : Math.abs(differencePercent) <= 8
      ? 'IN_RANGE' as const
      : differencePercent < 0
        ? 'BELOW' as const
        : 'ABOVE' as const;
  const supportedModel = automatedValuation.modelVersion === 'towers-market-v5';
  const status = !supportedModel || automatedValuation.confidence === 'INSUFFICIENT'
    ? 'INSUFFICIENT_DATA' as const
    : isAreaReference && automatedValuation.confidence === 'LOW'
      ? 'REFERENCE_ONLY' as const
      : 'READY' as const;

  return {
    status,
    mode: selectedMode || undefined,
    currency: automatedValuation.currency || publishedOffering?.currency || 'MXN',
    estimatedValue: estimatedReference,
    estimatedMin: isAreaReference
      ? automatedValuation.areaRangeLow
      : rentalMode
        ? automatedValuation.rentRangeLow
        : automatedValuation.saleRangeLow,
    estimatedMax: isAreaReference
      ? automatedValuation.areaRangeHigh
      : rentalMode
        ? automatedValuation.rentRangeHigh
        : automatedValuation.saleRangeHigh,
    estimatedPricePerM2: isAreaReference
      ? automatedValuation.areaPricePerM2
      : rentalMode
        ? automatedValuation.rentPricePerM2
        : automatedValuation.salePricePerM2,
    publishedPrice,
    differenceAmount: publishedPrice && estimatedReference
      ? publishedPrice - estimatedReference
      : null,
    differencePercent,
    marketPosition,
    estimatedMonthlyRent: automatedValuation.estimatedMonthlyRent,
    estimatedRentPerM2: automatedValuation.rentPricePerM2,
    grossCapRate: automatedValuation.estimatedCapRate || automatedValuation.grossRentalYield,
    confidenceScore: isAreaReference ? null : automatedValuation.confidenceScore,
    confidenceLabel: isAreaReference
      ? (language === 'es' ? 'Referencia orientativa' : 'Indicative reference')
      : language === 'es'
        ? `Confianza ${automatedValuation.confidence === 'HIGH' ? 'alta' : automatedValuation.confidence === 'MEDIUM' ? 'media' : 'insuficiente'}`
        : `${automatedValuation.confidence.toLocaleLowerCase()} confidence`,
    comparableCount: isAreaReference
      ? automatedValuation.comparableCount
      : rentalMode
        ? automatedValuation.rentComparableCount
        : automatedValuation.saleComparableCount,
    calculatedAt: automatedValuation.dataAsOf,
    dataCutoff: automatedValuation.dataAsOf,
    modelVersion: automatedValuation.modelVersion,
    evidenceTier: automatedValuation.evidenceTier,
    methodology: automatedValuation.methodology,
    sourceLabels: automatedValuation.sourceLabels?.length
      ? automatedValuation.sourceLabels
      : ['Referencias autorizadas de precios anunciados'],
    insufficiencyReasons: automatedValuation.warnings,
  };
}
