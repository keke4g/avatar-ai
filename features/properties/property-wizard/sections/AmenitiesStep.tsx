import { memo, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Award, Building, Check, Home, Sparkles } from 'lucide-react';

import type { LanguageType } from '@/lib/context/LanguageContext';
import { PROPERTY_FEATURE_GROUPS } from '@/lib/propertyFeatures';
import { getPropertyFeatureIcon } from '@/lib/propertyFeatureIcons';

interface AmenitiesStepProps {
  customAmenities: string[];
  language: LanguageType;
  newCustomAmenity: string;
  selectedAmenities: string[];
  setCustomAmenities: Dispatch<SetStateAction<string[]>>;
  setNewCustomAmenity: Dispatch<SetStateAction<string>>;
  toggleAmenity: (amenity: string) => void;
}

function AmenitiesStepComponent({
  customAmenities,
  language,
  newCustomAmenity,
  selectedAmenities,
  setCustomAmenities,
  setNewCustomAmenity,
  toggleAmenity,
}: AmenitiesStepProps) {
  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Award className="w-4 h-4" />
          <span>Paso 5: Amenidades del Inmueble</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona el equipamiento y amenidades activas en el espacio. Si no encuentras alguna, escríbela en &quot;Otra amenidad&quot;.</p>
      </div>

      <div className="flex flex-col gap-4 border-b border-brand-gray-100 pb-4">
        {PROPERTY_FEATURE_GROUPS.map((group, groupIndex) => {
          const selectedCount = group.options.filter((option) => selectedAmenities.includes(option)).length;
          const GroupIcon = groupIndex === 0 ? Home : groupIndex === 1 ? Sparkles : Building;
          return (
            <section
              key={group.key}
              className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white"
            >
              <header className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50/75 px-4 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
                    <GroupIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-neutral-950">
                      {language === 'es' ? group.titleEs : group.titleEn}
                    </h4>
                    <p className="mt-1 text-[10px] font-semibold leading-relaxed text-neutral-500">
                      {language === 'es' ? group.descriptionEs : group.descriptionEn}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[9px] font-black text-neutral-500">
                  {selectedCount}
                </span>
              </header>
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {group.options.map((amenity) => {
                  const isChecked = selectedAmenities.includes(amenity);
                  const AmenityIcon = getPropertyFeatureIcon(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity(amenity)}
                      aria-pressed={isChecked}
                      className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                        isChecked
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-premium'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition-colors ${
                          isChecked
                            ? 'border-white/20 bg-white/10 text-white'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                        }`}>
                          <AmenityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="leading-tight">{amenity}</span>
                      </span>
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isChecked ? 'border-emerald-300 bg-emerald-300 text-neutral-950' : 'border-neutral-300'
                      }`}>
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Custom Amenities row */}
      <div className="flex flex-col gap-1.5 mt-1">
        <label className="text-xs font-bold text-brand-gray-500">
          ¿Falta algún espacio o amenidad? Escríbelo aquí <span className="text-brand-gray-400 font-normal">(Opcional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCustomAmenity}
            onChange={(e) => setNewCustomAmenity(e.target.value)}
            placeholder="Ej. Muelle privado, cuarto de música, pista de jogging"
            className="flex-1 p-2.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newCustomAmenity.trim()) {
                  const cleaned = newCustomAmenity.trim();
                  if (!customAmenities.includes(cleaned) && !selectedAmenities.includes(cleaned)) {
                    setCustomAmenities(prev => [...prev, cleaned]);
                  }
                  setNewCustomAmenity('');
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (newCustomAmenity.trim()) {
                const cleaned = newCustomAmenity.trim();
                if (!customAmenities.includes(cleaned) && !selectedAmenities.includes(cleaned)) {
                  setCustomAmenities(prev => [...prev, cleaned]);
                }
                setNewCustomAmenity('');
              }
            }}
            className="px-4 py-2.5 bg-brand-black text-white text-xs font-black rounded-xl hover:bg-brand-gray-800 transition-all cursor-pointer shrink-0"
          >
            Agregar
          </button>
        </div>

        {/* Display custom amenities */}
        {customAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-16 overflow-y-auto no-scrollbar">
            {customAmenities.map(amenity => (
              <span 
                key={amenity} 
                className="text-[10px] font-bold text-brand-black bg-brand-accent/10 border border-brand-accent/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
              >
                <span>{amenity}</span>
                <button
                  type="button"
                  onClick={() => setCustomAmenities(prev => prev.filter(a => a !== amenity))}
                  className="text-brand-rose font-black hover:text-brand-rose/85 cursor-pointer text-xs"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const AmenitiesStep = memo(AmenitiesStepComponent);
