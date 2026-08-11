import { memo, useMemo, useState } from 'react';
import { ChevronDown, Compass } from 'lucide-react';
import { useTranslation } from '@/lib/context/LanguageContext';
import { groupPropertyFeatures } from '@/lib/propertyFeatures';
import { getPropertyFeatureIcon } from '@/lib/propertyFeatureIcons';
import type { Property } from '@/lib/types';
import { PropertySectionCard, PropertySubIcon } from '@/components/property/PropertySectionCard';

interface PropertyAmenitiesSectionProps {
  property: Property;
}

export const PropertyAmenitiesSection = memo(function PropertyAmenitiesSection({
  property,
}: PropertyAmenitiesSectionProps) {
  const { language, t } = useTranslation();
  const [isSharedAmenitiesExpanded, setIsSharedAmenitiesExpanded] = useState(false);
  const allAmenities = useMemo(() => [
    ...(property.amenities || []),
    ...(property.metadata?.customAmenities || []),
  ], [property]);
  const groupedAmenities = useMemo(
    () => groupPropertyFeatures(allAmenities),
    [allAmenities],
  );

  if (allAmenities.length === 0) return null;

  return (
    <PropertySectionCard
      icon={Compass}
      eyebrow={language === 'es' ? 'Comodidades' : 'Amenities'}
      title={t('details.whatOffers')}
    >
      <div className="flex flex-col gap-5">
        {groupedAmenities.groups
          .filter((group) => group.values.length > 0)
          .map((group) => {
            const isSharedGroup = group.key === 'shared';
            const groupTitle = language === 'es' ? group.titleEs : group.titleEn;
            const amenitiesGrid = (
              <div
                id={`property-feature-group-${group.key}`}
                className={`grid-cols-1 gap-3 sm:grid-cols-2 ${
                  isSharedGroup && !isSharedAmenitiesExpanded ? 'hidden sm:grid' : 'grid'
                }`}
              >
                {group.values.map((amenity) => {
                  const Icon = getPropertyFeatureIcon(amenity);
                  const displayAmenity = t(`amenities.${amenity}`, undefined, amenity);
                  return (
                    <div key={amenity} className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200/75 bg-white px-3.5 py-3 text-sm font-semibold text-brand-gray-600">
                      <PropertySubIcon icon={Icon} className="h-9 w-9 rounded-xl" iconClassName="h-3.5 w-3.5" />
                      <span className="leading-tight">{displayAmenity}</span>
                    </div>
                  );
                })}
              </div>
            );

            return (
              <div key={group.key}>
                {isSharedGroup ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={isSharedAmenitiesExpanded}
                      aria-controls={`property-feature-group-${group.key}`}
                      onClick={() => setIsSharedAmenitiesExpanded((expanded) => !expanded)}
                      className="mb-2.5 flex w-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99] sm:hidden"
                    >
                      <span>
                        <span className="block text-[10px] font-black uppercase tracking-[0.11em] text-neutral-700">
                          {groupTitle}
                        </span>
                        <span className="mt-1 block text-[9px] font-semibold text-neutral-400">
                          {language === 'es'
                            ? (isSharedAmenitiesExpanded ? 'Toca para ocultarlas' : 'Toca para ver las áreas comunes')
                            : (isSharedAmenitiesExpanded ? 'Tap to hide' : 'Tap to view shared facilities')}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-[9px] font-black text-brand-accent">
                          {group.values.length}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${
                          isSharedAmenitiesExpanded ? 'rotate-180' : ''
                        }`} />
                      </span>
                    </button>
                    <div className="mb-2.5 hidden items-center justify-between gap-3 sm:flex">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-neutral-500">
                        {groupTitle}
                      </h4>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black text-neutral-500">
                        {group.values.length}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-neutral-500">
                      {groupTitle}
                    </h4>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black text-neutral-500">
                      {group.values.length}
                    </span>
                  </div>
                )}
                {amenitiesGrid}
              </div>
            );
          })}
        {groupedAmenities.other.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-neutral-500">
                {language === 'es' ? 'Otras características' : 'Other features'}
              </h4>
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black text-neutral-500">
                {groupedAmenities.other.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groupedAmenities.other.map((amenity) => (
                <div key={amenity} className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200/75 bg-white px-3.5 py-3 text-sm font-semibold text-brand-gray-600">
                  <PropertySubIcon icon={Compass} className="h-9 w-9 rounded-xl" iconClassName="h-3.5 w-3.5" />
                  <span className="leading-tight">{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PropertySectionCard>
  );
});
