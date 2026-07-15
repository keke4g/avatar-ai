import { getActiveOfferings } from '../propertyOfferings';
import type { Property, PropertyOffering } from '../types';

export type JourneyGoal = 'BUY' | 'RENT' | 'INVEST' | 'SELL' | 'SWAP';

export interface SearchBrief {
  goal: JourneyGoal | null;
  city: string;
  budget: number | null;
  currency: string;
  bedrooms: number | null;
  needsParking: boolean | null;
  financing: 'BANK' | 'INFONAVIT' | 'FOVISSSTE' | 'CASH' | 'UNDECIDED' | null;
  timeline: string;
  mustHaves: string[];
}

export interface DecisionRequirement {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface DecisionSummary {
  matchCount: number;
  requirementCount: number;
  matchLabel: string;
  reasons: string[];
  tradeoffs: string[];
  missingInformation: string[];
  requirements: DecisionRequirement[];
  verification: Array<{
    label: string;
    status: 'verified' | 'declared' | 'missing';
    detail: string;
  }>;
  nextAction: {
    id: 'COMPLETE_BRIEF' | 'COMPARE' | 'VERIFY' | 'CALCULATE' | 'CONTACT';
    label: string;
    reason: string;
  };
}

export interface OwnershipCostEstimate {
  price: number;
  currency: string;
  downPayment: number;
  financedAmount: number;
  estimatedMonthlyMortgage: number;
  monthlyMaintenance: number;
  estimatedMonthlyTotal: number;
  estimatedClosingCosts: number;
  annualRate: number;
  termYears: number;
  assumptions: string[];
}

export const EMPTY_SEARCH_BRIEF: SearchBrief = {
  goal: null,
  city: '',
  budget: null,
  currency: 'MXN',
  bedrooms: null,
  needsParking: null,
  financing: null,
  timeline: '',
  mustHaves: [],
};

const normalize = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function getPrimaryCommercialOffering(property: Property): PropertyOffering | null {
  const offerings = getActiveOfferings(property);
  return (
    offerings.find((offering) => offering.mode === 'SALE') ||
    offerings.find((offering) => offering.mode === 'MONTHLY_RENT') ||
    offerings.find((offering) => offering.mode === 'SHORT_RENT') ||
    offerings[0] ||
    null
  );
}

export function getPropertyPrice(property: Property): { amount: number; currency: string; mode: string } {
  const offering = getPrimaryCommercialOffering(property);
  return {
    amount: Number(offering?.priceAmount) || 0,
    currency: offering?.currency || 'MXN',
    mode: offering?.mode || property.primaryOperation || 'SALE',
  };
}

export function estimateOwnershipCost(
  property: Property,
  options?: { downPaymentPercent?: number; annualRate?: number; termYears?: number },
): OwnershipCostEstimate | null {
  const { amount: price, currency, mode } = getPropertyPrice(property);
  if (!price || mode !== 'SALE') return null;

  const downPaymentPercent = options?.downPaymentPercent ?? 20;
  const annualRate = options?.annualRate ?? 10.5;
  const termYears = options?.termYears ?? 20;
  const downPayment = price * (downPaymentPercent / 100);
  const financedAmount = Math.max(0, price - downPayment);
  const monthlyRate = annualRate / 100 / 12;
  const periods = termYears * 12;
  const estimatedMonthlyMortgage = monthlyRate > 0
    ? financedAmount * ((monthlyRate * Math.pow(1 + monthlyRate, periods)) / (Math.pow(1 + monthlyRate, periods) - 1))
    : financedAmount / periods;
  const monthlyMaintenance = Number(property.maintenanceFeeAmount) || 0;

  return {
    price,
    currency,
    downPayment,
    financedAmount,
    estimatedMonthlyMortgage,
    monthlyMaintenance,
    estimatedMonthlyTotal: estimatedMonthlyMortgage + monthlyMaintenance,
    estimatedClosingCosts: price * 0.06,
    annualRate,
    termYears,
    assumptions: [
      `Enganche estimado de ${downPaymentPercent}%`,
      `Tasa ilustrativa de ${annualRate}% anual`,
      `Plazo ilustrativo de ${termYears} años`,
      'Gastos de cierre estimados en 6%; deben confirmarse con notaría y entidad financiera',
    ],
  };
}

function includesLocation(property: Property, city: string) {
  const target = normalize(city);
  if (!target) return true;
  return [property.city, property.location, property.state, property.formattedAddress]
    .some((value) => normalize(value).includes(target));
}

export function buildDecisionSummary(
  property: Property,
  brief: SearchBrief,
  options?: { comparisonCount?: number },
): DecisionSummary {
  const price = getPropertyPrice(property);
  const requirements: DecisionRequirement[] = [];

  if (brief.city) {
    const met = includesLocation(property, brief.city);
    requirements.push({
      id: 'city',
      label: `Ubicación: ${brief.city}`,
      met,
      detail: met ? 'Está en la zona solicitada' : `El anuncio indica ${property.city || property.location}`,
    });
  }

  if (brief.budget) {
    const met = price.amount > 0 && price.amount <= brief.budget;
    requirements.push({
      id: 'budget',
      label: `Presupuesto hasta ${brief.currency} $${brief.budget.toLocaleString('es-MX')}`,
      met,
      detail: price.amount
        ? `${price.currency} $${price.amount.toLocaleString('es-MX')}`
        : 'El precio no está confirmado',
    });
  }

  if (brief.bedrooms !== null) {
    const met = Number(property.bedrooms) >= brief.bedrooms;
    requirements.push({
      id: 'bedrooms',
      label: `${brief.bedrooms} recámara${brief.bedrooms === 1 ? '' : 's'} o más`,
      met,
      detail: `${Number(property.bedrooms) || 0} recámara${Number(property.bedrooms) === 1 ? '' : 's'}`,
    });
  }

  if (brief.needsParking !== null) {
    const spaces = Number(property.parkingSpaces) || 0;
    const met = brief.needsParking ? spaces > 0 : true;
    requirements.push({
      id: 'parking',
      label: brief.needsParking ? 'Con estacionamiento' : 'Estacionamiento no indispensable',
      met,
      detail: `${spaces} lugar${spaces === 1 ? '' : 'es'} de estacionamiento`,
    });
  }

  const searchableAmenities = [
    ...(property.amenities || []),
    ...(property.metadata?.customAmenities || []),
    ...(property.aiTags || []),
  ].map(normalize);

  brief.mustHaves.forEach((mustHave) => {
    const target = normalize(mustHave);
    const met = searchableAmenities.some((amenity) => amenity.includes(target) || target.includes(amenity));
    requirements.push({
      id: `amenity-${target}`,
      label: mustHave,
      met,
      detail: met ? 'Aparece en las características del anuncio' : 'No aparece confirmada en el anuncio',
    });
  });

  const reasons = requirements.filter((requirement) => requirement.met).map((requirement) => requirement.label);
  const tradeoffs = requirements.filter((requirement) => !requirement.met).map((requirement) => requirement.detail);
  const missingInformation: string[] = [];

  if (!price.amount) missingInformation.push('Precio actualizado');
  if (price.mode === 'SALE' && property.maintenanceFeeAmount === undefined) missingInformation.push('Mantenimiento mensual');
  if (property.legalDocumentationComplete === undefined) missingInformation.push('Integridad del expediente jurídico');
  if (!property.legalLastUpdate) missingInformation.push('Fecha de actualización legal');
  if (!property.updatedAt) missingInformation.push('Fecha de actualización del anuncio');

  const verification: DecisionSummary['verification'] = [
    {
      label: 'Identidad del anunciante',
      status: property.hostVerified ? 'verified' : 'missing',
      detail: property.hostVerified ? 'Perfil marcado como verificado' : 'Verificación pendiente',
    },
    {
      label: 'Expediente jurídico',
      status: property.legalDocumentationComplete === true ? 'verified' : property.legalDocumentationComplete === false ? 'declared' : 'missing',
      detail: property.legalDocumentationComplete === true
        ? `Documentación indicada como completa${property.legalLastUpdate ? ` · ${property.legalLastUpdate}` : ''}`
        : property.legalDocumentationComplete === false
          ? 'El anuncio indica documentación incompleta'
          : 'No se proporcionó confirmación',
    },
    {
      label: 'Precio y modalidad',
      status: price.amount ? 'declared' : 'missing',
      detail: price.amount ? 'Dato proporcionado por el anunciante' : 'Precio sin proporcionar',
    },
  ];

  const matchCount = requirements.filter((requirement) => requirement.met).length;
  const requirementCount = requirements.length;
  const matchLabel = requirementCount
    ? `Cumple ${matchCount} de ${requirementCount} prioridades`
    : 'Completa tus prioridades para medir el ajuste';

  let nextAction: DecisionSummary['nextAction'];
  if (!brief.city || !brief.budget) {
    nextAction = {
      id: 'COMPLETE_BRIEF',
      label: 'Completar mis prioridades',
      reason: 'Con ciudad y presupuesto podemos explicar con precisión si esta opción encaja.',
    };
  } else if (missingInformation.length > 0) {
    nextAction = {
      id: 'VERIFY',
      label: `Confirmar ${missingInformation[0].toLowerCase()}`,
      reason: 'Resolver el dato más importante reduce el riesgo antes de contactar.',
    };
  } else if ((options?.comparisonCount || 0) < 2) {
    nextAction = {
      id: 'COMPARE',
      label: 'Añadir a comparación',
      reason: 'Comparar al menos dos opciones ayuda a reconocer el mejor equilibrio.',
    };
  } else if (price.mode === 'SALE') {
    nextAction = {
      id: 'CALCULATE',
      label: 'Revisar costo mensual',
      reason: 'El precio publicado no incluye todos los costos de compra.',
    };
  } else {
    nextAction = {
      id: 'CONTACT',
      label: 'Confirmar disponibilidad',
      reason: 'Las prioridades esenciales ya están definidas y comparadas.',
    };
  }

  return {
    matchCount,
    requirementCount,
    matchLabel,
    reasons,
    tradeoffs,
    missingInformation,
    requirements,
    verification,
    nextAction,
  };
}

