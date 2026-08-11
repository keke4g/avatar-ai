/* eslint-disable @next/next/no-img-element */
import { memo, useMemo } from 'react';
import { Shield } from 'lucide-react';
import type { PropertyOfferingMode } from '@/lib/types';
import { formatCount } from '@/lib/textHelpers';
import styles from '../../components/PropertyWizardModal.module.css';
import type { UIType, WizardPublisherType, WizardStep, WizardStepConfig } from '../types';

interface WizardPreviewPanelProps {
  hasInitialData: boolean;
  images: string[];
  selectedModes: PropertyOfferingMode[];
  type: UIType;
  title: string;
  location: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  halfBathrooms: number;
  parkingSpaces: number;
  surfaceTotal: number | '';
  selectedAmenities: string[];
  customAmenities: string[];
  previewPriceLabel: string;
  publisherType: WizardPublisherType;
  qualityScore: number;
  qualitySuggestions: string[];
  activeSteps: WizardStepConfig[];
  step: WizardStep;
  currentActiveIndex: number;
  totalActiveSteps: number;
  progressPercentage: number;
  remainingStepsCount: number;
  remainingTimeMinutes: number;
}

function WizardPreviewPanelComponent({
  hasInitialData,
  images,
  selectedModes,
  type,
  title,
  location,
  neighborhood,
  bedrooms,
  bathrooms,
  halfBathrooms,
  parkingSpaces,
  surfaceTotal,
  selectedAmenities,
  customAmenities,
  previewPriceLabel,
  publisherType,
  qualityScore,
  qualitySuggestions,
  activeSteps,
  step,
  currentActiveIndex,
  totalActiveSteps,
  progressPercentage,
  remainingStepsCount,
  remainingTimeMinutes,
}: WizardPreviewPanelProps) {
  const firstAmenities = useMemo(
    () => [...selectedAmenities, ...customAmenities].slice(0, 3),
    [customAmenities, selectedAmenities],
  );

  return (
    <aside className="relative hidden h-full min-h-0 select-none overflow-hidden bg-[#171717] p-7 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-white/10" />
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-start gap-5">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            Publicación guiada
          </span>
          <h2 className="mt-5 text-2xl font-black leading-[1.05] tracking-[-0.04em] text-white">
            {hasInitialData ? 'Actualiza tu propiedad.' : 'Tu propiedad, paso a paso.'}
          </h2>
          <p className="mt-3 text-[11px] font-medium leading-relaxed text-white/55">
            Conservaremos tu avance mientras completas la información necesaria para revisar el anuncio.
          </p>
        </div>

        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl">
          <div className="aspect-[16/7.5] w-full bg-brand-gray-100 relative overflow-hidden flex items-center justify-center text-brand-gray-400 shrink-0">
            {images[0] ? (
              <img
                src={images[0]}
                alt="Preview"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center p-4">
                <span className="text-[10px] font-black text-brand-gray-400 uppercase tracking-wider">PREVISUALIZACIÓN DEL ANUNCIO</span>
              </div>
            )}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
              {selectedModes.map((mode) => (
                <span key={mode} className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/95 text-brand-black shadow-xs">
                  {mode === 'SWAP' ? 'Swap' : mode === 'SALE' ? 'Venta' : mode === 'SHORT_RENT' ? 'Renta Corta' : 'Renta Mensual'}
                </span>
              ))}
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-brand-black text-white shadow-xs">
                Towers Score 95
              </span>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-3 flex-1 justify-between">
            <div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-black text-brand-accent uppercase tracking-wider">{type}</span>
                {selectedModes.includes('SWAP') && (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Towers Match 98%</span>
                )}
              </div>
              <h4 className="text-sm font-black text-brand-black truncate">{title || 'Título provisional'}</h4>
              <p className="text-xs text-brand-gray-500 truncate mt-1">
                {location ? `${neighborhood ? `${neighborhood}, ` : ''}${location}` : 'Ubicación / Ciudad'}
              </p>

              <div className="flex items-center flex-wrap gap-2 text-[10px] text-brand-gray-500 font-bold mt-2 bg-brand-gray-150/40 p-2 rounded-lg">
                <span>{formatCount(bedrooms || 0, 'recámara', 'recámaras', 'feminine')}</span>
                <span>•</span>
                <span>{formatCount(bathrooms + halfBathrooms * 0.5, 'baño', 'baños', 'masculine')}</span>
                {parkingSpaces > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatCount(parkingSpaces, 'estacionamiento', 'estacionamientos', 'masculine')}</span>
                  </>
                )}
                {surfaceTotal && (
                  <>
                    <span>•</span>
                    <span>{surfaceTotal} m²</span>
                  </>
                )}
              </div>

              {firstAmenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {firstAmenities.map((amenity) => (
                    <span key={amenity} className="text-[9px] font-bold text-brand-gray-600 bg-brand-gray-100 px-2 py-0.5 rounded-full border border-brand-gray-200/40">
                      {amenity}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3.5 text-base font-black text-brand-black">{previewPriceLabel}</div>
            </div>

            <div className={`${styles.previewPublisherRow} mt-4 flex items-center justify-between border-t border-brand-gray-200/60 pt-3`}>
              <span className="text-xs font-bold text-brand-gray-500">Publicado por</span>
              <span className="text-[10px] font-black uppercase text-brand-black px-2.5 py-1 rounded bg-brand-gray-100 border">
                {publisherType === 'owner' ? 'Propietario' : publisherType === 'broker' ? 'Agente' : publisherType === 'developer' ? 'Desarrollador' : 'Gestor'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/55">Calidad del anuncio</span>
            <span className="text-xs font-black text-emerald-300">{qualityScore}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${qualityScore}%` }} />
          </div>
          {qualitySuggestions.length > 0 && (
            <p className="mt-1 text-[9px] font-bold leading-relaxed text-white/45">
              💡 Sugerencia: {qualitySuggestions[0]}
            </p>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex shrink-0 flex-col gap-2 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
          <span className="truncate max-w-[150px]">Paso: {activeSteps.find((item) => item.id === step)?.label}</span>
          <span>Paso {currentActiveIndex + 1} de {totalActiveSteps}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {activeSteps.map((item, index) => {
            const isActive = step === item.id;
            const isCompleted = currentActiveIndex > index;
            return (
              <div
                key={item.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isActive ? 'w-8 bg-emerald-400' : isCompleted ? 'w-4 bg-white' : 'w-2 bg-white/15'
                }`}
              />
            );
          })}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] font-bold text-white/45">
          <span>{progressPercentage}% completado</span>
          <span>{remainingStepsCount > 0 ? `~${Math.ceil(remainingTimeMinutes)} min rest.` : 'Último paso'}</span>
        </div>
      </div>
    </aside>
  );
}

export const WizardPreviewPanel = memo(WizardPreviewPanelComponent);
