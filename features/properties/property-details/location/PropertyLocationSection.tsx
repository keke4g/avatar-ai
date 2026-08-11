import { memo } from 'react';
import { MapPin } from 'lucide-react';
import GooglePropertyLocation from '@/components/property/GooglePropertyLocation';
import { PropertySectionCard } from '@/components/property/PropertySectionCard';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { NearbyPlace } from '@/lib/maps/types';
import type { Property } from '@/lib/types';

const EMPTY_NEARBY_PLACES: NearbyPlace[] = [];

interface PropertyLocationSectionProps {
  error: string | null;
  language: LanguageType;
  loading: boolean;
  places?: NearbyPlace[];
  property: Property;
}

export const PropertyLocationSection = memo(function PropertyLocationSection({
  error,
  language,
  loading,
  places,
  property,
}: PropertyLocationSectionProps) {
  if (property.latitude === null || property.longitude === null) return null;

  return (
    <PropertySectionCard
      icon={MapPin}
      eyebrow={language === 'es' ? 'Ubicación' : 'Location'}
      title={language === 'es' ? 'Ubicación y entorno' : 'Location & neighborhood'}
      description={property.formattedAddress || (language === 'es'
        ? 'Consulta la ubicación y los puntos de interés cercanos.'
        : 'View the location and nearby points of interest.')}
      contentClassName="p-4 sm:p-5"
    >
      <GooglePropertyLocation
        property={property}
        places={places || EMPTY_NEARBY_PLACES}
        loading={loading}
        error={error}
        language={language === 'es' ? 'es' : 'en'}
      />
    </PropertySectionCard>
  );
});
