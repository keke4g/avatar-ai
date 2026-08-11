import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';

import type { Property } from '@/lib/types';
import { CustomSelect } from '../components/CustomSelect';
import type { UIType } from '../types';

interface BasicInfoStepProps {
  developmentName: string;
  fieldErrors: Record<string, string>;
  handleImportListing: () => void;
  initialData?: Property | null;
  isImportPanelExpanded: boolean;
  isImportingListing: boolean;
  listingImportError: string;
  listingImportProvider: string;
  listingImportSummary: string[];
  listingSourceText: string;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setDescription: Dispatch<SetStateAction<string>>;
  setDevelopmentName: Dispatch<SetStateAction<string>>;
  setIsImportPanelExpanded: Dispatch<SetStateAction<boolean>>;
  setListingImportError: Dispatch<SetStateAction<string>>;
  setListingSourceText: Dispatch<SetStateAction<string>>;
  setShortDescription: Dispatch<SetStateAction<string>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setType: Dispatch<SetStateAction<UIType>>;
  shortDescription: string;
  title: string;
  type: UIType;
}

function BasicInfoStepComponent({
  developmentName,
  fieldErrors,
  handleImportListing,
  initialData,
  isImportPanelExpanded,
  isImportingListing,
  listingImportError,
  listingImportProvider,
  listingImportSummary,
  listingSourceText,
  scrollAreaRef,
  setDescription,
  setDevelopmentName,
  setIsImportPanelExpanded,
  setListingImportError,
  setListingSourceText,
  setShortDescription,
  setTitle,
  setType,
  shortDescription,
  title,
  type,
}: BasicInfoStepProps) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Info className="w-4 h-4" />
          <span>Paso 1: Información Básica</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Pega un anuncio existente para ahorrar tiempo o captura cada dato manualmente.</p>
      </div>

      {!initialData && (
        <section
          aria-label="Carga rápida desde un anuncio"
          className={`overflow-hidden rounded-2xl border transition-all ${
            listingImportSummary.length > 0
              ? 'border-emerald-200 bg-emerald-50/45'
              : 'border-brand-accent/20 bg-gradient-to-br from-brand-accent/[0.07] via-white to-white'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsImportPanelExpanded((previous) => !previous)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            aria-expanded={isImportPanelExpanded}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              listingImportSummary.length > 0
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-black text-white'
            }`}>
              {listingImportSummary.length > 0
                ? <Check className="h-4 w-4" />
                : <FileText className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-brand-black">
                  {listingImportSummary.length > 0
                    ? 'Datos precargados desde tu anuncio'
                    : 'Carga rápida desde un anuncio'}
                </span>
                <span className="rounded-full border border-brand-gray-200 bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-brand-gray-500">
                  Opcional
                </span>
              </span>
              <span className="mt-0.5 block text-[10px] font-medium leading-relaxed text-brand-gray-500">
                {listingImportSummary.length > 0
                  ? 'Revisa y corrige cada campo normalmente en los siguientes pasos.'
                  : 'Pega el texto de WhatsApp, Facebook o tu ficha comercial.'}
              </span>
            </span>
            {isImportPanelExpanded
              ? <ChevronUp className="h-4 w-4 shrink-0 text-brand-gray-400" />
              : <ChevronDown className="h-4 w-4 shrink-0 text-brand-gray-400" />}
          </button>

          <AnimatePresence initial={false}>
            {isImportPanelExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="border-t border-brand-gray-200/70 px-4 pb-4 pt-3">
                  <label htmlFor="listing-source-text" className="sr-only">
                    Texto del anuncio existente
                  </label>
                  <textarea
                    id="listing-source-text"
                    rows={6}
                    maxLength={12000}
                    value={listingSourceText}
                    onChange={(event) => {
                      setListingSourceText(event.target.value);
                      setListingImportError('');
                    }}
                    placeholder={'Ej. En venta, casa con 4 recámaras, 2.5 baños, 144 m² de terreno...'}
                    className="w-full resize-none rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold leading-relaxed text-brand-black outline-none transition placeholder:text-brand-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10"
                  />

                  {listingImportError && (
                    <p className="mt-2 flex items-start gap-1.5 text-[10px] font-bold leading-relaxed text-brand-rose">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{listingImportError}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[9px] font-bold text-brand-gray-400">
                      {listingSourceText.length.toLocaleString('es-MX')} / 12,000 caracteres
                    </span>
                    <button
                      type="button"
                      onClick={handleImportListing}
                      disabled={listingSourceText.trim().length < 20 || isImportingListing}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-black px-4 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:bg-brand-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isImportingListing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Sparkles className="h-3.5 w-3.5 text-brand-accent" />}
                      <span>{isImportingListing ? 'Analizando anuncio…' : 'Analizar y completar campos'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {listingImportSummary.length > 0 && !isImportPanelExpanded && (
            <div className="flex flex-wrap gap-1.5 border-t border-emerald-200/80 px-4 py-3">
              {listingImportSummary.map((fact) => (
                <span
                  key={fact}
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-bold text-emerald-800"
                >
                  {fact}
                </span>
              ))}
              {listingImportProvider === 'local_fallback' && (
                <span className="w-full pt-1 text-[9px] font-medium text-brand-gray-500">
                  Análisis rápido completado. Verifica los datos antes de publicar.
                </span>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Título del anuncio <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Moderna Villa con alberca en Marina Mazatlán"
            className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent ${
              fieldErrors.title ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
            }`}
          />
          {fieldErrors.title && (
            <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
              <span>⚠</span> <span>{fieldErrors.title}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Nombre del Desarrollo / Residencial <span className="text-brand-gray-400 font-normal">(Opcional)</span></label>
          <input
            type="text"
            value={developmentName}
            onChange={(e) => setDevelopmentName(e.target.value)}
            placeholder="Ej. Marina Gardens, La Primavera"
            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Resumen / Descripción de la propiedad <span className="font-medium text-brand-gray-400">(opcional)</span></label>
          <textarea
            rows={4}
            value={shortDescription}
            onChange={(e) => {
              setShortDescription(e.target.value);
              setDescription(e.target.value); // Sync to description to prevent double input
            }}
            placeholder="Describe la distribución de la propiedad, habitaciones, accesos y ventajas (mín. 30 caracteres)"
            className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent resize-none leading-relaxed ${
              fieldErrors.description ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
            }`}
          />
          {fieldErrors.description && (
            <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
              <span>⚠</span> <span>{fieldErrors.description}</span>
            </p>
          )}
          <span className="text-[10px] text-right text-brand-gray-400 font-bold">
            {shortDescription.length} caracteres
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Tipo de Propiedad <span className="text-red-500">*</span></label>
          <CustomSelect
            value={type}
            onChange={(val) => setType(val as UIType)}
            options={[
              { value: 'Casa', label: 'Casa' },
              { value: 'Departamento', label: 'Departamento' },
              { value: 'Penthouse', label: 'Penthouse' },
              { value: 'Townhouse', label: 'Townhouse' },
              { value: 'Villa', label: 'Villa' },
              { value: 'Casa de Playa', label: 'Casa de Playa' },
              { value: 'Cabaña', label: 'Cabaña' },
              { value: 'Loft', label: 'Loft' },
              { value: 'Terreno', label: 'Terreno' },
              { value: 'Local Comercial', label: 'Local Comercial' }
            ]}
            placeholder="Selecciona el tipo de inmueble..."
            scrollContainerRef={scrollAreaRef}
          />
        </div>
      </div>
    </motion.div>
  );
}

export const BasicInfoStep = memo(BasicInfoStepComponent);
