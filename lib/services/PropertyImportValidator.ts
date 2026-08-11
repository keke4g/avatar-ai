import { Property } from '../types';
import {
  PropertyValidationError,
  PropertyValidationStage,
  PropertyValidator,
} from './PropertyValidator';

export interface PropertyImportRow {
  rowNumber: number;
  property: Partial<Property>;
}

export interface ValidPropertyImportRow extends PropertyImportRow {
  deduplicationKey: string;
  warnings: PropertyValidationError[];
}

export interface InvalidPropertyImportRow extends PropertyImportRow {
  errors: PropertyValidationError[];
  duplicateOfRow?: number;
}

export interface PropertyImportValidationResult {
  accepted: ValidPropertyImportRow[];
  rejected: InvalidPropertyImportRow[];
}

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

/**
 * Stable keys favor trusted identifiers, then precise address/coordinates.
 * A weak title-only match is deliberately avoided to prevent false positives.
 */
export const getPropertyDeduplicationKey = (property: Partial<Property>): string => {
  if (property.internalCode) return `code:${normalize(property.internalCode)}`;
  if (property.placeId) return `place:${normalize(property.placeId)}`;

  const street = normalize(property.streetName || property.address);
  const streetNumber = normalize(property.streetNumber);
  const postalCode = normalize(property.postalCode);
  const address = [
    street,
    streetNumber,
    postalCode,
    property.city || property.location,
    property.state,
    property.country,
  ].map(normalize).filter(Boolean).join('|');
  if (street && (streetNumber || postalCode)) return `address:${address}`;

  if (property.latitude != null && property.longitude != null) {
    return `geo:${Number(property.latitude).toFixed(5)}:${Number(property.longitude).toFixed(5)}`;
  }
  return '';
};

export const validatePropertyImportBatch = (
  rows: PropertyImportRow[],
  existingProperties: Partial<Property>[] = [],
  stage: PropertyValidationStage = 'REVIEW',
): PropertyImportValidationResult => {
  const accepted: ValidPropertyImportRow[] = [];
  const rejected: InvalidPropertyImportRow[] = [];
  const seen = new Map<string, number>();

  existingProperties.forEach((property, index) => {
    const key = getPropertyDeduplicationKey(property);
    if (key) seen.set(key, -(index + 1));
  });

  rows.forEach((row) => {
    const validation = PropertyValidator.validatePropertyBeforeInsert(row.property, stage);
    const key = getPropertyDeduplicationKey(row.property);
    const duplicate = key ? seen.get(key) : undefined;
    const errors = [...validation.errors];

    if (!key) {
      errors.push({
        field: 'deduplication',
        message: 'Falta folio, Place ID, dirección o coordenadas para detectar duplicados.',
      });
    } else if (duplicate !== undefined) {
      errors.push({
        field: 'deduplication',
        message: duplicate < 0
          ? 'La propiedad ya existe en el inventario.'
          : `La propiedad está duplicada en la fila ${duplicate}.`,
      });
    }

    if (errors.length > 0) {
      rejected.push({
        ...row,
        errors,
        duplicateOfRow: duplicate && duplicate > 0 ? duplicate : undefined,
      });
      return;
    }

    seen.set(key, row.rowNumber);
    accepted.push({
      ...row,
      deduplicationKey: key,
      warnings: validation.warnings,
    });
  });

  return { accepted, rejected };
};
