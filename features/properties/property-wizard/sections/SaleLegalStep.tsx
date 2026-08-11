import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';

import { CustomSelect } from '../components/CustomSelect';

type OptionalBoolean = boolean | null;
type AppreciationLevel = 'Alta' | 'Media' | 'Baja' | 'En desarrollo' | '';

interface SaleLegalStepProps {
  acceptsBankCredit: boolean;
  acceptsCash: boolean;
  acceptsFovissste: boolean;
  acceptsInfonavit: boolean;
  appraisalAmount: number | '';
  appraisalDate: string;
  appraisalExpert: string;
  appraisalValidity: string;
  appreciationLevel: AppreciationLevel;
  commercialStatus: string;
  condoRegime: boolean;
  developerFinancing: boolean;
  fieldErrors: Record<string, string>;
  legalDebtFree: OptionalBoolean;
  legalDocumentationComplete: OptionalBoolean;
  legalIsMortgaged: OptionalBoolean;
  legalJuridicalResponsible: string;
  legalLandUse: string;
  legalLastUpdate: string;
  legalLienObservations: string;
  legalLienType: string;
  legalPublicDeed: OptionalBoolean;
  legalRegime: string;
  legalRestrictions: string;
  legalServicesPaid: OptionalBoolean;
  legalTaxCurrent: OptionalBoolean;
  maintenanceFee: number | '';
  saleCurrency: string;
  salePrice: number;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setAcceptsBankCredit: Dispatch<SetStateAction<boolean>>;
  setAcceptsCash: Dispatch<SetStateAction<boolean>>;
  setAcceptsFovissste: Dispatch<SetStateAction<boolean>>;
  setAcceptsInfonavit: Dispatch<SetStateAction<boolean>>;
  setAppraisalAmount: Dispatch<SetStateAction<number | ''>>;
  setAppraisalDate: Dispatch<SetStateAction<string>>;
  setAppraisalExpert: Dispatch<SetStateAction<string>>;
  setAppraisalValidity: Dispatch<SetStateAction<string>>;
  setAppreciationLevel: Dispatch<SetStateAction<AppreciationLevel>>;
  setCommercialStatus: Dispatch<SetStateAction<string>>;
  setCondoRegime: Dispatch<SetStateAction<boolean>>;
  setDeveloperFinancing: Dispatch<SetStateAction<boolean>>;
  setLegalDebtFree: Dispatch<SetStateAction<OptionalBoolean>>;
  setLegalDocumentationComplete: Dispatch<SetStateAction<OptionalBoolean>>;
  setLegalIsMortgaged: Dispatch<SetStateAction<OptionalBoolean>>;
  setLegalJuridicalResponsible: Dispatch<SetStateAction<string>>;
  setLegalLandUse: Dispatch<SetStateAction<string>>;
  setLegalLastUpdate: Dispatch<SetStateAction<string>>;
  setLegalLienObservations: Dispatch<SetStateAction<string>>;
  setLegalLienType: Dispatch<SetStateAction<string>>;
  setLegalOwnerType: Dispatch<SetStateAction<string>>;
  setLegalPublicDeed: Dispatch<SetStateAction<OptionalBoolean>>;
  setLegalRegime: Dispatch<SetStateAction<string>>;
  setLegalRestrictions: Dispatch<SetStateAction<string>>;
  setLegalServicesPaid: Dispatch<SetStateAction<OptionalBoolean>>;
  setLegalTaxCurrent: Dispatch<SetStateAction<OptionalBoolean>>;
  setMaintenanceFee: Dispatch<SetStateAction<number | ''>>;
  setSaleCurrency: Dispatch<SetStateAction<string>>;
  setSalePrice: Dispatch<SetStateAction<number>>;
}

function SaleLegalStepComponent({
  acceptsBankCredit,
  acceptsCash,
  acceptsFovissste,
  acceptsInfonavit,
  appraisalAmount,
  appraisalDate,
  appraisalExpert,
  appraisalValidity,
  appreciationLevel,
  commercialStatus,
  condoRegime,
  developerFinancing,
  fieldErrors,
  legalDebtFree,
  legalDocumentationComplete,
  legalIsMortgaged,
  legalJuridicalResponsible,
  legalLandUse,
  legalLastUpdate,
  legalLienObservations,
  legalLienType,
  legalPublicDeed,
  legalRegime,
  legalRestrictions,
  legalServicesPaid,
  legalTaxCurrent,
  maintenanceFee,
  saleCurrency,
  salePrice,
  scrollAreaRef,
  setAcceptsBankCredit,
  setAcceptsCash,
  setAcceptsFovissste,
  setAcceptsInfonavit,
  setAppraisalAmount,
  setAppraisalDate,
  setAppraisalExpert,
  setAppraisalValidity,
  setAppreciationLevel,
  setCommercialStatus,
  setCondoRegime,
  setDeveloperFinancing,
  setLegalDebtFree,
  setLegalDocumentationComplete,
  setLegalIsMortgaged,
  setLegalJuridicalResponsible,
  setLegalLandUse,
  setLegalLastUpdate,
  setLegalLienObservations,
  setLegalLienType,
  setLegalOwnerType,
  setLegalPublicDeed,
  setLegalRegime,
  setLegalRestrictions,
  setLegalServicesPaid,
  setLegalTaxCurrent,
  setMaintenanceFee,
  setSaleCurrency,
  setSalePrice,
}: SaleLegalStepProps) {
  return (
    <motion.div
      key="step8"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4 text-brand-black"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <FileText className="w-4 h-4" />
          <span>Paso 8: Términos y Legal de Venta</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Configura el precio de venta, avalúo y las condiciones legales del expediente.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Precio de Venta <span className="text-red-500">*</span></label>
            <input
              type="number"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
              placeholder="Monto total"
              className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent text-brand-black ${
                fieldErrors.salePrice ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
              }`}
            />
            {fieldErrors.salePrice && (
              <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                <span>⚠</span> <span>{fieldErrors.salePrice}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Moneda</label>
            <CustomSelect
              value={saleCurrency}
              onChange={(val) => setSaleCurrency(val)}
              options={[
                { value: 'MXN', label: 'MXN ($)' },
                { value: 'USD', label: 'USD ($)' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-gray-500">
              Formas de pago aceptadas
            </span>
            <p className="mt-0.5 text-[9px] font-medium text-brand-gray-400">
              Si importaste un anuncio, aquí verás los créditos detectados.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              {
                id: 'acceptsBankCredit',
                label: 'Crédito bancario',
                checked: acceptsBankCredit,
                setChecked: setAcceptsBankCredit,
              },
              {
                id: 'acceptsInfonavit',
                label: 'Infonavit',
                checked: acceptsInfonavit,
                setChecked: setAcceptsInfonavit,
              },
              {
                id: 'acceptsFovissste',
                label: 'Fovissste',
                checked: acceptsFovissste,
                setChecked: setAcceptsFovissste,
              },
              {
                id: 'acceptsCash',
                label: 'Contado',
                checked: acceptsCash,
                setChecked: setAcceptsCash,
              },
              {
                id: 'developerFinancing',
                label: 'Financiamiento directo',
                checked: developerFinancing,
                setChecked: setDeveloperFinancing,
              },
            ].map((method) => (
              <label
                key={method.id}
                htmlFor={method.id}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition ${
                  method.checked
                    ? 'border-brand-accent/35 bg-brand-accent/[0.06] text-brand-black'
                    : 'border-brand-gray-200 bg-white text-brand-gray-500'
                }`}
              >
                <input
                  id={method.id}
                  type="checkbox"
                  checked={method.checked}
                  onChange={(event) => method.setChecked(event.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 accent-brand-accent"
                />
                <span>{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Mantenimiento Mensual ($)</label>
            <input
              type="number"
              value={maintenanceFee}
              onChange={(e) => setMaintenanceFee(Number(e.target.value) || '')}
              placeholder="Cuota de condominio"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Régimen de Propiedad</label>
            <CustomSelect
              value={legalRegime}
              onChange={(val) => {
                setLegalRegime(val);
                setLegalOwnerType(val); // Sync for backwards compatibility
              }}
              options={[
                { value: 'Propiedad Privada', label: 'Propiedad Privada (Escriturada)' },
                { value: 'Condominal', label: 'Régimen de Condominio' },
                { value: 'Ejidal', label: 'Ejidal / Posesión' },
                { value: 'Fideicomiso', label: 'Fideicomiso Bancario' },
                { value: 'Otro', label: 'Otro Régimen' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Uso de Suelo</label>
            <CustomSelect
              value={legalLandUse}
              onChange={(val) => setLegalLandUse(val)}
              options={[
                { value: 'Residencial', label: 'Residencial' },
                { value: 'Comercial', label: 'Comercial' },
                { value: 'Mixto', label: 'Mixto (Residencial/Comercial)' },
                { value: 'Industrial', label: 'Industrial' },
                { value: 'Otro', label: 'Otro' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Estado Comercial</label>
            <CustomSelect
              value={commercialStatus}
              onChange={(val) => setCommercialStatus(val)}
              options={[
                { value: 'Disponible', label: 'Disponible' },
                { value: 'Apartada', label: 'Apartada' },
                { value: 'Promesa de Compra', label: 'Promesa de Compra' },
                { value: 'En Escrituración', label: 'En Escrituración' },
                { value: 'Vendida', label: 'Vendida' },
                { value: 'Rentada', label: 'Rentada' },
                { value: 'Suspendida', label: 'Suspendida' },
                { value: 'Bajo Oferta', label: 'Bajo Oferta' },
                { value: 'En negociación', label: 'En negociación' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Estado Jurídico del Gravamen</label>
            <CustomSelect
              value={legalDebtFree == null ? 'UNKNOWN' : legalDebtFree ? 'YES' : 'NO'}
              onChange={(val) => setLegalDebtFree(val === 'UNKNOWN' ? null : val === 'YES')}
              options={[
                { value: 'UNKNOWN', label: 'Sin verificar' },
                { value: 'YES', label: 'Verificado: libre de gravamen' },
                { value: 'NO', label: 'Verificado: con gravamen activo' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          {legalDebtFree === false && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray-500">Tipo de Gravamen</label>
              <CustomSelect
                value={legalLienType}
                onChange={(val) => setLegalLienType(val)}
                options={[
                  { value: 'Banco', label: 'Banco / Hipotecario' },
                  { value: 'Infonavit', label: 'Infonavit' },
                  { value: 'FOVISSSTE', label: 'FOVISSSTE' },
                  { value: 'Particular', label: 'Particular' },
                  { value: 'Hipoteca privada', label: 'Hipoteca Privada' },
                  { value: 'Embargo', label: 'Embargo Activo' },
                  { value: 'Otro', label: 'Otro' }
                ]}
                scrollContainerRef={scrollAreaRef}
              />
            </div>
          )}
        </div>

        {legalDebtFree === false && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Observaciones del Gravamen</label>
            <textarea
              rows={2}
              value={legalLienObservations}
              onChange={(e) => setLegalLienObservations(e.target.value)}
              placeholder="Mencione el saldo aproximado, banco acreedor o detalles del gravamen..."
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent resize-none text-brand-black"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Evidencia verificada</span>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ['Escritura pública', legalPublicDeed, setLegalPublicDeed, 'Sí, verificada', 'No disponible', 'Sin verificar'],
              ['Predial al corriente', legalTaxCurrent, setLegalTaxCurrent, 'Sí, al corriente', 'No está al corriente', 'Sin verificar'],
              ['Servicios pagados', legalServicesPaid, setLegalServicesPaid, 'Sí, pagados', 'Con adeudos', 'Sin verificar'],
              ['Situación hipotecaria', legalIsMortgaged, setLegalIsMortgaged, 'Hipoteca activa', 'Sin hipoteca activa', 'No lo sé'],
              ['Expediente completo', legalDocumentationComplete, setLegalDocumentationComplete, 'Sí, completo', 'Incompleto', 'Sin verificar'],
            ] as const).map(([label, value, setter, yesLabel, noLabel, unknownLabel]) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-brand-gray-500">{label}</label>
                <CustomSelect
                  value={value == null ? 'UNKNOWN' : value ? 'YES' : 'NO'}
                  onChange={(next) => setter(next === 'UNKNOWN' ? null : next === 'YES')}
                  options={[
                    { value: 'UNKNOWN', label: unknownLabel },
                    { value: 'YES', label: yesLabel },
                    { value: 'NO', label: noLabel },
                  ]}
                  scrollContainerRef={scrollAreaRef}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-brand-gray-100 my-1" />
        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Expediente de Avalúo</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Monto Último Avalúo ($)</label>
            <input
              type="number"
              value={appraisalAmount}
              onChange={(e) => setAppraisalAmount(Number(e.target.value) || '')}
              placeholder="Monto valuado"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Fecha del Avalúo</label>
            <input
              type="date"
              value={appraisalDate}
              onChange={(e) => setAppraisalDate(e.target.value)}
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Perito Valuador</label>
            <input
              type="text"
              value={appraisalExpert}
              onChange={(e) => setAppraisalExpert(e.target.value)}
              placeholder="Nombre del perito / Registro"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Vigencia del Avalúo</label>
            <input
              type="text"
              value={appraisalValidity}
              onChange={(e) => setAppraisalValidity(e.target.value)}
              placeholder="Ej. 6 meses / Fecha de vencimiento"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Plusvalía Estimada</label>
            <CustomSelect
              value={appreciationLevel}
              onChange={(val) => setAppreciationLevel(val as any)}
              options={[
                { value: 'Alta', label: 'Alta' },
                { value: 'Media', label: 'Media' },
                { value: 'Baja', label: 'Baja' },
                { value: 'En desarrollo', label: 'En desarrollo' }
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Sujeto a Régimen de Condominio</label>
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl border bg-white h-[42px]">
              <input
                type="checkbox"
                id="condoRegime"
                checked={condoRegime}
                onChange={(e) => setCondoRegime(e.target.checked)}
                className="w-4 h-4 accent-brand-accent cursor-pointer"
              />
              <label htmlFor="condoRegime" className="text-xs font-bold text-brand-black cursor-pointer">Sí, sujeto</label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Restricciones Legales / Afectaciones</label>
          <textarea
            rows={2}
            value={legalRestrictions}
            onChange={(e) => setLegalRestrictions(e.target.value)}
            placeholder="Mencione afectaciones viales, servidumbres de paso u otras limitaciones..."
            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent resize-none text-brand-black"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Responsable Jurídico</label>
            <input
              type="text"
              value={legalJuridicalResponsible}
              onChange={(e) => setLegalJuridicalResponsible(e.target.value)}
              placeholder="Nombre del abogado"
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-500">Fecha Última Actualización</label>
            <input
              type="date"
              value={legalLastUpdate}
              onChange={(e) => setLegalLastUpdate(e.target.value)}
              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
            />
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export const SaleLegalStep = memo(SaleLegalStepComponent);
