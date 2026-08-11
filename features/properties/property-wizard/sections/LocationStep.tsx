import { memo, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { MapPin, PencilLine, Search } from 'lucide-react';

import GoogleAddressAutocomplete from '@/components/maps/GoogleAddressAutocomplete';
import type { GoogleAddressResult } from '@/lib/maps/types';

interface LocationStepProps {
  addressEntryMode: 'google' | 'manual';
  applyGoogleAddress: (result: GoogleAddressResult) => void;
  city: string | null;
  country: string;
  fieldErrors: Record<string, string>;
  formattedAddress: string | null;
  handleAddressFieldEdit: () => void;
  locationReference: string;
  neighborhood: string;
  postalCode: string;
  setAddressEntryMode: Dispatch<SetStateAction<'google' | 'manual'>>;
  setCity: Dispatch<SetStateAction<string | null>>;
  setCountry: Dispatch<SetStateAction<string>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setLocationReference: Dispatch<SetStateAction<string>>;
  setNeighborhood: Dispatch<SetStateAction<string>>;
  setPostalCode: Dispatch<SetStateAction<string>>;
  setShowPublicAddress: Dispatch<SetStateAction<boolean>>;
  setStateName: Dispatch<SetStateAction<string | null>>;
  setStreetName: Dispatch<SetStateAction<string>>;
  setStreetNumber: Dispatch<SetStateAction<string>>;
  showPublicAddress: boolean;
  stateName: string | null;
  streetName: string;
  streetNumber: string;
}

function LocationStepComponent({
  addressEntryMode,
  applyGoogleAddress,
  city,
  country,
  fieldErrors,
  formattedAddress,
  handleAddressFieldEdit,
  locationReference,
  neighborhood,
  postalCode,
  setAddressEntryMode,
  setCity,
  setCountry,
  setLocation,
  setLocationReference,
  setNeighborhood,
  setPostalCode,
  setShowPublicAddress,
  setStateName,
  setStreetName,
  setStreetNumber,
  showPublicAddress,
  stateName,
  streetName,
  streetNumber,
}: LocationStepProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <MapPin className="w-4 h-4" />
          <span>Paso 2: Ubicación Geográfica</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa la localización exacta e indica qué mostrar públicamente.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-brand-gray-200 bg-brand-gray-100 p-1" role="tablist" aria-label="Forma de capturar la dirección">
          <button
            type="button"
            role="tab"
            aria-selected={addressEntryMode === 'google'}
            onClick={() => setAddressEntryMode('google')}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black transition ${
              addressEntryMode === 'google'
                ? 'bg-white text-brand-black shadow-sm'
                : 'text-brand-gray-500 hover:text-brand-black'
            }`}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Buscar con Google</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={addressEntryMode === 'manual'}
            onClick={() => setAddressEntryMode('manual')}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black transition ${
              addressEntryMode === 'manual'
                ? 'bg-white text-brand-black shadow-sm'
                : 'text-brand-gray-500 hover:text-brand-black'
            }`}
          >
            <PencilLine className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Captura manual</span>
          </button>
        </div>

        {addressEntryMode === 'google' ? (
          <GoogleAddressAutocomplete
            onSelect={applyGoogleAddress}
            selectedAddress={formattedAddress}
          />
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
              <PencilLine className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-black text-slate-950">Escribir la dirección manualmente</span>
              <span className="mt-1 block text-[10px] font-medium leading-relaxed text-slate-500">
                Completa ciudad y país para continuar. Los demás datos son opcionales y podrás corregirlos cuando quieras.
              </span>
            </span>
          </div>
        )}

        <section className="rounded-2xl border border-brand-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-xs font-black text-brand-black">Zona de la propiedad</h5>
              <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-brand-gray-500">Esta información ayuda a encontrar el anuncio y se muestra en su ubicación principal.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5" data-error={fieldErrors.city ? 'true' : 'false'}>
              <label htmlFor="property-city" className="text-xs font-bold text-brand-gray-600">Ciudad <span className="text-brand-rose">*</span></label>
              <input id="property-city" type="text" required autoComplete="address-level2" value={city || ''}
                onChange={(e) => { const value = e.target.value; setCity(value); setLocation(value); handleAddressFieldEdit(); }}
                placeholder="Ej. Culiacán"
                className={`w-full rounded-xl border bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-accent/10 ${fieldErrors.city ? 'border-brand-rose' : 'border-brand-gray-200 focus:border-brand-accent'}`}
              />
              {fieldErrors.city && <p className="text-[10px] font-bold text-brand-rose">⚠ {fieldErrors.city}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="property-state" className="text-xs font-bold text-brand-gray-600">Estado / Provincia</label>
              <input id="property-state" type="text" autoComplete="address-level1" value={stateName || ''}
                onChange={(e) => { setStateName(e.target.value); handleAddressFieldEdit(); }} placeholder="Ej. Sinaloa"
                className="w-full rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/10" />
            </div>
            <div className="flex flex-col gap-1.5" data-error={fieldErrors.country ? 'true' : 'false'}>
              <label htmlFor="property-country" className="text-xs font-bold text-brand-gray-600">País <span className="font-medium text-brand-gray-400">(predeterminado: México)</span></label>
              <input id="property-country" type="text" autoComplete="country-name" value={country}
                onChange={(e) => { setCountry(e.target.value); handleAddressFieldEdit(); }} placeholder="Ej. México"
                className={`w-full rounded-xl border bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-accent/10 ${fieldErrors.country ? 'border-brand-rose' : 'border-brand-gray-200 focus:border-brand-accent'}`} />
              {fieldErrors.country && <p className="text-[10px] font-bold text-brand-rose">⚠ {fieldErrors.country}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="property-neighborhood" className="text-xs font-bold text-brand-gray-600">Colonia / Fraccionamiento</label>
              <input id="property-neighborhood" type="text" autoComplete="address-level3" value={neighborhood}
                onChange={(e) => { setNeighborhood(e.target.value); handleAddressFieldEdit(); }} placeholder="Ej. Tres Ríos"
                className="w-full rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/10" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-brand-gray-200 bg-brand-gray-50/70 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h5 className="text-xs font-black text-brand-black">Dirección exacta</h5>
              <p className="mt-0.5 text-[10px] font-medium text-brand-gray-500">Completa lo que tengas disponible. Puedes mantener estos datos privados.</p>
            </div>
            <span className="rounded-full border border-brand-gray-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-brand-gray-500">Opcional</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <label htmlFor="property-street" className="text-xs font-bold text-brand-gray-600">Calle</label>
              <input id="property-street" type="text" autoComplete="address-line1" value={streetName}
                onChange={(e) => { setStreetName(e.target.value); handleAddressFieldEdit(); }} placeholder="Ej. Av. Álvaro Obregón"
                className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label htmlFor="property-number" className="text-xs font-bold text-brand-gray-600">Número</label>
              <input id="property-number" type="text" value={streetNumber}
                onChange={(e) => { setStreetNumber(e.target.value); handleAddressFieldEdit(); }} placeholder="123"
                className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="property-postal" className="text-xs font-bold text-brand-gray-600">Código postal</label>
              <input id="property-postal" type="text" inputMode="numeric" autoComplete="postal-code" value={postalCode}
                onChange={(e) => { setPostalCode(e.target.value); handleAddressFieldEdit(); }} placeholder="80000"
                className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-6">
              <label htmlFor="property-reference" className="text-xs font-bold text-brand-gray-600">Referencia para llegar</label>
              <input id="property-reference" type="text" value={locationReference} onChange={(e) => setLocationReference(e.target.value)}
                placeholder="Ej. Frente al parque municipal"
                className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
            </div>
          </div>
        </section>

        <label htmlFor="showPublicAddress" className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-accent/20 bg-brand-accent/[0.04] p-4 transition hover:border-brand-accent/40">
          <input type="checkbox" id="showPublicAddress" checked={showPublicAddress} onChange={(e) => setShowPublicAddress(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-accent" />
          <span>
            <span className="block text-xs font-black text-brand-black">Mostrar la dirección completa en el anuncio</span>
            <span className="mt-1 block text-[10px] font-medium leading-relaxed text-brand-gray-500">Si lo desactivas, los visitantes solo verán la zona aproximada: colonia y ciudad.</span>
          </span>
        </label>
      </div>
    </motion.div>
  );
}

export const LocationStep = memo(LocationStepComponent);
