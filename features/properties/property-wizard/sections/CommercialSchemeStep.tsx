import { memo } from 'react';
import { Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PropertyOfferingMode } from '@/lib/types';
import type { RentalCommissionModel } from '../types';

interface CommercialSchemeStepProps {
  isExclusive: boolean;
  onExclusiveChange: (value: boolean) => void;
  selectedModes: PropertyOfferingMode[];
  rentalCommissionModel: RentalCommissionModel;
  onRentalCommissionModelChange: (value: RentalCommissionModel) => void;
  monthlyPrice: number;
  monthlyCurrency: 'MXN' | 'USD';
  commissionTotalPct: number | '';
  onCommissionTotalPctChange: (value: number | '') => void;
  commissionSharedPct: number | '';
  onCommissionSharedPctChange: (value: number | '') => void;
}

function CommercialSchemeStepComponent({
  isExclusive,
  onExclusiveChange,
  selectedModes,
  rentalCommissionModel,
  onRentalCommissionModelChange,
  monthlyPrice,
  monthlyCurrency,
  commissionTotalPct,
  onCommissionTotalPctChange,
  commissionSharedPct,
  onCommissionSharedPctChange,
}: CommercialSchemeStepProps) {
  const showsPercentageFields = selectedModes.includes('SALE')
    || selectedModes.includes('SHORT_RENT')
    || rentalCommissionModel === 'PERCENTAGE';

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4 text-brand-black"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Briefcase className="w-4 h-4" />
          <span>Paso 10: Esquema Comercial</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Configura las comisiones compartidas de la red y la exclusividad del inmueble.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl border bg-white">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="isExclusive"
              checked={isExclusive}
              onChange={(event) => onExclusiveChange(event.target.checked)}
              className="w-4 h-4 accent-brand-accent cursor-pointer"
            />
            <label htmlFor="isExclusive" className="text-xs font-bold text-brand-black cursor-pointer">Ficha en Exclusiva</label>
          </div>
          <p className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">
            Al marcar esto, confirmas que posees los derechos exclusivos de promoción y comercialización del inmueble. Las propiedades en exclusiva reciben hasta un 40% más de visibilidad en el feed y búsquedas de Towers México.
          </p>
        </div>

        {selectedModes.includes('MONTHLY_RENT') && (
          <div className="rounded-2xl border border-brand-gray-200 bg-brand-gray-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-black text-brand-black">Comisión por renta mensual</p>
                <p className="mt-0.5 text-[10px] text-brand-gray-500">Indica cómo se acordó la captación con la inmobiliaria.</p>
              </div>
              {rentalCommissionModel === 'ONE_MONTH_RENT' && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                  ${Number(monthlyPrice || 0).toLocaleString('es-MX')} {monthlyCurrency}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['ONE_MONTH_RENT', 'Un mes de renta', 'La comisión total equivale a una mensualidad.'],
                ['PERCENTAGE', 'Porcentaje acordado', 'Úsalo sólo si tu acuerdo fue definido en porcentaje.'],
              ] as const).map(([value, label, description]) => {
                const isActive = rentalCommissionModel === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onRentalCommissionModelChange(value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      isActive
                        ? 'border-brand-black bg-brand-black text-white shadow-sm'
                        : 'border-brand-gray-200 bg-white text-brand-black hover:border-brand-gray-400'
                    }`}
                  >
                    <span className="block text-xs font-black">{label}</span>
                    <span className={`mt-1 block text-[9px] leading-relaxed ${isActive ? 'text-white/70' : 'text-brand-gray-400'}`}>
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showsPercentageFields && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray-500">
                {selectedModes.includes('SALE') ? 'Captación total (%)' : 'Comisión total (%)'}
              </label>
              <input
                type="number"
                value={commissionTotalPct}
                onChange={(event) => onCommissionTotalPctChange(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Ej. 5"
                className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
              />
              <p className="text-[9px] text-brand-gray-400 leading-normal">Porcentaje total al que se captó la propiedad, por ejemplo 5% o 6%.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray-500">Comisión Compartida (%)</label>
              <input
                type="number"
                value={commissionSharedPct}
                onChange={(event) => onCommissionSharedPctChange(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Ej. 2.5"
                className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
              />
              <p className="text-[9px] text-brand-gray-400 leading-normal">Comisión que compartes con el broker co-operador que traiga el cliente final.</p>
            </div>
          </div>
        )}

        <div className="p-3 bg-brand-gray-50/50 border border-dashed rounded-2xl flex flex-col gap-1 mt-2">
          <span className="text-[10px] font-black text-brand-black uppercase tracking-wider">Optimización SEO Inteligente</span>
          <p className="text-[10px] text-brand-gray-500 leading-normal">
            Para tu comodidad, las etiquetas Meta Title, Meta Description y OpenGraph se generarán automáticamente en segundo plano utilizando inteligencia artificial a partir de los datos cargados en el paso 1.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export const CommercialSchemeStep = memo(CommercialSchemeStepComponent);
