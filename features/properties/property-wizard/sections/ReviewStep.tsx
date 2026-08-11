import { memo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PropertyOfferingMode } from '@/lib/types';
import { formatCount } from '@/lib/textHelpers';
import type { UIType, WizardServerError } from '../types';

interface ReviewStepProps {
  title: string;
  type: UIType;
  location: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  selectedModes: PropertyOfferingMode[];
  hasAuthenticatedUser: boolean;
  hasInitialHost: boolean;
  latitude: number | null;
  longitude: number | null;
  salePrice: number;
  monthlyPrice: number;
  nightlyPrice: number;
  imagesCount: number;
  serverError: WizardServerError | null;
}

function ReviewStepComponent({
  title,
  type,
  location,
  bedrooms,
  bathrooms,
  parkingSpaces,
  selectedModes,
  hasAuthenticatedUser,
  hasInitialHost,
  latitude,
  longitude,
  salePrice,
  monthlyPrice,
  nightlyPrice,
  imagesCount,
  serverError,
}: ReviewStepProps) {
  const hasCoordinates = latitude != null
    && longitude != null
    && !Number.isNaN(Number(latitude))
    && !Number.isNaN(Number(longitude));

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4 text-brand-black"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Sparkles className="w-4 h-4" />
          <span>Paso 11: Vista Previa y Calidad</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Valida el resumen técnico y el checklist de calidad antes de guardar el anuncio.</p>
      </div>

      <div className="border border-brand-gray-200 rounded-2xl p-4 bg-brand-gray-50/50 flex flex-col gap-3">
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="text-xs font-black text-brand-black truncate">{title || 'Sin Título'}</span>
          <span className="text-[10px] font-black uppercase text-brand-accent bg-brand-accent/5 px-2.5 py-1 rounded">{type}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs leading-normal">
          <div>
            <p className="text-brand-gray-400 font-bold">Ubicación</p>
            <p className="font-semibold text-brand-black">{location || 'No especificada'}</p>
          </div>
          <div>
            <p className="text-brand-gray-400 font-bold">Habitabilidad</p>
            <p className="font-semibold text-brand-black">
              {formatCount(bedrooms || 0, 'recámara', 'recámaras', 'feminine')} • {formatCount(bathrooms || 0, 'baño', 'baños', 'masculine')} • {formatCount(parkingSpaces || 0, 'estacionamiento', 'estacionamientos', 'masculine')}
            </p>
          </div>
        </div>

        <div className="text-xs leading-normal pt-2 border-t">
          <p className="text-brand-gray-400 font-bold">Modalidades seleccionadas</p>
          <div className="flex gap-2.5 mt-1">
            {selectedModes.map((mode) => (
              <span key={mode} className="px-2 py-0.5 rounded bg-brand-black text-white text-[9px] font-bold">
                {mode === 'SALE' ? 'Venta' : mode === 'MONTHLY_RENT' || mode === 'SHORT_RENT' ? 'Renta' : 'Swap'}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Checklist de Calidad del Anuncio</span>
        <div className="flex flex-col gap-2.5 p-3.5 bg-brand-gray-50 rounded-2xl border">
          <ReviewStatus label="Usuario autenticado (hostId)" ready={hasAuthenticatedUser || hasInitialHost} error="Sin sesión activa" />
          <ReviewStatus label="Título del anuncio" ready={Boolean(title.trim())} error="Agrega un título" />
          <ReviewStatus label="Ubicación georreferenciada" ready={hasCoordinates} error="Coordenadas ausentes (Paso 2)" />

          {selectedModes.map((mode) => {
            let ready = false;
            let label = '';
            let error = 'Especifica precio > 0';
            if (mode === 'SALE') {
              ready = Number(salePrice) > 0;
              label = 'Precio de Venta';
            } else if (mode === 'MONTHLY_RENT') {
              ready = Number(monthlyPrice) > 0;
              label = 'Precio de Renta Mensual';
            } else if (mode === 'SHORT_RENT') {
              ready = Number(nightlyPrice) > 0;
              label = 'Precio de Renta Temporal';
            } else if (mode === 'SWAP') {
              ready = Number(salePrice) > 0;
              label = 'Valor estimado';
              error = 'Especifica un valor > 0';
            }

            return (
              <ReviewStatus
                key={mode}
                label={label}
                ready={ready}
                error={error}
                indented
              />
            );
          })}

          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-brand-gray-600">Imágenes cargadas ({imagesCount})</span>
            {imagesCount >= 1 ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo {imagesCount >= 5 ? '' : '(puedes agregar más después)'}</span>
            ) : (
              <span className="text-rose-600 font-bold flex items-center gap-1">❌ Sube al menos una imagen</span>
            )}
          </div>
        </div>
      </div>

      {serverError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 font-semibold flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 animate-pulse" />
            <span>Error en el servidor de base de datos</span>
          </div>
          <p className="leading-relaxed font-bold">{serverError.message}</p>
          <div className="bg-white/60 p-2.5 rounded-lg border text-[10px] leading-normal font-mono flex flex-col gap-1 mt-1 text-rose-950">
            <div><span className="font-bold">Código:</span> {serverError.code}</div>
            <div><span className="font-bold">Detalle:</span> {serverError.details}</div>
            {serverError.hint && <div><span className="font-bold">Ayuda:</span> {serverError.hint}</div>}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ReviewStatus({
  label,
  ready,
  error,
  indented = false,
}: {
  label: string;
  ready: boolean;
  error: string;
  indented?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-xs font-semibold ${indented ? 'pl-3 border-l-2 border-brand-gray-200' : ''}`}>
      <span className={indented ? 'text-brand-gray-500' : 'text-brand-gray-600'}>{label}</span>
      {ready ? (
        <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
      ) : (
        <span className="text-rose-600 font-bold flex items-center gap-1">❌ {error}</span>
      )}
    </div>
  );
}

export const ReviewStep = memo(ReviewStepComponent);
