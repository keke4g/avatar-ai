import type {
  Property,
  PropertyOffering,
  PropertyValuation,
  PropertyValuationComparable,
  PropertyValuationConfidence,
} from '../types';

export const VALUATION_MODEL_VERSION = 'towers-market-v5';
export const DEFAULT_MIN_VALUATION_COMPARABLES = 8;
export const DEFAULT_MAX_COMPARABLE_DISTANCE_METERS = 5_000;
const MIN_EFFECTIVE_SAMPLE_SIZE = 5;
const MAX_COMPARABLE_WEIGHT_SHARE = 0.25;
const MAX_SOURCE_WEIGHT_SHARE = 0.60;
const MAX_LEAVE_ONE_OUT_VARIATION = 0.10;
const MAX_PRICE_PER_M2_SPREAD = 0.45;
const MIN_SOURCE_COUNT = 2;
const MIN_COMPARABLES_PER_SOURCE = 3;
const MIN_GEOLOCATED_SHARE = 0.60;
const MIN_CRITICAL_COMPLETENESS = 0.80;
const MIN_SOURCE_QUALITY_SCORE = 75;
const MIN_PUBLIC_CONFIDENCE_SCORE = 65;
const MAX_LISTING_AGE_DAYS = 180;
const MAX_VERIFICATION_AGE_DAYS = 30;
// The public product is a commercial asking-price guide, not a certified
// appraisal. Three coherent comparables are enough to publish an initial
// range; more observations improve the evidence label shown by the UI.
const MIN_AREA_REFERENCE_COMPARABLES = 3;
const MIN_AREA_EFFECTIVE_SAMPLE_SIZE = 2.15;
const MAX_AREA_COMPARABLE_WEIGHT_SHARE = 0.50;
const MAX_AREA_LEAVE_ONE_OUT_VARIATION = 0.25;
const MAX_AREA_ADJUSTED_PRICE_SPREAD = 0.70;
const MAX_AREA_SOURCE_MEDIAN_RATIO = 1.45;
const MIN_AREA_SOURCE_COUNT = 1;
const MIN_AREA_COMPARABLES_PER_SOURCE = 3;
const MIN_AREA_CRITICAL_COMPLETENESS = 0.70;
const MIN_AREA_ROOM_COMPLETENESS = 0.50;
const MIN_AREA_EVIDENCE_SCORE = 30;

export interface ValuationEngineOptions {
  minComparables?: number;
  maxDistanceMeters?: number;
  now?: Date;
}

type ComparableOperation = PropertyValuationComparable['operation'];

interface ComparableCandidate extends PropertyValuationComparable {
  observedAt: string | null;
  verifiedAt: string | null;
  adjustedPrice: number;
  marketKey: string;
  dedupeKey: string;
  hasCoordinates: boolean;
  hasVerifiedDistance: boolean;
  hasAreaPrecision: boolean;
  criticalCompleteness: number;
  roomCompleteness: number;
  baseWeight: number;
  surfaceBuilt: number | null;
  surfaceTotal: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
}

export interface ValuationCatalogProperty extends Property {
  valuationSource?: {
    marketObservationId?: string;
    externalReference?: string;
    sourceCode: string;
    qualityScore: number;
    syndicationKey?: string | null;
    publishedAt?: string | null;
    lastVerifiedAt?: string | null;
    locationPrecision?: 'POINT' | 'NEIGHBORHOOD' | 'POSTAL_CODE' | 'CITY' | 'UNKNOWN';
    dataCompleteness?: number | null;
    usageAuthorization?: 'AUTHORIZED' | 'RESEARCH_ONLY' | 'UNVERIFIED' | 'PROHIBITED';
  };
}

interface MarketEstimate {
  estimate: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  pricePerM2: number | null;
  comparables: ComparableCandidate[];
  confidenceScore: number;
  rejectionReasons: string[];
  effectiveSampleSize: number;
  maxWeightShare: number;
  leaveOneOutVariation: number;
  sourceCount: number;
  qualifiedSourceCount: number;
  maxSourceWeightShare: number;
  pricePerM2Spread: number;
  geolocatedShare: number;
  criticalCompleteness: number;
  evidenceTier: 'STRICT_ESTIMATE' | 'AREA_REFERENCE' | 'INSUFFICIENT';
}

const MEXICO_BOUNDS = {
  minLatitude: 14,
  maxLatitude: 33.5,
  minLongitude: -118.5,
  maxLongitude: -86,
};

const isPositiveFinite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

export const hasValidMexicoCoordinates = (property: Pick<Property, 'latitude' | 'longitude'>): boolean => (
  typeof property.latitude === 'number'
  && Number.isFinite(property.latitude)
  && typeof property.longitude === 'number'
  && Number.isFinite(property.longitude)
  && property.latitude >= MEXICO_BOUNDS.minLatitude
  && property.latitude <= MEXICO_BOUNDS.maxLatitude
  && property.longitude >= MEXICO_BOUNDS.minLongitude
  && property.longitude <= MEXICO_BOUNDS.maxLongitude
);

const toRadians = (degrees: number): number => degrees * Math.PI / 180;

export const distanceBetweenPropertiesMeters = (
  first: Pick<Property, 'latitude' | 'longitude'>,
  second: Pick<Property, 'latitude' | 'longitude'>,
): number => {
  if (!hasValidMexicoCoordinates(first) || !hasValidMexicoCoordinates(second)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMeters = 6_371_008.8;
  const latitudeDelta = toRadians(second.latitude! - first.latitude!);
  const longitudeDelta = toRadians(second.longitude! - first.longitude!);
  const firstLatitude = toRadians(first.latitude!);
  const secondLatitude = toRadians(second.latitude!);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getSurface = (property: Property): number | null => {
  if (isPositiveFinite(property.surfaceBuilt)) return property.surfaceBuilt;
  if (isPositiveFinite(property.surfaceTotal)) return property.surfaceTotal;
  return null;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const ageInDays = (value: string | null | undefined, now: Date): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - timestamp) / (24 * 60 * 60 * 1_000));
};

const normalizeMarketText = (value: string | null | undefined): string => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-MX')
  .replace(/\b(colonia|col\.?|fraccionamiento|fracc\.?|residencial)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\brosales\b/g, ' ')
  .trim();

const MEXICAN_STATE_KEYS = new Set([
  'aguascalientes', 'baja california', 'baja california sur', 'campeche',
  'chiapas', 'chihuahua', 'ciudad de mexico', 'coahuila', 'colima',
  'durango', 'estado de mexico', 'guanajuato', 'guerrero', 'hidalgo',
  'jalisco', 'michoacan', 'morelos', 'nayarit', 'nuevo leon', 'oaxaca',
  'puebla', 'queretaro', 'quintana roo', 'san luis potosi', 'sinaloa',
  'sonora', 'tabasco', 'tamaulipas', 'tlaxcala', 'veracruz', 'yucatan',
  'zacatecas',
]);

const canonicalMicroZone = (value: string): string => {
  if (value.startsWith('lomas de angelopolis')) return 'lomas de angelopolis';
  if (/^(?:zona comercial )?desarrollo urbano (?:3|tres) rios$/.test(value)) {
    return 'desarrollo urbano tres rios';
  }
  if (/^(?:urbi)?villa del cedro$/.test(value)) return 'villa del cedro';
  if (/^(?:aldama )?tetlan$/.test(value) || value === 'presa laurel') return 'tetlan';
  if (/^villas? (?:del|de) oriente (?:2|ii)$/.test(value)) return 'villas de oriente ii';
  return value;
};

/**
 * A distance radius is not a market segment. Culiacan neighborhoods a few
 * kilometres apart can have radically different land values, so candidates
 * must first share an explicit micro-market and distance only ranks matches
 * inside that market.
 */
export const getPropertyMicroMarketKey = (property: Property): string => {
  const explicitZone = property.privateNeighborhood
    || property.subdivisionName
    || property.developmentName
    || property.neighborhood;
  const locationParts = (property.location || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const firstLocationPart = normalizeMarketText(locationParts[0]);
  const secondLocationPart = normalizeMarketText(locationParts[1]);
  const normalizedExplicitZone = normalizeMarketText(explicitZone);
  const secondPartIsState = MEXICAN_STATE_KEYS.has(secondLocationPart);
  const firstPartIsExplicitZone = Boolean(
    normalizedExplicitZone
    && firstLocationPart
    && (
      normalizedExplicitZone === firstLocationPart
      || normalizedExplicitZone.includes(firstLocationPart)
      || firstLocationPart.includes(normalizedExplicitZone)
    )
  );
  const inferredCity = normalizeMarketText(property.city) || (
    normalizedExplicitZone
      ? (firstPartIsExplicitZone && !secondPartIsState ? secondLocationPart : firstLocationPart)
      : (secondPartIsState || locationParts.length <= 1 ? firstLocationPart : secondLocationPart)
  );
  const inferredZone = normalizedExplicitZone || (
    secondPartIsState || locationParts.length <= 1 ? '' : firstLocationPart
  );
  const zone = canonicalMicroZone(inferredZone);
  const city = inferredCity;
  if (zone.startsWith('lomas de angelopolis')) {
    // The development crosses San Andrés Cholula, Santa Clara Ocoyucan and
    // San Bernardino Tlaxcalancingo; those locality labels must not split the
    // same residential market. Distance and sample gates still apply.
    return 'puebla metropolitana|lomas de angelopolis';
  }
  if (zone === 'villas de oriente ii') {
    // The inventory historically labeled this development as Tlaquepaque,
    // while the portal/cadastral market is Tonalá.  Normalize the market key
    // without mutating the published address or silently moving the property.
    return 'tonala|villas de oriente ii';
  }
  // City + micro-zone is the stable public identity. State is intentionally
  // omitted because the sanitized public inventory does not expose it on all
  // historical rows, while a city name is already unambiguous for this model.
  return [city, zone].filter(Boolean).join('|');
};

const activeOfferingFor = (
  property: Property,
  operation: ComparableOperation,
): PropertyOffering | undefined => property.offerings?.find((offering) => (
  offering.status === 'ACTIVE'
  && offering.visibility === 'PUBLIC'
  && offering.mode === operation
  && isPositiveFinite(offering.priceAmount)
  && (offering.currency || 'MXN').toUpperCase() === 'MXN'
));

const quantile = (sorted: number[], percentile: number): number => {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const fraction = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction;
};

const median = (values: number[]): number => quantile([...values].sort((a, b) => a - b), 0.5);

const removeAdjustedPriceOutliers = (candidates: ComparableCandidate[]): ComparableCandidate[] => {
  // With fewer than five observations there is not enough evidence to decide
  // which point is an outlier. Small samples are instead bounded by the
  // dispersion and leave-one-out stability gates below.
  if (candidates.length < 5) return candidates;
  const logPrices = candidates.map((candidate) => Math.log(candidate.adjustedPrice));
  const center = median(logPrices);
  const deviations = logPrices.map((value) => Math.abs(value - center));
  const medianAbsoluteDeviation = median(deviations);
  if (medianAbsoluteDeviation === 0) {
    return candidates.filter((candidate) => {
      const ratio = candidate.adjustedPrice / Math.exp(center);
      return ratio >= 0.60 && ratio <= 1.67;
    });
  }
  const robustSigma = medianAbsoluteDeviation * 1.4826;
  return candidates.filter((candidate) => (
    Math.abs(Math.log(candidate.adjustedPrice) - center) <= robustSigma * 3.5
  ));
};

const weightedMedian = (candidates: ComparableCandidate[]): number => {
  const ordered = [...candidates].sort((a, b) => a.adjustedPrice - b.adjustedPrice);
  const totalWeight = ordered.reduce((sum, candidate) => sum + candidate.weight, 0);
  let accumulated = 0;
  for (const candidate of ordered) {
    accumulated += candidate.weight;
    if (accumulated >= totalWeight / 2) return candidate.adjustedPrice;
  }
  return ordered.at(-1)?.adjustedPrice || 0;
};

const weightedQuantile = (candidates: ComparableCandidate[], percentile: number): number => {
  if (candidates.length === 0) return 0;
  const ordered = [...candidates].sort((a, b) => a.adjustedPrice - b.adjustedPrice);
  const totalWeight = ordered.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (totalWeight <= 0) return ordered[Math.floor((ordered.length - 1) * percentile)].adjustedPrice;
  const targetWeight = clamp(percentile, 0, 1) * totalWeight;
  let accumulated = 0;
  for (const candidate of ordered) {
    accumulated += candidate.weight;
    if (accumulated >= targetWeight) return candidate.adjustedPrice;
  }
  return ordered.at(-1)?.adjustedPrice || 0;
};

const balanceWeightsBySource = (candidates: ComparableCandidate[]): ComparableCandidate[] => {
  const sourceTotals = new Map<string, number>();
  for (const candidate of candidates) {
    const source = candidate.sourceCode || 'unknown';
    sourceTotals.set(source, (sourceTotals.get(source) || 0) + candidate.baseWeight);
  }
  const sourceCount = sourceTotals.size;
  if (sourceCount === 0) return [];
  return candidates.map((candidate) => {
    const source = candidate.sourceCode || 'unknown';
    const sourceTotal = sourceTotals.get(source) || 1;
    return {
      ...candidate,
      weight: candidate.baseWeight / sourceTotal / sourceCount,
    };
  });
};

const normalizeType = (value: string): string => value.trim().toLocaleLowerCase('es-MX');

const isHouseType = (property: Property): boolean => (
  ['villa', 'beach house', 'cabin'].includes(normalizeType(property.type))
);

const adjustedComparablePrice = (
  target: Property,
  candidate: Property,
  price: number,
): number => {
  const targetBuilt = isPositiveFinite(target.surfaceBuilt) ? target.surfaceBuilt : null;
  const candidateBuilt = isPositiveFinite(candidate.surfaceBuilt) ? candidate.surfaceBuilt : null;
  const targetLand = isPositiveFinite(target.surfaceTotal) ? target.surfaceTotal : null;
  const candidateLand = isPositiveFinite(candidate.surfaceTotal) ? candidate.surfaceTotal : null;

  let sizeFactor = 1;
  if (isHouseType(target) && targetBuilt && candidateBuilt && targetLand && candidateLand) {
    // A house is land plus improvements. The exponents intentionally sum to
    // one so this remains a conservative homologation, not a double count.
    sizeFactor = (targetBuilt / candidateBuilt) ** 0.55
      * (targetLand / candidateLand) ** 0.45;
  } else {
    const targetSurface = getSurface(target);
    const candidateSurface = getSurface(candidate);
    if (targetSurface && candidateSurface) {
      sizeFactor = (targetSurface / candidateSurface) ** 0.85;
    }
  }

  const bedroomDifference = (target.bedrooms || 0) - (candidate.bedrooms || 0);
  const bathroomDifference = (target.bathrooms || 0) - (candidate.bathrooms || 0);
  const roomFactor = clamp(1 + bedroomDifference * 0.025 + bathroomDifference * 0.02, 0.85, 1.15);
  const ageFactor = isPositiveFinite(target.constructionAge) && isPositiveFinite(candidate.constructionAge)
    ? clamp(1 + (candidate.constructionAge - target.constructionAge) * 0.004, 0.85, 1.15)
    : 1;

  return Math.round(price * clamp(sizeFactor, 0.50, 2) * roomFactor * ageFactor);
};

const buildCandidates = (
  target: Property,
  catalog: ValuationCatalogProperty[],
  operation: ComparableOperation,
  maxDistanceMeters: number,
  now: Date,
): ComparableCandidate[] => {
  const targetSurface = getSurface(target);
  const targetMarketKey = getPropertyMicroMarketKey(target);
  const targetState = normalizeMarketText(target.state);
  // A city-wide bucket is not a defensible residential micro-market.  Keep
  // the city-only key for diagnostics, but fail closed until the subject has
  // a verified neighborhood/development (for example Tetlán or Zona Dorada).
  if (
    !targetSurface
    || !targetMarketKey.includes('|')
  ) return [];

  const rawCandidates = catalog.flatMap((candidate): ComparableCandidate[] => {
    const externalSource = candidate.valuationSource;
    const candidateState = normalizeMarketText(candidate.state);
    const hasCoordinates = hasValidMexicoCoordinates(candidate);
    const hasVerifiedDistance = hasValidMexicoCoordinates(target) && hasCoordinates;
    const hasAreaPrecision = !externalSource || ['POINT', 'NEIGHBORHOOD'].includes(
      externalSource.locationPrecision || 'UNKNOWN',
    );
    if (
      candidate.id === target.id
      || candidate.isDemo
      || candidate.is_demo
      || candidate.isPublished === false
      || normalizeType(candidate.type) !== normalizeType(target.type)
      || getPropertyMicroMarketKey(candidate) !== targetMarketKey
      || (targetState && candidateState !== targetState)
      || !hasAreaPrecision
      || (externalSource && !['AUTHORIZED', 'RESEARCH_ONLY'].includes(externalSource.usageAuthorization || ''))
      || (externalSource && externalSource.qualityScore < Math.max(MIN_SOURCE_QUALITY_SCORE, 80))
    ) return [];

    const surfaceM2 = getSurface(candidate);
    const offering = activeOfferingFor(candidate, operation);
    if (!surfaceM2 || !offering || !isPositiveFinite(offering.priceAmount)) return [];

    const sizeRatio = surfaceM2 / targetSurface;
    if (sizeRatio < 0.50 || sizeRatio > 2) return [];

    // For research listings, publication date is often not exposed.  A
    // current successful verification proves the asking price is active, but
    // it must not be relabeled as the original publication date.
    const observedAt = externalSource
      ? (externalSource.publishedAt || externalSource.lastVerifiedAt || null)
      : (candidate.publishedAt || candidate.createdAt || null);
    const verifiedAt = externalSource?.lastVerifiedAt
      || candidate.updatedAt
      || observedAt;
    if (
      ageInDays(observedAt, now) > MAX_LISTING_AGE_DAYS
      || ageInDays(verifiedAt, now) > MAX_VERIFICATION_AGE_DAYS
    ) return [];

    // A neighborhood-only listing remains usable evidence, but it never
    // receives an invented distance. The strict sample gate below requires
    // most of the final sample to have real point coordinates.
    const distanceMeters = hasVerifiedDistance
      ? distanceBetweenPropertiesMeters(target, candidate)
      : null;
    if (distanceMeters !== null && !Number.isFinite(distanceMeters)) return [];

    const sizeSimilarity = Math.min(surfaceM2, targetSurface) / Math.max(surfaceM2, targetSurface);
    const bedroomSimilarity = 1 / (1 + Math.abs((candidate.bedrooms || 0) - (target.bedrooms || 0)) * 0.12);
    const bathroomSimilarity = 1 / (1 + Math.abs((candidate.bathrooms || 0) - (target.bathrooms || 0)) * 0.1);
    const observedTime = observedAt ? new Date(observedAt).getTime() : Number.NaN;
    const ageYears = Number.isFinite(observedTime)
      ? Math.max(0, (now.getTime() - observedTime) / (365.25 * 24 * 60 * 60 * 1_000))
      : 2;
    const recencyWeight = 1 / (1 + ageYears * 0.08);
    const usageWeight = externalSource?.usageAuthorization === 'RESEARCH_ONLY' ? 0.82 : 1;
    const sourceQualityWeight = externalSource
      ? clamp(externalSource.qualityScore / 100, 0.55, 1) * usageWeight
      : 1;
    const calculatedCompleteness = [
      isPositiveFinite(offering.priceAmount),
      isPositiveFinite(surfaceM2),
      Boolean(targetMarketKey),
      Boolean(observedAt),
      Boolean(verifiedAt),
      isPositiveFinite(candidate.bedrooms),
      isPositiveFinite(candidate.bathrooms),
    ].filter(Boolean).length / 7;
    const criticalCompleteness = clamp(
      externalSource?.dataCompleteness ?? calculatedCompleteness,
      0,
      1,
    );
    const roomCompleteness = (
      Number(isPositiveFinite(candidate.bedrooms))
      + Number(isPositiveFinite(candidate.bathrooms))
    ) / 2;
    const baseWeight = Math.max(
      0.01,
      sizeSimilarity
        * bedroomSimilarity
        * bathroomSimilarity
        * recencyWeight
        * sourceQualityWeight
        * clamp(criticalCompleteness, 0.50, 1),
    );
    const sourceCode = externalSource?.sourceCode || 'towers-internal';
    const dedupeKey = externalSource?.syndicationKey
      ? `syndicated|${externalSource.syndicationKey}`
      : externalSource?.externalReference
        ? `${sourceCode}|${externalSource.externalReference}`
        : hasCoordinates
          ? [
              'point',
              Math.round(candidate.latitude! * 10_000),
              Math.round(candidate.longitude! * 10_000),
              Math.round(surfaceM2 / 2),
              Math.round((candidate.bedrooms || 0) * 2),
              Math.round((candidate.bathrooms || 0) * 2),
            ].join('|')
          : `property|${candidate.id}`;

    return [{
      propertyId: candidate.id,
      marketObservationId: externalSource?.marketObservationId,
      sourceCode,
      title: candidate.title,
      location: candidate.location,
      operation,
      price: offering.priceAmount,
      currency: 'MXN',
      surfaceM2,
      pricePerM2: offering.priceAmount / surfaceM2,
      distanceMeters: distanceMeters === null ? null : Math.round(distanceMeters),
      weight: Number(baseWeight.toFixed(6)),
      observedAt,
      verifiedAt,
      adjustedPrice: adjustedComparablePrice(target, candidate, offering.priceAmount),
      marketKey: targetMarketKey,
      dedupeKey,
      hasCoordinates,
      hasVerifiedDistance,
      hasAreaPrecision,
      criticalCompleteness,
      roomCompleteness,
      baseWeight,
      surfaceBuilt: isPositiveFinite(candidate.surfaceBuilt) ? candidate.surfaceBuilt : null,
      surfaceTotal: isPositiveFinite(candidate.surfaceTotal) ? candidate.surfaceTotal : null,
      bedrooms: isPositiveFinite(candidate.bedrooms) ? candidate.bedrooms : null,
      bathrooms: isPositiveFinite(candidate.bathrooms) ? candidate.bathrooms : null,
    }];
  });

  // The same home is frequently syndicated to several portals. Counting it
  // repeatedly would create false confidence, so retain only the strongest
  // observation for an equivalent price/surface/room signature.
  const uniqueByListing = new Map<string, ComparableCandidate>();
  for (const candidate of rawCandidates) {
    const existing = uniqueByListing.get(candidate.dedupeKey);
    if (!existing || candidate.weight > existing.weight) {
      uniqueByListing.set(candidate.dedupeKey, candidate);
    }
  }
  const likelySameListing = (first: ComparableCandidate, second: ComparableCandidate): boolean => {
    if (
      !first.marketObservationId
      || !second.marketObservationId
      || first.sourceCode === second.sourceCode
      || first.marketKey !== second.marketKey
      || first.operation !== second.operation
      || Math.abs(first.price - second.price) / Math.max(first.price, second.price) > 0.01
    ) return false;
    const bedroomsMatch = first.bedrooms === null
      || second.bedrooms === null
      || first.bedrooms === second.bedrooms;
    const bathroomsMatch = first.bathrooms === null
      || second.bathrooms === null
      || Math.abs(first.bathrooms - second.bathrooms) <= 0.5;
    if (!bedroomsMatch || !bathroomsMatch) return false;
    const builtMatches = first.surfaceBuilt && second.surfaceBuilt
      ? Math.abs(first.surfaceBuilt - second.surfaceBuilt) <= Math.max(5, Math.min(first.surfaceBuilt, second.surfaceBuilt) * 0.03)
      : false;
    const totalMatches = first.surfaceTotal && second.surfaceTotal
      ? Math.abs(first.surfaceTotal - second.surfaceTotal) <= Math.max(5, Math.min(first.surfaceTotal, second.surfaceTotal) * 0.03)
      : false;
    const selectedSurfaceMatches = Math.abs(first.surfaceM2 - second.surfaceM2)
      <= Math.max(5, Math.min(first.surfaceM2, second.surfaceM2) * 0.03);
    return builtMatches || totalMatches || selectedSurfaceMatches;
  };

  const crossPortalDeduped: ComparableCandidate[] = [];
  for (const candidate of uniqueByListing.values()) {
    const duplicateIndex = crossPortalDeduped.findIndex((existing) => likelySameListing(existing, candidate));
    if (duplicateIndex < 0) {
      crossPortalDeduped.push(candidate);
    } else if (candidate.baseWeight > crossPortalDeduped[duplicateIndex].baseWeight) {
      crossPortalDeduped[duplicateIndex] = candidate;
    }
  }
  return removeAdjustedPriceOutliers(crossPortalDeduped);
};

const sampleDiagnostics = (candidates: ComparableCandidate[]) => {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  const squaredWeightSum = candidates.reduce((sum, candidate) => sum + candidate.weight ** 2, 0);
  const effectiveSampleSize = squaredWeightSum > 0 ? totalWeight ** 2 / squaredWeightSum : 0;
  const maxWeightShare = totalWeight > 0
    ? Math.max(...candidates.map((candidate) => candidate.weight / totalWeight))
    : 1;
  const fullEstimate = candidates.length > 0 ? weightedMedian(candidates) : 0;
  const leaveOneOutVariation = candidates.length > 1 && fullEstimate > 0
    ? Math.max(...candidates.map((_, index) => {
        const reduced = candidates.filter((_candidate, candidateIndex) => candidateIndex !== index);
        return Math.abs(weightedMedian(reduced) - fullEstimate) / fullEstimate;
      }))
    : 1;

  const sourceCount = new Set(candidates.map((candidate) => candidate.sourceCode || 'unknown')).size;
  const sourceWeights = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const source = candidate.sourceCode || 'unknown';
    sourceWeights.set(source, (sourceWeights.get(source) || 0) + candidate.weight);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const maxSourceWeightShare = totalWeight > 0
    ? Math.max(0, ...[...sourceWeights.values()].map((weight) => weight / totalWeight))
    : 1;
  const qualifiedSourceCount = [...sourceCounts.values()]
    .filter((count) => count >= MIN_COMPARABLES_PER_SOURCE).length;
  const pricesPerM2 = candidates.map((candidate) => candidate.pricePerM2).sort((a, b) => a - b);
  const pricePerM2Center = median(pricesPerM2);
  const pricePerM2Spread = pricePerM2Center > 0
    ? (quantile(pricesPerM2, 0.80) - quantile(pricesPerM2, 0.20)) / pricePerM2Center
    : 1;
  const geolocatedShare = candidates.length > 0
    ? candidates.filter((candidate) => candidate.hasVerifiedDistance).length / candidates.length
    : 0;
  const criticalCompleteness = candidates.length > 0
    ? candidates.reduce((sum, candidate) => sum + candidate.criticalCompleteness, 0) / candidates.length
    : 0;
  return {
    effectiveSampleSize,
    maxWeightShare,
    leaveOneOutVariation,
    sourceCount,
    qualifiedSourceCount,
    maxSourceWeightShare,
    pricePerM2Spread,
    geolocatedShare,
    criticalCompleteness,
  };
};

const calculateConfidenceScore = (
  candidates: ComparableCandidate[],
  maxDistanceMeters: number,
): number => {
  if (candidates.length === 0) return 0;
  const values = candidates.map((candidate) => candidate.adjustedPrice).sort((a, b) => a - b);
  const center = median(values);
  const relativeSpread = center > 0 ? (quantile(values, 0.75) - quantile(values, 0.25)) / center : 1;
  const averageDistance = candidates.reduce(
    (sum, candidate) => sum + (candidate.distanceMeters ?? maxDistanceMeters),
    0,
  ) / candidates.length;
  const countScore = Math.min(45, candidates.length / 8 * 45);
  const distanceScore = Math.max(0, 25 * (1 - averageDistance / maxDistanceMeters));
  const consistencyScore = Math.max(0, 20 * (1 - relativeSpread));
  const diagnostics = sampleDiagnostics(candidates);
  const completenessScore = 15 * diagnostics.criticalCompleteness;
  const sourceDiversityScore = Math.min(10, Math.max(0, new Set(
    candidates.map((candidate) => candidate.sourceCode || 'unknown'),
  ).size - 1) * 5);
  const geolocationScore = 10 * diagnostics.geolocatedShare;
  return Math.round(Math.min(
    100,
    countScore + distanceScore + consistencyScore + completenessScore + sourceDiversityScore + geolocationScore,
  ));
};

const estimateStrictMarket = (
  target: Property,
  baseCandidates: ComparableCandidate[],
  minComparables: number,
  maxDistanceMeters: number,
): MarketEstimate => {
  const candidates = baseCandidates
    .filter((candidate) => candidate.distanceMeters === null || candidate.distanceMeters <= maxDistanceMeters)
    .map((candidate) => {
      const distanceWeight = candidate.distanceMeters === null
        ? 1 / (1 + maxDistanceMeters / 3_000)
        : 1 / (1 + candidate.distanceMeters / 3_000);
      return {
        ...candidate,
        weight: candidate.baseWeight * distanceWeight * (candidate.hasVerifiedDistance ? 1 : 0.45),
      };
    });
  const surface = getSurface(target);
  const diagnostics = sampleDiagnostics(candidates);
  const confidenceScore = calculateConfidenceScore(candidates, maxDistanceMeters);
  const rejectionReasons: string[] = [];
  if (!hasValidMexicoCoordinates(target)) {
    rejectionReasons.push('La propiedad no tiene coordenadas verificadas para una estimación por distancia.');
  }
  if (candidates.length < minComparables) {
    rejectionReasons.push(`Se requieren ${minComparables} comparables del mismo micromercado; se encontraron ${candidates.length}.`);
  }
  if (candidates.length >= minComparables) {
    if (diagnostics.effectiveSampleSize < MIN_EFFECTIVE_SAMPLE_SIZE) {
      rejectionReasons.push(`El tamaño efectivo de la muestra es ${diagnostics.effectiveSampleSize.toFixed(1)}; debe ser al menos ${MIN_EFFECTIVE_SAMPLE_SIZE}.`);
    }
    if (diagnostics.maxWeightShare > MAX_COMPARABLE_WEIGHT_SHARE) {
      rejectionReasons.push('Un solo comparable concentra más del 25% del peso de la estimación.');
    }
    if (diagnostics.leaveOneOutVariation > MAX_LEAVE_ONE_OUT_VARIATION) {
      rejectionReasons.push('La estimación cambia más del 10% al retirar un comparable.');
    }
    if (diagnostics.sourceCount < MIN_SOURCE_COUNT || diagnostics.qualifiedSourceCount < MIN_SOURCE_COUNT) {
      rejectionReasons.push(`Se requieren al menos ${MIN_SOURCE_COUNT} fuentes independientes con ${MIN_COMPARABLES_PER_SOURCE} comparables cada una.`);
    }
    if (diagnostics.maxSourceWeightShare > MAX_SOURCE_WEIGHT_SHARE) {
      rejectionReasons.push('Una sola fuente concentra más del 60% del peso de la estimación.');
    }
    if (diagnostics.pricePerM2Spread > MAX_PRICE_PER_M2_SPREAD) {
      rejectionReasons.push('La dispersión central del precio por m² supera el 45% permitido.');
    }
    if (diagnostics.geolocatedShare < MIN_GEOLOCATED_SHARE) {
      rejectionReasons.push('Menos del 60% de los comparables tiene coordenadas verificables; no se inventan distancias.');
    }
    if (diagnostics.criticalCompleteness < MIN_CRITICAL_COMPLETENESS) {
      rejectionReasons.push('La completitud media de los campos críticos es menor al 80%.');
    }
    if (confidenceScore < MIN_PUBLIC_CONFIDENCE_SCORE) {
      rejectionReasons.push(`La confianza calculada es ${confidenceScore}; debe ser al menos ${MIN_PUBLIC_CONFIDENCE_SCORE}.`);
    }
  }

  if (!surface || rejectionReasons.length > 0) {
    return {
      estimate: null,
      rangeLow: null,
      rangeHigh: null,
      pricePerM2: null,
      comparables: candidates,
      confidenceScore,
      rejectionReasons,
      ...diagnostics,
      evidenceTier: 'INSUFFICIENT',
    };
  }

  const adjustedPrices = candidates.map((candidate) => candidate.adjustedPrice).sort((a, b) => a - b);
  const estimate = weightedMedian(candidates);
  return {
    estimate: Math.round(estimate),
    rangeLow: Math.round(quantile(adjustedPrices, 0.20)),
    rangeHigh: Math.round(quantile(adjustedPrices, 0.80)),
    pricePerM2: Math.round(estimate / surface),
    comparables: [...candidates].sort((a, b) => b.weight - a.weight),
    confidenceScore,
    rejectionReasons,
    ...diagnostics,
    evidenceTier: 'STRICT_ESTIMATE',
  };
};

const estimateAreaReference = (
  target: Property,
  baseCandidates: ComparableCandidate[],
): MarketEstimate => {
  const surface = getSurface(target);
  const candidates = balanceWeightsBySource(
    baseCandidates.filter((candidate) => candidate.hasAreaPrecision),
  );
  const diagnostics = sampleDiagnostics(candidates);
  const sourceGroups = new Map<string, ComparableCandidate[]>();
  for (const candidate of candidates) {
    const source = candidate.sourceCode || 'unknown';
    sourceGroups.set(source, [...(sourceGroups.get(source) || []), candidate]);
  }
  const sourceMedians = [...sourceGroups.values()]
    .map((group) => weightedMedian(group))
    .filter((value) => value > 0);
  const sourceMedianRatio = sourceMedians.length > 0
    ? Math.max(...sourceMedians) / Math.min(...sourceMedians)
    : Number.POSITIVE_INFINITY;
  const center = weightedMedian(candidates);
  const adjustedPriceSpread = center > 0
    ? (weightedQuantile(candidates, 0.80) - weightedQuantile(candidates, 0.20)) / center
    : 1;
  const areaPrecisionShare = candidates.length > 0
    ? candidates.filter((candidate) => candidate.hasAreaPrecision).length / candidates.length
    : 0;
  const roomCompleteness = candidates.length > 0
    ? candidates.reduce((sum, candidate) => sum + candidate.roomCompleteness, 0) / candidates.length
    : 0;
  const sampleScore = candidates.length >= 8 ? 18 : candidates.length >= 5 ? 15 : candidates.length >= 3 ? 12 : 0;
  const sourceScore = diagnostics.sourceCount >= 2 ? 8 : diagnostics.sourceCount === 1 ? 4 : 0;
  const confidenceScore = Math.min(64, Math.round(
    sampleScore
      + Math.min(12, diagnostics.effectiveSampleSize / MIN_AREA_EFFECTIVE_SAMPLE_SIZE * 12)
      + Math.max(0, 14 * (1 - adjustedPriceSpread / MAX_AREA_ADJUSTED_PRICE_SPREAD))
      + sourceScore
      + 8 * diagnostics.criticalCompleteness
      + 6 * roomCompleteness
      + Math.max(0, 8 * (1 - diagnostics.leaveOneOutVariation / MAX_AREA_LEAVE_ONE_OUT_VARIATION))
  ));
  const rejectionReasons: string[] = [];
  const targetMarketKey = getPropertyMicroMarketKey(target);

  if (!surface) {
    rejectionReasons.push('Falta una superficie válida para construir la referencia del micromercado.');
  }
  if (!targetMarketKey.includes('|')) {
    rejectionReasons.push('Falta un micromercado exacto; una ciudad completa no se usa como referencia.');
  }
  if (candidates.length < MIN_AREA_REFERENCE_COMPARABLES) {
    rejectionReasons.push(`La estimación comercial requiere ${MIN_AREA_REFERENCE_COMPARABLES} propiedades comparables; se encontraron ${candidates.length}.`);
  }
  if (diagnostics.sourceCount < MIN_AREA_SOURCE_COUNT || diagnostics.qualifiedSourceCount < MIN_AREA_SOURCE_COUNT) {
    rejectionReasons.push(`Se requiere al menos ${MIN_AREA_SOURCE_COUNT} fuente con ${MIN_AREA_COMPARABLES_PER_SOURCE} propiedades comparables.`);
  }
  if (diagnostics.effectiveSampleSize < MIN_AREA_EFFECTIVE_SAMPLE_SIZE) {
    rejectionReasons.push(`El tamaño efectivo del área es ${diagnostics.effectiveSampleSize.toFixed(1)}; debe ser al menos ${MIN_AREA_EFFECTIVE_SAMPLE_SIZE}.`);
  }
  if (diagnostics.maxWeightShare > MAX_AREA_COMPARABLE_WEIGHT_SHARE) {
    rejectionReasons.push('Una propiedad concentra más del 50% del peso de la estimación comercial.');
  }
  if (diagnostics.leaveOneOutVariation > MAX_AREA_LEAVE_ONE_OUT_VARIATION) {
    rejectionReasons.push('La estimación cambia más del 25% al retirar una propiedad comparable.');
  }
  if (adjustedPriceSpread > MAX_AREA_ADJUSTED_PRICE_SPREAD) {
    rejectionReasons.push('La dispersión de los precios comparables supera el 70%.');
  }
  if (sourceMedians.length > 1 && sourceMedianRatio > MAX_AREA_SOURCE_MEDIAN_RATIO) {
    rejectionReasons.push('Las medianas entre fuentes difieren más del 45%.');
  }
  if (diagnostics.criticalCompleteness < MIN_AREA_CRITICAL_COMPLETENESS) {
    rejectionReasons.push('La completitud media de los comparables es menor al 70%.');
  }
  if (roomCompleteness < MIN_AREA_ROOM_COMPLETENESS) {
    rejectionReasons.push('Menos de la mitad de los comparables informa recámaras y baños.');
  }
  if (areaPrecisionShare < 1) {
    rejectionReasons.push('La muestra incluye ubicaciones a nivel ciudad o sin micromercado verificable.');
  }
  if (confidenceScore < MIN_AREA_EVIDENCE_SCORE) {
    rejectionReasons.push(`La evidencia del área obtuvo ${confidenceScore}; debe alcanzar ${MIN_AREA_EVIDENCE_SCORE}.`);
  }

  if (!surface || rejectionReasons.length > 0) {
    return {
      estimate: null,
      rangeLow: null,
      rangeHigh: null,
      pricePerM2: null,
      comparables: candidates,
      confidenceScore,
      rejectionReasons,
      ...diagnostics,
      pricePerM2Spread: adjustedPriceSpread,
      evidenceTier: 'INSUFFICIENT',
    };
  }

  return {
    estimate: Math.round(center),
    rangeLow: Math.round(weightedQuantile(candidates, 0.20)),
    rangeHigh: Math.round(weightedQuantile(candidates, 0.80)),
    pricePerM2: Math.round(center / surface),
    comparables: [...candidates].sort((a, b) => b.weight - a.weight),
    confidenceScore,
    rejectionReasons,
    ...diagnostics,
    pricePerM2Spread: adjustedPriceSpread,
    evidenceTier: 'AREA_REFERENCE',
  };
};

const confidenceFromScore = (
  score: number,
  hasEstimate: boolean,
  comparableCount: number,
  sourceCount: number,
  evidenceTier: MarketEstimate['evidenceTier'],
): PropertyValuationConfidence => {
  if (!hasEstimate) return 'INSUFFICIENT';
  if (evidenceTier === 'AREA_REFERENCE') return 'LOW';
  if (score >= 82 && comparableCount >= 10 && sourceCount >= 3) return 'HIGH';
  if (score >= MIN_PUBLIC_CONFIDENCE_SCORE && comparableCount >= DEFAULT_MIN_VALUATION_COMPARABLES) return 'MEDIUM';
  return 'INSUFFICIENT';
};

const newestEvidenceDate = (candidates: ComparableCandidate[], fallback: Date): string => {
  const timestamps = candidates
    .map((candidate) => candidate.verifiedAt ? new Date(candidate.verifiedAt).getTime() : Number.NaN)
    .filter(Number.isFinite);
  return new Date(timestamps.length > 0 ? Math.max(...timestamps) : fallback.getTime()).toISOString();
};

const getListingOffering = (property: Property): PropertyOffering | undefined => (
  activeOfferingFor(property, 'SALE') || activeOfferingFor(property, 'MONTHLY_RENT')
);

const calculateCapRate = (
  property: Property,
  estimatedSaleValue: number | null,
  estimatedMonthlyRent: number | null,
): number | null => {
  if (!estimatedSaleValue || !estimatedMonthlyRent) return null;
  const offering = property.offerings?.find((candidate) => candidate.status === 'ACTIVE');
  if (!offering) return null;
  const declaredAnnualExpenses = (offering.annualPropertyTax || 0)
    + ((property.maintenanceFeeAmount || 0)
      + (offering.waterMonthlyAvg || 0)
      + (offering.electricityMonthlyAvg || 0)
      + (offering.gasMonthlyAvg || 0)) * 12;
  if (declaredAnnualExpenses <= 0) return null;
  const netOperatingIncome = estimatedMonthlyRent * 12 - declaredAnnualExpenses;
  return netOperatingIncome > 0
    ? Number((netOperatingIncome / estimatedSaleValue * 100).toFixed(2))
    : null;
};

export class ValuationEngine {
  public static evaluate(
    target: Property,
    catalog: ValuationCatalogProperty[],
    options: ValuationEngineOptions = {},
  ): PropertyValuation {
    const minComparables = Math.max(
      DEFAULT_MIN_VALUATION_COMPARABLES,
      Math.floor(options.minComparables || DEFAULT_MIN_VALUATION_COMPARABLES),
    );
    const maxDistanceMeters = Math.max(1_000, options.maxDistanceMeters || DEFAULT_MAX_COMPARABLE_DISTANCE_METERS);
    const now = options.now || new Date();
    const warnings: string[] = [];
    const targetSurface = getSurface(target);

    if (!hasValidMexicoCoordinates(target)) {
      warnings.push('La propiedad no tiene coordenadas válidas dentro de México.');
    }
    if (!targetSurface) {
      warnings.push('Falta una superficie construida o total válida para calcular el valor por metro cuadrado.');
    }
    const targetMarketKey = getPropertyMicroMarketKey(target);
    if (!targetMarketKey || !targetMarketKey.includes('|')) {
      warnings.push('Falta una colonia, desarrollo o micromercado identificable.');
    }

    const saleCandidates = buildCandidates(target, catalog, 'SALE', maxDistanceMeters, now);
    const rentCandidates = buildCandidates(target, catalog, 'MONTHLY_RENT', maxDistanceMeters, now);
    const saleStrict = estimateStrictMarket(target, saleCandidates, minComparables, maxDistanceMeters);
    const rentStrict = estimateStrictMarket(target, rentCandidates, minComparables, maxDistanceMeters);
    const saleArea = estimateAreaReference(target, saleCandidates);
    const rentArea = estimateAreaReference(target, rentCandidates);
    const sale = saleStrict.estimate !== null ? saleStrict : saleArea;
    const rent = rentStrict.estimate !== null ? rentStrict : rentArea;

    const listingOffering = getListingOffering(target);
    const listingPrice = listingOffering?.priceAmount && listingOffering.priceAmount > 0
      ? listingOffering.priceAmount
      : null;
    const primaryStrict = listingOffering?.mode === 'MONTHLY_RENT' ? rentStrict : saleStrict;
    const primaryArea = listingOffering?.mode === 'MONTHLY_RENT' ? rentArea : saleArea;
    const primaryMarket = primaryStrict.estimate !== null ? primaryStrict : primaryArea;
    const primaryEstimate = primaryStrict.estimate;
    const listingVsEstimatePct = listingPrice && primaryEstimate
      ? Number(((listingPrice - primaryEstimate) / primaryEstimate * 100).toFixed(2))
      : null;
    const grossRentalYield = saleStrict.estimate && rentStrict.estimate
      ? Number((rentStrict.estimate * 12 / saleStrict.estimate * 100).toFixed(2))
      : null;
    if (primaryMarket.evidenceTier === 'AREA_REFERENCE') {
      warnings.push('Estimación comercial aproximada basada en precios anunciados del mismo micromercado; no es un avalúo ni representa operaciones cerradas.');
    } else {
      warnings.push(...primaryMarket.rejectionReasons);
    }
    const hasPrimaryEstimate = primaryMarket.estimate !== null;
    const confidenceScore = hasPrimaryEstimate
      ? primaryMarket.confidenceScore
      : Math.max(sale.confidenceScore, rent.confidenceScore);
    const combinedComparables = [...primaryMarket.comparables]
      .sort((a, b) => b.weight - a.weight)
      .map(({
        observedAt: _observedAt,
        verifiedAt: _verifiedAt,
        adjustedPrice: _adjustedPrice,
        marketKey: _marketKey,
        dedupeKey: _dedupeKey,
        hasCoordinates: _hasCoordinates,
        hasVerifiedDistance: _hasVerifiedDistance,
        hasAreaPrecision: _hasAreaPrecision,
        criticalCompleteness: _criticalCompleteness,
        roomCompleteness: _roomCompleteness,
        baseWeight: _baseWeight,
        surfaceBuilt: _surfaceBuilt,
        surfaceTotal: _surfaceTotal,
        bedrooms: _bedrooms,
        bathrooms: _bathrooms,
        ...comparable
      }) => comparable);

    const isAreaReference = primaryMarket.evidenceTier === 'AREA_REFERENCE';
    const evidenceTier = hasPrimaryEstimate ? primaryMarket.evidenceTier : 'INSUFFICIENT';

    return {
      propertyId: target.id,
      currency: 'MXN',
      estimatedSaleValue: saleStrict.estimate,
      saleRangeLow: saleStrict.rangeLow,
      saleRangeHigh: saleStrict.rangeHigh,
      salePricePerM2: saleStrict.pricePerM2,
      estimatedMonthlyRent: rentStrict.estimate,
      rentRangeLow: rentStrict.rangeLow,
      rentRangeHigh: rentStrict.rangeHigh,
      rentPricePerM2: rentStrict.pricePerM2,
      estimatedCapRate: calculateCapRate(target, saleStrict.estimate, rentStrict.estimate),
      grossRentalYield,
      listingPrice,
      listingVsEstimatePct,
      areaReferenceValue: isAreaReference ? primaryMarket.estimate : null,
      areaRangeLow: isAreaReference ? primaryMarket.rangeLow : null,
      areaRangeHigh: isAreaReference ? primaryMarket.rangeHigh : null,
      areaPricePerM2: isAreaReference ? primaryMarket.pricePerM2 : null,
      areaReferenceOperation: isAreaReference
        ? (listingOffering?.mode === 'MONTHLY_RENT' ? 'MONTHLY_RENT' : 'SALE')
        : null,
      areaLocationBasis: isAreaReference ? 'NEIGHBORHOOD' : null,
      confidence: confidenceFromScore(
        confidenceScore,
        hasPrimaryEstimate,
        primaryMarket.comparables.length,
        primaryMarket.sourceCount,
        evidenceTier,
      ),
      evidenceTier,
      confidenceScore,
      comparableCount: primaryMarket.comparables.length,
      saleComparableCount: sale.comparables.length,
      rentComparableCount: rent.comparables.length,
      dataAsOf: newestEvidenceDate(primaryMarket.comparables, now),
      modelVersion: VALUATION_MODEL_VERSION,
      methodology: isAreaReference
        ? 'Towers Estimación Comercial v1: desde tres precios anunciados del mismo micromercado, tipo y operación; elimina posibles duplicados, homologa superficies y controla dispersión y estabilidad. Es un rango aproximado de mercado, no un avalúo ni un precio de cierre garantizado.'
        : 'Towers Market v5: inventario autorizado y observaciones públicas de investigación del mismo micromercado y tipo con distancias verificadas, vigencia, deduplicación, homologación de terreno y construcción, diversidad de fuentes, dispersión, dominancia y estabilidad. Los anuncios son precios solicitados, no operaciones cerradas ni avalúos certificados.',
      warnings: [...new Set(warnings)],
      comparables: combinedComparables,
    };
  }
}
