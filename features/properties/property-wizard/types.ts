import type { Property, PropertyOfferingMode } from '@/lib/types';
import type { PublisherRepresentativeType } from '@/lib/services/PublisherProfileService';

export interface PropertyWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (propertyData: any) => void;
  initialData?: Property | null;
  onDelete?: (id: string) => void;
  publisherRepresentativeType?: PublisherRepresentativeType;
}

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type WizardPublisherType = 'owner' | 'broker' | 'developer' | 'property_manager';
export type RentalFurnishingStatus = 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FURNISHED';
export type RentalCommissionModel = 'ONE_MONTH_RENT' | 'PERCENTAGE';

export type UIType =
  | 'Casa'
  | 'Departamento'
  | 'Penthouse'
  | 'Townhouse'
  | 'Villa'
  | 'Casa de Playa'
  | 'Cabaña'
  | 'Loft'
  | 'Terreno'
  | 'Local Comercial';

export type DBType = 'Apartment' | 'Beach House' | 'Cabin' | 'Penthouse' | 'Villa' | 'Loft';

export interface WizardStepConfig {
  id: WizardStep;
  label: string;
  description: string;
  isVisible: boolean;
  estTimeMinutes: number;
}

export interface WizardServerError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface ListingQualityInput {
  title: string;
  shortDescription: string;
  location: string;
  country: string;
  selectedModes: PropertyOfferingMode[];
  images: string[];
  selectedAmenities: string[];
  customAmenities: string[];
  videoPlaceholder: string;
  virtualTourPlaceholder: string;
}

export interface PreviewPriceInput {
  selectedModes: PropertyOfferingMode[];
  salePrice: number;
  saleCurrency: string;
  nightlyPrice: number;
  monthlyPrice: number;
  monthlyCurrency: 'MXN' | 'USD';
}
