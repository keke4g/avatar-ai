import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Sliders } from 'lucide-react';

import { CustomSelect } from '../components/CustomSelect';

interface TechnicalSpecsStepProps {
  bathrooms: number;
  bedrooms: number;
  conservationState: string;
  constructionAge: number | '';
  constructionType: string;
  fieldErrors: Record<string, string>;
  halfBathrooms: number;
  levelsCount: number;
  parkingSpaces: number;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setBathrooms: Dispatch<SetStateAction<number>>;
  setBedrooms: Dispatch<SetStateAction<number>>;
  setConservationState: Dispatch<SetStateAction<string>>;
  setConstructionAge: Dispatch<SetStateAction<number | ''>>;
  setConstructionType: Dispatch<SetStateAction<string>>;
  setHalfBathrooms: Dispatch<SetStateAction<number>>;
  setLevelsCount: Dispatch<SetStateAction<number>>;
  setParkingSpaces: Dispatch<SetStateAction<number>>;
  setSurfaceBuilt: Dispatch<SetStateAction<number | ''>>;
  setSurfaceDepth: Dispatch<SetStateAction<number | ''>>;
  setSurfaceFront: Dispatch<SetStateAction<number | ''>>;
  setSurfaceGarden: Dispatch<SetStateAction<number>>;
  setSurfacePatio: Dispatch<SetStateAction<number>>;
  setSurfaceRoofGarden: Dispatch<SetStateAction<number>>;
  setSurfaceTerrace: Dispatch<SetStateAction<number>>;
  setSurfaceTotal: Dispatch<SetStateAction<number | ''>>;
  surfaceBuilt: number | '';
  surfaceDepth: number | '';
  surfaceFront: number | '';
  surfaceGarden: number;
  surfacePatio: number;
  surfaceRoofGarden: number;
  surfaceTerrace: number;
  surfaceTotal: number | '';
}

function TechnicalSpecsStepComponent({
  bathrooms,
  bedrooms,
  conservationState,
  constructionAge,
  constructionType,
  fieldErrors,
  halfBathrooms,
  levelsCount,
  parkingSpaces,
  scrollAreaRef,
  setBathrooms,
  setBedrooms,
  setConservationState,
  setConstructionAge,
  setConstructionType,
  setHalfBathrooms,
  setLevelsCount,
  setParkingSpaces,
  setSurfaceBuilt,
  setSurfaceDepth,
  setSurfaceFront,
  setSurfaceGarden,
  setSurfacePatio,
  setSurfaceRoofGarden,
  setSurfaceTerrace,
  setSurfaceTotal,
  surfaceBuilt,
  surfaceDepth,
  surfaceFront,
  surfaceGarden,
  surfacePatio,
  surfaceRoofGarden,
  surfaceTerrace,
  surfaceTotal,
}: TechnicalSpecsStepProps) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <Sliders className="w-4 h-4" />
          <span>Paso 4: Ficha Técnica y Superficies</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa las características constructivas y medidas en metros cuadrados.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Recámaras</label>
            <input
              type="number"
              min="0"
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value) || 0)}
              className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${
                fieldErrors.bedrooms ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
              }`}
            />
            {fieldErrors.bedrooms && (
              <p className="text-[9px] text-brand-rose mt-0.5 font-bold leading-tight">
                {fieldErrors.bedrooms}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Baños Completos</label>
            <input
              type="number"
              min="0"
              value={bathrooms}
              onChange={(e) => setBathrooms(Number(e.target.value) || 0)}
              className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${
                fieldErrors.bathrooms ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
              }`}
            />
            {fieldErrors.bathrooms && (
              <p className="text-[9px] text-brand-rose mt-0.5 font-bold leading-tight">
                {fieldErrors.bathrooms}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Medios Baños</label>
            <input
              type="number"
              min="0"
              value={halfBathrooms}
              onChange={(e) => setHalfBathrooms(Number(e.target.value) || 0)}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Cajones Estac.</label>
            <input
              type="number"
              min="0"
              value={parkingSpaces}
              onChange={(e) => setParkingSpaces(Number(e.target.value) || 0)}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Niveles / Piso</label>
            <input
              type="number"
              min="0"
              value={levelsCount}
              onChange={(e) => setLevelsCount(Number(e.target.value) || 0)}
              className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${
                fieldErrors.levelsCount ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
              }`}
            />
            {fieldErrors.levelsCount && (
              <p className="text-[9px] text-brand-rose mt-0.5 font-bold leading-tight">
                {fieldErrors.levelsCount}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Edad (Años)</label>
            <input
              type="number"
              min="0"
              value={constructionAge}
              onChange={(e) => setConstructionAge(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Estilo Arquitectura</label>
            <CustomSelect
              value={constructionType}
              onChange={(val) => setConstructionType(val)}
              options={[
                { value: 'Modern', label: 'Moderna' },
                { value: 'Contemporary', label: 'Contemporánea' },
                { value: 'Classic', label: 'Clásica' },
                { value: 'Minimalist', label: 'Minimalista' },
                { value: 'Rustic', label: 'Rústica' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Estado de Conservación</label>
            <CustomSelect
              value={conservationState}
              onChange={(val) => setConservationState(val)}
              options={[
                { value: 'Excellent', label: 'Excelente' },
                { value: 'Good', label: 'Bueno' },
                { value: 'Fair', label: 'Regular' },
                { value: 'Remodelado', label: 'Remodelado' },
                { value: 'Para remodelar', label: 'Requiere remodelación' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-brand-gray-100 pt-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Terreno M² (Superficie Total)</label>
            <input
              type="number"
              value={surfaceTotal}
              onChange={(e) => setSurfaceTotal(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Construcción M² (Superficie Útil)</label>
            <input
              type="number"
              value={surfaceBuilt}
              onChange={(e) => setSurfaceBuilt(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Frente del Terreno (m)</label>
            <input
              type="number"
              value={surfaceFront}
              onChange={(e) => setSurfaceFront(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-brand-gray-500">Fondo del Terreno (m)</label>
            <input
              type="number"
              value={surfaceDepth}
              onChange={(e) => setSurfaceDepth(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-brand-gray-500">Jardín M²</label>
            <input
              type="number"
              value={surfaceGarden}
              onChange={(e) => setSurfaceGarden(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-brand-gray-500">Terraza M²</label>
            <input
              type="number"
              value={surfaceTerrace}
              onChange={(e) => setSurfaceTerrace(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-brand-gray-500">Roof G. M²</label>
            <input
              type="number"
              value={surfaceRoofGarden}
              onChange={(e) => setSurfaceRoofGarden(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-brand-gray-500">Patio M²</label>
            <input
              type="number"
              value={surfacePatio}
              onChange={(e) => setSurfacePatio(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-xl border border-brand-gray-200 text-xs font-semibold"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const TechnicalSpecsStep = memo(TechnicalSpecsStepComponent);
