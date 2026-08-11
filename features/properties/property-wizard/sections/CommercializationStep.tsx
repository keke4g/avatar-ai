import { memo } from 'react';
import { Check, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PropertyOfferingMode } from '@/lib/types';

interface CommercializationStepProps {
  selectedModes: PropertyOfferingMode[];
  selectedModesError?: string;
  onToggleMode: (mode: PropertyOfferingMode) => void;
}

const MODE_OPTIONS: Array<{
  mode: PropertyOfferingMode;
  title: string;
  description: string;
}> = [
  {
    mode: 'SWAP',
    title: 'Swap / Intercambio',
    description: 'Intercambia temporal o permanentemente con otros miembros. Ideal para viajar sin pagar hospedaje o permutar propiedades.',
  },
  {
    mode: 'MONTHLY_RENT',
    title: 'Renta (Vacacional o Mensual)',
    description: 'Publica tarifas por noche (renta vacacional) o mensualidades fijas (renta tradicional).',
  },
  {
    mode: 'SALE',
    title: 'Venta Directa',
    description: 'Promociona la venta de la propiedad física con soporte para créditos hipotecarios y escrituras.',
  },
];

function CommercializationStepComponent({
  selectedModes,
  selectedModesError,
  onToggleMode,
}: CommercializationStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <DollarSign className="w-4 h-4" />
          <span>Paso 3: Canales de Comercialización</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona los canales en los que deseas publicar tu propiedad. Puedes activar varios a la vez.</p>
      </div>

      <div className="flex flex-col gap-3">
        {MODE_OPTIONS.map(({ mode, title, description }) => {
          const isActive = selectedModes.includes(mode);
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onToggleMode(mode)}
              className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                isActive
                  ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm'
                  : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-brand-gray-100 flex items-center justify-center shrink-0 border mt-0.5">
                {isActive && <Check className="w-3.5 h-3.5 text-brand-accent font-black" />}
              </div>
              <div>
                <span className="text-xs font-bold text-brand-black block">{title}</span>
                <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">{description}</span>
              </div>
            </button>
          );
        })}
        {selectedModesError && (
          <p className="text-[10px] text-brand-rose mt-1.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
            <span>⚠</span> <span>{selectedModesError}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

export const CommercializationStep = memo(CommercializationStepComponent);
