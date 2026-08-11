import { memo, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

import { shouldSyncSuggestedRentalDeposit } from '@/lib/rentalTerms';
import type { RentalFurnishingStatus } from '../types';

interface RentalTermsStepProps {
  acceptsPets: boolean;
  advanceMonths: number;
  fieldErrors: Record<string, string>;
  includesElectricity: boolean;
  includesInternet: boolean;
  includesMaintenance: boolean;
  includesWater: boolean;
  monthlyAvailableFrom: string;
  monthlyCurrency: 'MXN' | 'USD';
  monthlyDeposit: number;
  monthlyMinMonths: number;
  monthlyPrice: number;
  rentalFurnishingStatus: RentalFurnishingStatus;
  rentRules: string;
  requiresGuarantor: boolean;
  requiresLegalPolicy: boolean;
  setAcceptsPets: Dispatch<SetStateAction<boolean>>;
  setAdvanceMonths: Dispatch<SetStateAction<number>>;
  setIncludesElectricity: Dispatch<SetStateAction<boolean>>;
  setIncludesInternet: Dispatch<SetStateAction<boolean>>;
  setIncludesMaintenance: Dispatch<SetStateAction<boolean>>;
  setIncludesWater: Dispatch<SetStateAction<boolean>>;
  setMonthlyAvailableFrom: Dispatch<SetStateAction<string>>;
  setMonthlyCurrency: Dispatch<SetStateAction<'MXN' | 'USD'>>;
  setMonthlyDeposit: Dispatch<SetStateAction<number>>;
  setMonthlyMinMonths: Dispatch<SetStateAction<number>>;
  setMonthlyPrice: Dispatch<SetStateAction<number>>;
  setRentalFurnishingStatus: Dispatch<SetStateAction<RentalFurnishingStatus>>;
  setRentRules: Dispatch<SetStateAction<string>>;
  setRequiresGuarantor: Dispatch<SetStateAction<boolean>>;
  setRequiresLegalPolicy: Dispatch<SetStateAction<boolean>>;
}

function RentalTermsStepComponent({
  acceptsPets,
  advanceMonths,
  fieldErrors,
  includesElectricity,
  includesInternet,
  includesMaintenance,
  includesWater,
  monthlyAvailableFrom,
  monthlyCurrency,
  monthlyDeposit,
  monthlyMinMonths,
  monthlyPrice,
  rentalFurnishingStatus,
  rentRules,
  requiresGuarantor,
  requiresLegalPolicy,
  setAcceptsPets,
  setAdvanceMonths,
  setIncludesElectricity,
  setIncludesInternet,
  setIncludesMaintenance,
  setIncludesWater,
  setMonthlyAvailableFrom,
  setMonthlyCurrency,
  setMonthlyDeposit,
  setMonthlyMinMonths,
  setMonthlyPrice,
  setRentalFurnishingStatus,
  setRentRules,
  setRequiresGuarantor,
  setRequiresLegalPolicy,
}: RentalTermsStepProps) {
  return (
    <motion.div
      key="step7"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4 text-brand-black"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Calendar className="w-4 h-4" />
          <span>Paso 7: Condiciones y Tarifas de Renta</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los precios de renta, depósito y condiciones de arrendamiento.</p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Price fields depending on short / monthly modes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Renta mensual <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0"
              value={monthlyPrice}
              onChange={(e) => {
                const nextPrice = Number(e.target.value) || 0;
                setMonthlyDeposit((currentDeposit) => (
                  shouldSyncSuggestedRentalDeposit(currentDeposit, monthlyPrice)
                    ? nextPrice
                    : currentDeposit
                ));
                setMonthlyPrice(nextPrice);
              }}
              placeholder="Monto al mes"
              className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent ${
                fieldErrors.rentPrice ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
              }`}
            />
            {fieldErrors.rentPrice && (
              <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                <span>⚠</span> <span>{fieldErrors.rentPrice}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="monthlyCurrency" className="text-xs font-bold text-brand-gray-500">Moneda</label>
            <select
              id="monthlyCurrency"
              value={monthlyCurrency}
              onChange={(e) => setMonthlyCurrency(e.target.value as 'MXN' | 'USD')}
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            >
              <option value="MXN">MXN ($)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Depósito de garantía ({monthlyCurrency})</label>
            <input
              type="number"
              min="0"
              value={monthlyDeposit}
              onChange={(e) => setMonthlyDeposit(Number(e.target.value) || 0)}
              placeholder="Depósito de garantía"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
            />
            <p className="text-[10px] font-medium leading-relaxed text-brand-gray-400">
              Sugerimos un mes de renta. Puedes modificarlo o indicar $0.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Meses Adelantados</label>
            <input
              type="number"
              min="0"
              value={advanceMonths}
              onChange={(e) => setAdvanceMonths(Number(e.target.value) || 0)}
              placeholder="Ej. 1"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Plazo Mínimo (Meses)</label>
            <input
              type="number"
              min="1"
              value={monthlyMinMonths}
              onChange={(e) => setMonthlyMinMonths(Number(e.target.value) || 1)}
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Disponible A Partir De</label>
            <input
              type="date"
              value={monthlyAvailableFrom}
              onChange={(e) => setMonthlyAvailableFrom(e.target.value)}
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Mantenimiento Incluido</label>
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl border bg-white h-[42px]">
              <input
                type="checkbox"
                id="includesMaintenance"
                checked={includesMaintenance}
                onChange={(e) => setIncludesMaintenance(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="includesMaintenance" className="text-xs font-bold text-brand-black cursor-pointer">Sí, incluido</label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
            <input
              type="checkbox"
              id="requiresGuarantor"
              checked={requiresGuarantor}
              onChange={(e) => setRequiresGuarantor(e.target.checked)}
              className="w-4 h-4 accent-brand-accent cursor-pointer"
            />
            <label htmlFor="requiresGuarantor" className="text-xs font-bold text-brand-black cursor-pointer">Aval Requerido</label>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
            <input
              type="checkbox"
              id="requiresLegalPolicy"
              checked={requiresLegalPolicy}
              onChange={(e) => setRequiresLegalPolicy(e.target.checked)}
              className="w-4 h-4 accent-brand-accent cursor-pointer"
            />
            <label htmlFor="requiresLegalPolicy" className="text-xs font-bold text-brand-black cursor-pointer">Póliza Jurídica</label>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
            <input
              type="checkbox"
              id="acceptsPets"
              checked={acceptsPets}
              onChange={(e) => setAcceptsPets(e.target.checked)}
              className="w-4 h-4 accent-brand-accent cursor-pointer"
            />
            <label htmlFor="acceptsPets" className="text-xs font-bold text-brand-black cursor-pointer">Acepta Mascotas</label>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold text-brand-gray-500">Estado del mobiliario</legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['UNFURNISHED', 'Sin amueblar'],
              ['SEMI_FURNISHED', 'Semi-amueblado'],
              ['FURNISHED', 'Amueblado'],
            ] as Array<[RentalFurnishingStatus, string]>).map(([value, label]) => {
              const isSelected = rentalFurnishingStatus === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setRentalFurnishingStatus(value)}
                  className={`min-h-12 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    isSelected
                      ? 'border-brand-black bg-brand-black text-white shadow-sm'
                      : 'border-brand-gray-200 bg-white text-brand-black hover:border-brand-gray-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold text-brand-gray-500">Servicios incluidos en la renta</legend>
          <p className="text-[10px] text-brand-gray-400">Selecciona únicamente los servicios que cubre la mensualidad.</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['includedWater', 'Agua', includesWater, setIncludesWater],
              ['includedElectricity', 'Luz', includesElectricity, setIncludesElectricity],
              ['includedInternet', 'Internet', includesInternet, setIncludesInternet],
            ] as Array<[string, string, boolean, Dispatch<SetStateAction<boolean>>]>).map(([id, label, checked, setter]) => (
              <label
                key={id}
                htmlFor={id}
                className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                  checked ? 'border-brand-black bg-brand-gray-50' : 'border-brand-gray-200 bg-white'
                }`}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4 accent-brand-accent"
                />
                <span className="text-xs font-bold text-brand-black">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Reglas del Inmueble</label>
          <textarea
            rows={2}
            value={rentRules}
            onChange={(e) => setRentRules(e.target.value)}
            placeholder="Ej. No fiestas, fumar solo en terraza, horario de ruido..."
            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent resize-none text-brand-black"
          />
        </div>
      </div>
    </motion.div>
  );
}

export const RentalTermsStep = memo(RentalTermsStepComponent);
