import { Property } from '../types';

export interface PropertyValidationError {
  field: string;
  message: string;
}

export interface PropertyValidationResult {
  success: boolean;
  errors: PropertyValidationError[];
  warnings: PropertyValidationError[];
}

export type PropertyValidationStage = 'DRAFT' | 'REVIEW' | 'PUBLICATION';

const normalizeCountry = (country: string) => country
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const getImageUrls = (property: Partial<Property>): string[] => {
  const fromImages = property.images || [];
  const fromMedia = (property.media || [])
    .filter((item) => item.mediaType === 'IMAGE' && !item.deletedAt)
    .map((item) => item.url);
  return [...new Set([...fromImages, ...fromMedia].filter(Boolean))];
};

const getStage = (
  property: Partial<Property>,
  requested?: PropertyValidationStage,
): PropertyValidationStage => {
  if (requested) return requested;
  if (property.isPublished === true || property.folderStatus === 'PUBLISHED') return 'PUBLICATION';
  if (property.folderStatus === 'DRAFT') return 'DRAFT';
  return 'REVIEW';
};

const validateCoordinates = (
  property: Partial<Property>,
  errors: PropertyValidationError[],
) => {
  if (!isFiniteNumber(property.latitude)) {
    errors.push({ field: 'latitude', message: 'Selecciona una latitud válida en el mapa.' });
  } else if (property.latitude < -90 || property.latitude > 90) {
    errors.push({ field: 'latitude', message: 'La latitud debe estar entre -90 y 90.' });
  }

  if (!isFiniteNumber(property.longitude)) {
    errors.push({ field: 'longitude', message: 'Selecciona una longitud válida en el mapa.' });
  } else if (property.longitude < -180 || property.longitude > 180) {
    errors.push({ field: 'longitude', message: 'La longitud debe estar entre -180 y 180.' });
  }

  if (
    !property.country
    || !isFiniteNumber(property.latitude)
    || !isFiniteNumber(property.longitude)
  ) return;

  const country = normalizeCountry(property.country);
  const { latitude, longitude } = property;

  // Bounding box intentionally allows Mexico's islands and border precision.
  if (
    (country === 'MEXICO' || country === 'MX')
    && (latitude < 14 || latitude > 33.5 || longitude < -118.5 || longitude > -86)
  ) {
    errors.push({
      field: 'location',
      message: 'Las coordenadas no corresponden al país indicado (México).',
    });
  }
};

export class PropertyValidator {
  /**
   * Validates a record before persistence. Review/publication are quality gates;
   * drafts can remain incomplete and are validated by the wizard step-by-step.
   */
  public static validatePropertyBeforeInsert(
    property: Partial<Property>,
    requestedStage?: PropertyValidationStage,
  ): PropertyValidationResult {
    const errors: PropertyValidationError[] = [];
    const warnings: PropertyValidationError[] = [];
    const stage = getStage(property, requestedStage);

    if (!property.hostId) {
      errors.push({ field: 'hostId', message: 'La persona responsable de la propiedad es obligatoria.' });
    }

    if (stage === 'DRAFT') {
      return { success: errors.length === 0, errors, warnings };
    }

    if (!property.title?.trim()) {
      errors.push({ field: 'title', message: 'El título es obligatorio.' });
    }
    if (!property.description?.trim()) {
      warnings.push({ field: 'description', message: 'La descripción está pendiente de completar.' });
    }
    if (!property.type) warnings.push({ field: 'type', message: 'El tipo de propiedad se completará durante la revisión.' });
    if (!property.valueRating) {
      warnings.push({ field: 'valueRating', message: 'La categoría comercial se completará durante la revisión.' });
    }
    if (!property.location?.trim()) errors.push({ field: 'location', message: 'La ubicación es obligatoria.' });
    validateCoordinates(property, errors);

    const hasPrice = (property.offerings || []).some((offering) => (
      offering.mode === 'SWAP'
        ? [offering.swapEstimatedValue, offering.swapMinValue, offering.swapMaxValue]
          .some((value) => isFiniteNumber(value) && value > 0)
        : isFiniteNumber(offering.priceAmount) && offering.priceAmount > 0
    ));
    if (!hasPrice) {
      errors.push({ field: 'price', message: 'Indica un precio mayor a cero.' });
    }

    const images = getImageUrls(property);
    if (images.length < 1) {
      errors.push({
        field: 'images',
        message: 'Sube al menos una foto para enviar la propiedad a revisión.',
      });
    } else if (images.length < 5) {
      warnings.push({ field: 'images', message: 'Se recomiendan 5 o más fotos para un anuncio completo.' });
    }
    images.forEach((image, index) => {
      if (!isHttpUrl(image)) {
        errors.push({ field: 'images', message: `La foto ${index + 1} no tiene una URL HTTP válida.` });
      }
    });

    const legalFacts = [
      property.legalDebtFree,
      property.legalPublicDeed,
      property.legalTaxCurrent,
      property.legalServicesPaid,
    ];
    if (legalFacts.some((value) => value == null)) {
      warnings.push({
        field: 'legal',
        message: 'El expediente contiene datos no verificados; se mostrará como pendiente.',
      });
    }
    if (property.legalDocumentationComplete === true && legalFacts.some((value) => value !== true)) {
      warnings.push({
        field: 'legalDocumentationComplete',
        message: 'El expediente se revisará porque contiene datos negativos o sin verificar.',
      });
    }

    return { success: errors.length === 0, errors, warnings };
  }

  public static validateForPublication(property: Partial<Property>): PropertyValidationResult {
    return this.validatePropertyBeforeInsert(property, 'PUBLICATION');
  }

  public static validateStep(step: number, data: Partial<Property> & Record<string, any>): PropertyValidationResult {
    if (step === 2) {
      const errors: PropertyValidationError[] = [];
      if (!data.city?.trim()) errors.push({ field: 'city', message: 'La ciudad es obligatoria.' });
      if (!data.location?.trim()) errors.push({ field: 'location', message: 'La ubicación es obligatoria.' });
      validateCoordinates(data, errors);
      return { success: errors.length === 0, errors, warnings: [] };
    }

    if (step === 1) {
      const errors: PropertyValidationError[] = [];
      if (!data.title?.trim()) errors.push({ field: 'title', message: 'El título es obligatorio.' });
      return { success: errors.length === 0, errors, warnings: [] };
    }

    // Reuse the complete gate for the final multimedia step.
    if (step === 9) {
      const images = getImageUrls(data);
      const errors = images.length < 1
        ? [{ field: 'images', message: 'Sube al menos una foto para enviar a revisión.' }]
        : [];
      return { success: errors.length === 0, errors, warnings: [] };
    }

    const errors: PropertyValidationError[] = [];
    if (step === 6 && data.selectedModes?.includes('SWAP')) {
      const price = Number(data.salePrice);
      if (!Number.isFinite(price) || price <= 0) {
        errors.push({ field: 'price', message: 'El valor estimado debe ser mayor a cero.' });
      }
    }
    if (step === 7 && data.selectedModes?.some((mode: string) => ['RENT', 'SHORT_RENT', 'MONTHLY_RENT'].includes(mode))) {
      const price = Number(data.monthlyPrice || data.nightlyPrice);
      if (!Number.isFinite(price) || price <= 0) errors.push({ field: 'rentPrice', message: 'El precio de renta debe ser mayor a cero.' });
    }
    if (step === 8 && data.selectedModes?.includes('SALE')) {
      const price = Number(data.salePrice);
      if (!Number.isFinite(price) || price <= 0) errors.push({ field: 'salePrice', message: 'El precio de venta debe ser mayor a cero.' });
    }
    return { success: errors.length === 0, errors, warnings: [] };
  }
}
