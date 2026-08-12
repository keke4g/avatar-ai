import { memo } from 'react';
import { Building, ChevronDown, ShieldCheck, Wifi } from 'lucide-react';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { Property } from '@/lib/types';

interface SpecFieldConfig {
  key: keyof Property;
  labelEs: string;
  labelEn: string;
  format?: (value: unknown, language: LanguageType) => string;
}

interface PropertyTechnicalDetailsProps {
  property: Property;
  language: LanguageType;
  expanded?: boolean;
}

const SPEC_FIELDS: SpecFieldConfig[] = [
  { key: 'developmentName', labelEs: 'Desarrollo', labelEn: 'Development' },
  { key: 'subdivisionName', labelEs: 'Fraccionamiento', labelEn: 'Subdivision' },
  { key: 'privateNeighborhood', labelEs: 'Privada', labelEn: 'Gated Community', format: (value, language) => typeof value === 'boolean' ? (value ? (language === 'es' ? 'Sí' : 'Yes') : 'No') : String(value) },
  { key: 'phaseStage', labelEs: 'Etapa/Fase', labelEn: 'Phase/Stage' },
  { key: 'lotNumber', labelEs: 'Número de lote', labelEn: 'Lot Number' },
  { key: 'blockNumber', labelEs: 'Manzana', labelEn: 'Block' },
  { key: 'condominiumRegime', labelEs: 'Régimen de condominio', labelEn: 'Condominium Regime', format: (value, language) => value ? (language === 'es' ? 'Sí' : 'Yes') : 'No' },
  { key: 'maintenanceFeeAmount', labelEs: 'Mantenimiento mensual', labelEn: 'Monthly Maintenance', format: (value) => `$${value} USD` },
  { key: 'neighborhood', labelEs: 'Colonia / Barrio', labelEn: 'Neighborhood' },
  { key: 'postalCode', labelEs: 'Código Postal', labelEn: 'Postal Code' },
  { key: 'streetName', labelEs: 'Calle', labelEn: 'Street' },
  { key: 'streetNumber', labelEs: 'Número exterior', labelEn: 'Street Number' },
  { key: 'locationReference', labelEs: 'Referencia de ubicación', labelEn: 'Location Reference' },
  { key: 'levelsCount', labelEs: 'Niveles', labelEn: 'Levels' },
  { key: 'constructionAge', labelEs: 'Antigüedad', labelEn: 'Age', format: (value, language) => value === 0 ? (language === 'es' ? 'Nueva' : 'Brand New') : `${value} ${language === 'es' ? 'años' : 'years'}` },
  { key: 'conservationStateId', labelEs: 'Estado de conservación', labelEn: 'Conservation State' },
  { key: 'constructionTypeId', labelEs: 'Tipo de construcción', labelEn: 'Construction Type' },
  { key: 'surfaceTotal', labelEs: 'Superficie de terreno', labelEn: 'Total Land Area', format: (value) => `${value} m²` },
  { key: 'surfaceBuilt', labelEs: 'Superficie de construcción', labelEn: 'Built Area', format: (value) => `${value} m²` },
  { key: 'surfaceFront', labelEs: 'Frente', labelEn: 'Frontage', format: (value) => `${value} m` },
  { key: 'surfaceDepth', labelEs: 'Fondo', labelEn: 'Depth', format: (value) => `${value} m` },
  { key: 'surfaceGarden', labelEs: 'Superficie de jardín', labelEn: 'Garden Area', format: (value) => `${value} m²` },
  { key: 'surfaceTerrace', labelEs: 'Superficie de terraza', labelEn: 'Terrace Area', format: (value) => `${value} m²` },
  { key: 'surfaceRoofGarden', labelEs: 'Superficie de Roof Garden', labelEn: 'Roof Garden Area', format: (value) => `${value} m²` },
  { key: 'surfacePatio', labelEs: 'Superficie de patio', labelEn: 'Patio Area', format: (value) => `${value} m²` },
  { key: 'viewTypeId', labelEs: 'Vista', labelEn: 'View' },
  { key: 'orientationId', labelEs: 'Orientación', labelEn: 'Orientation' },
  { key: 'internalCode', labelEs: 'Clave Interna', labelEn: 'Internal Code' },
];

const SERVICES_FIELDS: SpecFieldConfig[] = [
  { key: 'servicesWater', labelEs: 'Agua potable', labelEn: 'Drinking Water', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesElectricity', labelEs: 'Electricidad', labelEn: 'Electricity', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesSewerage', labelEs: 'Drenaje / Alcantarillado', labelEn: 'Sewerage', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesNatGas', labelEs: 'Gas Natural', labelEn: 'Natural Gas', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesLpGas', labelEs: 'Gas LP', labelEn: 'LP Gas', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesInternet', labelEs: 'Conexión a Internet', labelEn: 'Internet Access' },
  { key: 'servicesGarbage', labelEs: 'Recolección de basura', labelEn: 'Garbage Collection', format: (value, language) => value ? (language === 'es' ? 'Disponible/Activa' : 'Available/Active') : '' },
];

const SECURITY_FIELDS: SpecFieldConfig[] = [
  { key: 'securityCctv', labelEs: 'Sistema de CCTV / Cámaras', labelEn: 'CCTV Camera System', format: (value, language) => value ? (language === 'es' ? 'Instalado/Activo' : 'Installed/Active') : '' },
  { key: 'securityGuardhouse', labelEs: 'Caseta de vigilancia', labelEn: 'Security Guardhouse', format: (value, language) => value ? (language === 'es' ? 'Disponible' : 'Available') : '' },
  { key: 'security24_7', labelEs: 'Seguridad 24/7', labelEn: '24/7 Security Service', format: (value, language) => value ? (language === 'es' ? 'Activa' : 'Active') : '' },
  { key: 'securityBiometric', labelEs: 'Acceso biométrico / digital', labelEn: 'Biometric/Digital Access', format: (value, language) => value ? (language === 'es' ? 'Instalado' : 'Installed') : '' },
];

const hasMeaningfulSpecValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 && !/^0(?:\.0+)?$/.test(normalized);
  }
  return true;
};

function buildRows(property: Property, fields: SpecFieldConfig[], language: LanguageType) {
  return fields.flatMap((field) => {
    const rawValue = property[field.key];
    if (!hasMeaningfulSpecValue(rawValue)) return [];

    return [{
      key: String(field.key),
      label: language === 'es' ? field.labelEs : field.labelEn,
      value: field.format ? field.format(rawValue, language) : String(rawValue),
    }];
  });
}

export const PropertyTechnicalDetails = memo(function PropertyTechnicalDetails({
  property,
  language,
  expanded = false,
}: PropertyTechnicalDetailsProps) {
  const groups = [
    {
      key: 'construction',
      Icon: Building,
      title: language === 'es' ? 'Construcción y superficies' : 'Construction and surfaces',
      rows: buildRows(property, SPEC_FIELDS, language),
    },
    {
      key: 'services',
      Icon: Wifi,
      title: language === 'es' ? 'Servicios y suministros' : 'Services and utilities',
      rows: buildRows(property, SERVICES_FIELDS, language),
    },
    {
      key: 'security',
      Icon: ShieldCheck,
      title: language === 'es' ? 'Seguridad y vigilancia' : 'Security and safety',
      rows: buildRows(property, SECURITY_FIELDS, language),
    },
  ].filter((group) => group.rows.length > 0);

  if (groups.length === 0) return null;

  const detailCount = groups.reduce((total, group) => total + group.rows.length, 0);

  return (
    <details open={expanded || undefined} className="group overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_22px_55px_-42px_rgba(15,23,42,0.55)]">
      <summary className="flex min-h-[88px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-neutral-950 text-white shadow-[0_12px_24px_-16px_rgba(0,0,0,0.95)]">
            <Building className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.17em] text-neutral-400">
              {language === 'es' ? 'Información del inmueble' : 'Property information'}
            </span>
            <span className="mt-1 block text-sm font-black tracking-[-0.025em] text-brand-black sm:text-lg">
              {language === 'es' ? 'Detalles técnicos y servicios' : 'Technical details and services'}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold text-brand-gray-500">
              {language === 'es'
                ? `${detailCount} datos de construcción, suministros y seguridad`
                : `${detailCount} construction, utility and security details`}
            </span>
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-gray-200 bg-brand-gray-50 text-brand-gray-600 transition-transform duration-200 group-open:rotate-180">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </summary>

      <div className="border-t border-neutral-200/70 bg-neutral-50/35 px-5 py-5 sm:px-6 sm:py-6">
        <div className="space-y-7">
          {groups.map(({ key, Icon, title, rows }) => (
            <section key={key} aria-labelledby={`property-${key}-heading`}>
              <h4 id={`property-${key}-heading`} className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.11em] text-brand-gray-600">
                <Icon className="h-4 w-4 text-brand-black" aria-hidden="true" />
                {title}
              </h4>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-4">
                {rows.map((row) => (
                  <div key={row.key} className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-brand-gray-200/70 bg-white px-3.5 py-2.5">
                    <dt className="text-xs font-semibold leading-tight text-brand-gray-500">{row.label}</dt>
                    <dd className="text-right text-xs font-black leading-tight text-brand-black">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
});
