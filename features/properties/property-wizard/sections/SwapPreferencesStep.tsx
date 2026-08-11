import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { CustomSelect } from '../components/CustomSelect';

interface SwapPreferencesStepProps {
  fieldErrors: Record<string, string>;
  salePrice: number;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setSalePrice: Dispatch<SetStateAction<number>>;
  setSwapAcceptsCash: Dispatch<SetStateAction<boolean>>;
  setSwapAcceptsDept: Dispatch<SetStateAction<boolean>>;
  setSwapAcceptsHouse: Dispatch<SetStateAction<boolean>>;
  setSwapAcceptsLand: Dispatch<SetStateAction<boolean>>;
  setSwapAcceptsVehicle: Dispatch<SetStateAction<boolean>>;
  setSwapMaxCashDiff: Dispatch<SetStateAction<number | ''>>;
  setSwapMaxValue: Dispatch<SetStateAction<number | ''>>;
  setSwapMinValue: Dispatch<SetStateAction<number | ''>>;
  setSwapPreferences: Dispatch<SetStateAction<string>>;
  setSwapPriority: Dispatch<SetStateAction<'Alta' | 'Media' | 'Baja'>>;
  swapAcceptsCash: boolean;
  swapAcceptsDept: boolean;
  swapAcceptsHouse: boolean;
  swapAcceptsLand: boolean;
  swapAcceptsVehicle: boolean;
  swapMaxCashDiff: number | '';
  swapMaxValue: number | '';
  swapMinValue: number | '';
  swapPreferences: string;
  swapPriority: 'Alta' | 'Media' | 'Baja';
}

function SwapPreferencesStepComponent({
  fieldErrors,
  salePrice,
  scrollAreaRef,
  setSalePrice,
  setSwapAcceptsCash,
  setSwapAcceptsDept,
  setSwapAcceptsHouse,
  setSwapAcceptsLand,
  setSwapAcceptsVehicle,
  setSwapMaxCashDiff,
  setSwapMaxValue,
  setSwapMinValue,
  setSwapPreferences,
  setSwapPriority,
  swapAcceptsCash,
  swapAcceptsDept,
  swapAcceptsHouse,
  swapAcceptsLand,
  swapAcceptsVehicle,
  swapMaxCashDiff,
  swapMaxValue,
  swapMinValue,
  swapPreferences,
  swapPriority,
}: SwapPreferencesStepProps) {
  return (
    <motion.div
      key="step6"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4 text-brand-black"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Sparkles className="w-4 h-4" />
          <span>Paso 6: Configuración de Swap / Intercambio</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Define qué tipo de propiedad buscas y las condiciones de permuta.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Valor estimado de tu propiedad <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0"
            value={salePrice || ''}
            onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
            placeholder="Ej. 4500000"
            className={`w-full rounded-xl border bg-brand-gray-50 p-3 text-xs font-semibold text-brand-black outline-none focus:border-brand-accent ${
              fieldErrors.price ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
            }`}
          />
          {fieldErrors.price && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-brand-rose">
              <span>⚠</span> <span>{fieldErrors.price}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">¿Qué buscas recibir? <span className="font-medium text-brand-gray-400">(opcional)</span></label>
          <input
            type="text"
            value={swapPreferences}
            onChange={(e) => setSwapPreferences(e.target.value)}
            placeholder="Ej. Casa o Depto frente al mar en Mazatlán o Sinaloa"
            className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent ${
              fieldErrors.swapPreferences ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
            }`}
          />
          {fieldErrors.swapPreferences && (
            <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
              <span>⚠</span> <span>{fieldErrors.swapPreferences}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Valor Mínimo Deseado</label>
            <input
              type="number"
              value={swapMinValue || ''}
              onChange={(e) => setSwapMinValue(Number(e.target.value) || 0)}
              placeholder="Ej. 3000000"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Valor Máximo Deseado</label>
            <input
              type="number"
              value={swapMaxValue || ''}
              onChange={(e) => setSwapMaxValue(Number(e.target.value) || 0)}
              placeholder="Ej. 6000000"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Diferencia Económica Máxima</label>
            <input
              type="number"
              value={swapMaxCashDiff}
              onChange={(e) => setSwapMaxCashDiff(Number(e.target.value) || '')}
              placeholder="Monto en efectivo que puedes aportar o recibir"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Prioridad del Intercambio</label>
            <CustomSelect
              value={swapPriority}
              onChange={(val) => setSwapPriority(val as any)}
              options={[
                { value: 'Alta', label: 'Alta (Urgente)' },
                { value: 'Media', label: 'Media (Estándar)' },
                { value: 'Baja', label: 'Baja (Informativo)' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">¿Qué estás dispuesto a aceptar?</span>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
              <input
                type="checkbox"
                id="swapAcceptsDept"
                checked={swapAcceptsDept}
                onChange={(e) => setSwapAcceptsDept(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="swapAcceptsDept" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Departamento</label>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
              <input
                type="checkbox"
                id="swapAcceptsHouse"
                checked={swapAcceptsHouse}
                onChange={(e) => setSwapAcceptsHouse(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="swapAcceptsHouse" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Casa</label>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
              <input
                type="checkbox"
                id="swapAcceptsLand"
                checked={swapAcceptsLand}
                onChange={(e) => setSwapAcceptsLand(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="swapAcceptsLand" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Terreno</label>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
              <input
                type="checkbox"
                id="swapAcceptsVehicle"
                checked={swapAcceptsVehicle}
                onChange={(e) => setSwapAcceptsVehicle(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="swapAcceptsVehicle" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Vehículo / Auto</label>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white col-span-2">
              <input
                type="checkbox"
                id="swapAcceptsCash"
                checked={swapAcceptsCash}
                onChange={(e) => setSwapAcceptsCash(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="swapAcceptsCash" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Efectivo como compensación</label>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const SwapPreferencesStep = memo(SwapPreferencesStepComponent);
