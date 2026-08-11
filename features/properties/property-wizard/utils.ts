import type { PropertyOfferingMode } from '@/lib/types';
import type { PublisherRepresentativeType } from '@/lib/services/PublisherProfileService';
import type {
  DBType,
  ListingQualityInput,
  PreviewPriceInput,
  UIType,
  WizardPublisherType,
  WizardStepConfig,
} from './types';

export function mapPublisherType(type?: PublisherRepresentativeType): WizardPublisherType {
  if (type === 'OWNER') return 'owner';
  if (type === 'DEVELOPER' || type === 'CONSTRUCTION_COMPANY') return 'developer';
  if (type === 'PROPERTY_MANAGER') return 'property_manager';
  return type ? 'broker' : 'owner';
}

export function mapUiToDbType(uiType: UIType): DBType {
  switch (uiType) {
    case 'Departamento':
    case 'Local Comercial':
      return 'Apartment';
    case 'Casa de Playa':
      return 'Beach House';
    case 'Cabaña':
    case 'Terreno':
      return 'Cabin';
    case 'Penthouse':
      return 'Penthouse';
    case 'Casa':
    case 'Townhouse':
    case 'Villa':
      return 'Villa';
    case 'Loft':
      return 'Loft';
    default:
      return 'Apartment';
  }
}

export function mapDbToUiType(dbType: DBType): UIType {
  switch (dbType) {
    case 'Apartment':
      return 'Departamento';
    case 'Beach House':
      return 'Casa de Playa';
    case 'Cabin':
      return 'Cabaña';
    case 'Penthouse':
      return 'Penthouse';
    case 'Villa':
      return 'Villa';
    case 'Loft':
      return 'Loft';
    default:
      return 'Departamento';
  }
}

export function trackWizardMetric(eventName: string, payload: any = {}): void {
  console.info(`[AnalyticsEvent] ${eventName}`, payload);
  try {
    const stored = localStorage.getItem('aura_wizard_metrics');
    const list = stored ? JSON.parse(stored) : [];
    list.push({ eventName, payload, timestamp: new Date().toISOString() });
    localStorage.setItem('aura_wizard_metrics', JSON.stringify(list));
  } catch (error) {
    console.error('[Analytics] Local storage error:', error);
  }
}

export function getListingQuality({
  title,
  shortDescription,
  location,
  country,
  selectedModes,
  images,
  selectedAmenities,
  customAmenities,
  videoPlaceholder,
  virtualTourPlaceholder,
}: ListingQualityInput): { score: number; suggestions: string[] } {
  let score = 0;
  const suggestions: string[] = [];

  if (title && title.length >= 10) score += 15;
  else suggestions.push('Agrega un título descriptivo (mín. 10 caracteres).');

  if (shortDescription && shortDescription.length >= 30) score += 15;
  else suggestions.push('Escribe un resumen más detallado (mín. 30 caracteres).');

  if (location && country) score += 15;
  else suggestions.push('Especifica la ubicación y dirección completa.');

  if (selectedModes.length > 0) score += 10;
  else suggestions.push('Selecciona al menos una modalidad comercial.');

  if (images.length >= 5) score += 20;
  else if (images.length > 0) {
    score += 10;
    suggestions.push('Sube al menos 5 imágenes para mejorar el anuncio.');
  } else suggestions.push('Sube fotografías de tu propiedad.');

  const amenitiesCount = selectedAmenities.length + customAmenities.length;
  if (amenitiesCount >= 5) score += 15;
  else if (amenitiesCount > 0) {
    score += 8;
    suggestions.push('Marca más amenidades del espacio.');
  } else suggestions.push('Agrega amenidades para destacar tu propiedad.');

  if (videoPlaceholder) score += 5;
  else suggestions.push('Agrega un video del inmueble (opcional).');

  if (virtualTourPlaceholder) score += 5;
  else suggestions.push('Agrega un recorrido virtual 3D (opcional).');

  return { score, suggestions };
}

export function getPreviewPriceLabel({
  selectedModes,
  salePrice,
  saleCurrency,
  nightlyPrice,
  monthlyPrice,
  monthlyCurrency,
}: PreviewPriceInput): string {
  if (selectedModes.includes('SALE')) {
    return `$${Number(salePrice || 0).toLocaleString()} ${saleCurrency}`;
  }
  if (selectedModes.includes('SHORT_RENT')) {
    return `$${nightlyPrice} USD / noche`;
  }
  if (selectedModes.includes('MONTHLY_RENT')) {
    return `$${monthlyPrice} ${monthlyCurrency} / mes`;
  }
  if (selectedModes.includes('SWAP')) {
    return 'Intercambio / Swap';
  }
  return '$---';
}

export function getWizardSteps({
  publisherRepresentativeType,
  canCaptureOwnerContact,
  hasInitialData,
  selectedModes,
}: {
  publisherRepresentativeType?: PublisherRepresentativeType;
  canCaptureOwnerContact: boolean;
  hasInitialData: boolean;
  selectedModes: PropertyOfferingMode[];
}): WizardStepConfig[] {
  return [
    { id: 0, label: 'Identidad', description: 'Perfil de publicación', isVisible: !publisherRepresentativeType, estTimeMinutes: 0.5 },
    { id: 1, label: 'Información Básica', description: 'Título y resumen', isVisible: true, estTimeMinutes: 1 },
    { id: 2, label: 'Ubicación', description: 'Ubicación de la propiedad', isVisible: true, estTimeMinutes: 1 },
    { id: 12, label: 'Datos del propietario', description: 'Contacto privado y visitas', isVisible: canCaptureOwnerContact && !hasInitialData, estTimeMinutes: 0.75 },
    { id: 3, label: 'Operación', description: 'Canales de comercialización', isVisible: true, estTimeMinutes: 0.5 },
    { id: 4, label: 'Características', description: 'Distribución y superficies', isVisible: true, estTimeMinutes: 1 },
    { id: 5, label: 'Espacios y amenidades', description: 'Privadas y compartidas', isVisible: true, estTimeMinutes: 1 },
    { id: 6, label: 'Preferencias Swap', description: 'Configuración de intercambio', isVisible: selectedModes.includes('SWAP'), estTimeMinutes: 1.5 },
    { id: 7, label: 'Condiciones de Renta', description: 'Precios y plazos de renta', isVisible: selectedModes.includes('RENT' as any) || selectedModes.includes('SHORT_RENT') || selectedModes.includes('MONTHLY_RENT'), estTimeMinutes: 1.5 },
    { id: 8, label: 'Términos de Venta', description: 'Precios y legal de venta', isVisible: selectedModes.includes('SALE'), estTimeMinutes: 1.5 },
    { id: 9, label: 'Multimedia', description: 'Galería de fotos y video', isVisible: true, estTimeMinutes: 1 },
    { id: 10, label: 'Esquema Comercial', description: 'Exclusividad y comisiones', isVisible: true, estTimeMinutes: 1 },
    { id: 11, label: 'Vista Previa', description: 'Revisión final', isVisible: true, estTimeMinutes: 1 },
  ];
}

export function showWizardToast(message: string, type: 'success' | 'error'): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('aura-custom-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'aura-custom-toast';
  toast.className = `fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-floating border text-xs font-black animate-slide-up ${
    type === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
      : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
  }`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-all', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
