import { Property } from '../types';

export interface CreditStatus {
  compatibles: string[];
  evaluables: string[];
  noCompatibles: { credit: string; reason: string }[];
}

export interface LegalEngineResult {
  status: 'GREEN' | 'YELLOW' | 'RED';
  label: string;
  explanation: string;
  warnings: string[];
}

export class LegalEngine {
  public static calculateStatus(property: Property): LegalEngineResult {
    const warnings: string[] = [];

    // Explicit negative evidence is critical. Missing evidence is never
    // converted into either a positive or a negative assertion.
    if (property.legalLienType === 'Embargo') {
      warnings.push('ATENCIÓN: Inmueble con proceso de embargo activo. La venta/renta está restringida jurídicamente hasta su resolución.');
    }
    if (property.legalPublicDeed === false) {
      warnings.push('La propiedad no cuenta con Escrituras Públicas inscritas. No es elegible para ningún tipo de crédito hipotecario.');
    }

    if (warnings.length > 0) {
      return {
        status: 'RED',
        label: 'Riesgo Jurídico',
        explanation: 'Se detectaron impedimentos legales críticos que restringen la enajenación o el financiamiento de la propiedad.',
        warnings
      };
    }

    if (property.legalDebtFree === false) {
      warnings.push('La propiedad cuenta con un gravamen activo o hipoteca pendiente por liquidar.');
    }
    if (property.legalTaxCurrent === false) {
      warnings.push('Se detectó adeudo en el pago de Predial o requiere actualización de pagos.');
    }
    if (property.legalServicesPaid === false) {
      warnings.push('Se reportan servicios pendientes de pago.');
    }

    if (warnings.length > 0) {
      return {
        status: 'YELLOW',
        label: 'Sujeto a Revisión',
        explanation: 'La documentación presenta advertencias o adeudos pendientes que deben solventarse antes de la firma.',
        warnings
      };
    }

    const unknownFacts = [
      ['escritura pública', property.legalPublicDeed],
      ['libertad de gravamen', property.legalDebtFree],
      ['predial', property.legalTaxCurrent],
      ['servicios', property.legalServicesPaid],
      ['integridad documental', property.legalDocumentationComplete],
    ].filter(([, value]) => value !== true);

    if (unknownFacts.length > 0) {
      return {
        status: 'YELLOW',
        label: 'Información no verificada',
        explanation: 'El expediente aún no cuenta con evidencia suficiente para emitir una conclusión jurídica favorable.',
        warnings: unknownFacts.map(([label]) => `Pendiente de verificar: ${label}.`),
      };
    }

    return {
      status: 'GREEN',
      label: 'Expediente verificado',
      explanation: 'Los datos jurídicos requeridos fueron marcados como verificados. Consulta siempre la evidencia y su fecha de vigencia.',
      warnings: []
    };
  }
}

export class CreditEngine {
  public static calculateEligibleCredits(property: Property): CreditStatus {
    const result: CreditStatus = {
      compatibles: [],
      evaluables: [],
      noCompatibles: []
    };

    const hasDeed = property.legalPublicDeed === true;
    const isEjidal = property.legalRegime === 'Ejidal';
    const isEmbargo = property.legalLienType === 'Embargo';
    const lienVerified = property.legalDebtFree != null;

    // 1. Contado: Always compatible if not blocked by Embargo
    if (isEmbargo) {
      result.noCompatibles.push({
        credit: 'Pago de Contado',
        reason: 'Restringido por proceso de embargo activo.'
      });
    } else if (property.legalDebtFree === true) {
      result.compatibles.push('Contado');
    } else {
      result.evaluables.push('Pago de Contado');
    }

    // List of credits we evaluate
    const mortgageCredits = [
      { name: 'Crédito Hipotecario Bancario', type: 'banco' },
      { name: 'Infonavit Individual', type: 'infonavit' },
      { name: 'Cofinavit', type: 'cofinavit' },
      { name: 'Unamos Créditos', type: 'unamos' },
      { name: 'Infonavit Conyugal', type: 'infonavit_conyugal' },
      { name: 'FOVISSSTE', type: 'fovissste' },
      { name: 'FOVISSSTE para Todos', type: 'fovissste_todos' },
      { name: 'Crédito mixto Banco + Infonavit', type: 'mixto_infonavit' },
      { name: 'Crédito mixto Banco + FOVISSSTE', type: 'mixto_fovissste' }
    ];

    for (const cred of mortgageCredits) {
      // Ineligibility checks first
      if (isEmbargo) {
        result.noCompatibles.push({
          credit: cred.name,
          reason: 'Restringido por proceso de embargo activo.'
        });
        continue;
      }

      if (!hasDeed) {
        if (property.legalPublicDeed === false) {
          result.noCompatibles.push({
            credit: cred.name,
            reason: 'Inmueble sin escrituras inscritas.'
          });
        } else {
          result.evaluables.push(cred.name);
        }
        continue;
      }

      if (isEjidal) {
        result.noCompatibles.push({
          credit: cred.name,
          reason: 'Régimen Ejidal no apto para créditos bancarios/institucionales.'
        });
        continue;
      }

      // Gravamen-specific restrictions
      if (!lienVerified) {
        result.evaluables.push(cred.name);
        continue;
      }

      if (property.legalDebtFree === false) {
        // FOVISSSTE is highly restrictive about existing liens of any kind
        if (cred.type.includes('fovissste')) {
          result.noCompatibles.push({
            credit: cred.name,
            reason: `Incompatible con gravámenes activos (${property.legalLienType}).`
          });
          continue;
        }

        // Infonavit can only liquidate Banco or Infonavit liens
        if (cred.type.includes('infonavit') || cred.type === 'cofinavit') {
          if (property.legalLienType !== 'Banco' && property.legalLienType !== 'Infonavit') {
            result.noCompatibles.push({
              credit: cred.name,
              reason: `Infonavit no liquida gravámenes de tipo: ${property.legalLienType}.`
            });
            continue;
          }
        }

        // Particular / private mortgages block general bank credits without prior liquidation
        if (property.legalLienType === 'Particular' || property.legalLienType === 'Hipoteca privada') {
          result.noCompatibles.push({
            credit: cred.name,
            reason: 'Hipoteca bancaria requiere cancelación de gravamen particular previo.'
          });
          continue;
        }
      }

      // If we passed all, classify into Compatible vs Evaluable
      if (cred.type.includes('infonavit') || cred.type.includes('fovissste') || cred.type === 'cofinavit') {
        result.evaluables.push(cred.name);
      } else {
        result.compatibles.push(cred.name);
      }
    }

    return result;
  }
}

export class CommercialEngine {
  public static getStatusDetails(property: Property): { label: string; color: string; description: string } {
    const status = property.commercialStatus || 'Sin confirmar';
    const statusDetails: Record<string, { label: string; color: string; description: string }> = {
      'Disponible': { label: 'Disponible', color: 'bg-emerald-500 text-white', description: 'La propiedad está lista para comercialización.' },
      'Apartada': { label: 'Apartada', color: 'bg-amber-500 text-white', description: 'Se ha recibido un depósito de apartado para detener ventas.' },
      'Promesa de Compra': { label: 'Promesa de Compra', color: 'bg-sky-600 text-white', description: 'Contrato de promesa firmado por ambas partes.' },
      'En Escrituración': { label: 'En Escrituración', color: 'bg-indigo-600 text-white', description: 'Expediente enviado a Notaría para firma definitiva.' },
      'Vendida': { label: 'Vendida', color: 'bg-gray-400 text-white', description: 'Operación de venta concluida y firmada.' },
      'Rentada': { label: 'Rentada', color: 'bg-gray-400 text-white', description: 'Inmueble rentado con contrato vigente.' },
      'Suspendida': { label: 'Suspendida', color: 'bg-rose-600 text-white', description: 'Publicación suspendida temporalmente por instrucción del propietario.' },
      'Bajo Oferta': { label: 'Bajo Oferta', color: 'bg-teal-500 text-white', description: 'Oferta comercial recibida y en evaluación por el propietario.' },
      'En negociación': { label: 'En negociación', color: 'bg-orange-500 text-white', description: 'Se están definiendo plazos o adecuaciones del contrato.' }
    };
    return statusDetails[status] || {
      label: 'Disponibilidad sin confirmar',
      color: 'bg-amber-100 text-amber-800',
      description: 'La disponibilidad comercial debe ser confirmada por la persona responsable.',
    };
  }
}

export class InvestmentEngine {
  public static getAppreciationLabel(property: Property): { label: string; color: string; rate: string } {
    const level = property.appreciationLevel || 'Sin análisis';
    const appreciationConfig: Record<string, { label: string; color: string; rate: string }> = {
      'Alta': { label: 'Plusvalía Alta (Premium)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', rate: '8% - 12% anual' },
      'Media': { label: 'Plusvalía Media', color: 'text-sky-700 bg-sky-50 border-sky-200', rate: '5% - 8% anual' },
      'Baja': { label: 'Plusvalía Estable', color: 'text-brand-gray-500 bg-brand-gray-50 border-brand-gray-200', rate: '2% - 5% anual' },
      'En desarrollo': { label: 'Zona en Desarrollo', color: 'text-amber-700 bg-amber-50 border-amber-200', rate: 'Proyección acelerada' }
    };
    return appreciationConfig[level] || {
      label: 'Plusvalía sin evaluar',
      color: 'text-brand-gray-600 bg-brand-gray-50 border-brand-gray-200',
      rate: 'No disponible',
    };
  }
}

export class PropertyEligibilityEngine {
  public static calculateEligibleCredits(property: Property): CreditStatus {
    return CreditEngine.calculateEligibleCredits(property);
  }

  public static calculateLegalWarnings(property: Property): string[] {
    return LegalEngine.calculateStatus(property).warnings;
  }

  public static getLegalStatus(property: Property): LegalEngineResult {
    return LegalEngine.calculateStatus(property);
  }

  public static getCommercialStatus(property: Property) {
    return CommercialEngine.getStatusDetails(property);
  }

  public static getInvestmentDetails(property: Property) {
    return InvestmentEngine.getAppreciationLabel(property);
  }
}
