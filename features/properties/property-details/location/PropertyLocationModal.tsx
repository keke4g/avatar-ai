import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, X } from 'lucide-react';
import GooglePropertyLocation from '@/components/property/GooglePropertyLocation';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { NearbyPlace } from '@/lib/maps/types';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { Property } from '@/lib/types';
import type { PropertyLocationModalController } from './usePropertyLocationModal';

const EMPTY_NEARBY_PLACES: NearbyPlace[] = [];

interface PropertyLocationModalProps {
  controller: PropertyLocationModalController;
  error: string | null;
  language: LanguageType;
  loading: boolean;
  places?: NearbyPlace[];
  property: Property;
}

export const PropertyLocationModal = memo(function PropertyLocationModal({
  controller,
  error,
  language,
  loading,
  places,
  property,
}: PropertyLocationModalProps) {
  const { isLocationModalOpen, setIsLocationModalOpen } = controller;

  return (
    <AnimatePresence>
      {isLocationModalOpen && property.latitude !== null && property.longitude !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[5100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-md sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-location-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsLocationModalOpen(false);
          }}
        >
          <motion.div
            initial={{ y: 36, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 36, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[30px] border border-white/70 bg-[#f7f7f5] shadow-[0_35px_100px_rgba(2,6,23,0.42)] sm:rounded-[32px]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/80 bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-lg shadow-neutral-950/15">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-700">
                    {language === 'es' ? 'Ubicación interactiva' : 'Interactive location'}
                  </p>
                  <h2 id="property-location-modal-title" className="mt-1 truncate text-lg font-black tracking-tight text-neutral-950 sm:text-xl">
                    {language === 'es' ? 'Mapa y lugares cercanos' : 'Map and nearby places'}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-neutral-500">
                    {property.formattedAddress || formatPropertyLocation(property.location, property.country)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
                aria-label={language === 'es' ? 'Cerrar mapa' : 'Close map'}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </header>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <GooglePropertyLocation
                property={property}
                places={places || EMPTY_NEARBY_PLACES}
                loading={loading}
                error={error}
                language={language === 'es' ? 'es' : 'en'}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
