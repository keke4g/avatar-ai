'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Building,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';

import { useTranslation } from '@/lib/context/LanguageContext';
import type { PropertyWizardDraft } from '@/lib/propertyWizardDraft';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { Property } from '@/lib/types';
import type {
  AdminPropertyCollectionStats,
  AdminPropertySortField,
  AdminPropertyStatusFilter,
} from './adminTypes';
import { ADMIN_PAGINATION_LIMIT } from './adminTypes';

// Inventory media can use publisher-provided hosts, so it stays unoptimized
// instead of requiring an unsafe wildcard remotePattern.

interface AdminPropertiesTabProps {
  properties: Property[];
  wizardDraft: PropertyWizardDraft | null;
  propertyCollectionStats: AdminPropertyCollectionStats;
  publisherGateLoading: boolean;
  propertySearch: string;
  propertyTypeFilter: string;
  propertyStatusFilter: AdminPropertyStatusFilter;
  propertyTierFilter: string;
  propertySortField: AdminPropertySortField;
  propertySortAscending: boolean;
  paginatedProperties: Property[];
  shouldShowWizardDraft: boolean;
  openPropertyMenuId: string | null;
  propertyPage: number;
  totalPropertyPages: number;
  totalPropertyCount: number;
  onCreateProperty: () => Promise<void>;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: AdminPropertyStatusFilter) => void;
  onTierFilterChange: (value: string) => void;
  onSortChange: (field: AdminPropertySortField, ascending: boolean) => void;
  onPageChange: Dispatch<SetStateAction<number>>;
  onMenuIdChange: Dispatch<SetStateAction<string | null>>;
  onDraftDelete: () => void;
  onOpenProperty: (property: Property) => void;
  onDuplicateProperty: (property: Property) => Promise<void>;
  onTogglePublish: (id: string, title: string) => Promise<void>;
  onDeleteProperty: (property: Property) => Promise<void>;
  onToggleFeature: (id: string, title: string) => void;
}

export function AdminPropertiesTab({
  properties,
  wizardDraft,
  propertyCollectionStats,
  publisherGateLoading,
  propertySearch,
  propertyTypeFilter,
  propertyStatusFilter,
  propertyTierFilter,
  propertySortField,
  propertySortAscending,
  paginatedProperties,
  shouldShowWizardDraft,
  openPropertyMenuId,
  propertyPage,
  totalPropertyPages,
  totalPropertyCount,
  onCreateProperty,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onTierFilterChange,
  onSortChange,
  onPageChange,
  onMenuIdChange,
  onDraftDelete,
  onOpenProperty,
  onDuplicateProperty,
  onTogglePublish,
  onDeleteProperty,
  onToggleFeature,
}: AdminPropertiesTabProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      key="properties"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-5"
    >
      <div className="relative overflow-hidden rounded-[32px] bg-slate-950 px-6 py-7 text-white shadow-[0_30px_80px_-42px_rgba(15,23,42,0.75)] sm:px-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/8" />
        <div className="absolute -right-6 -top-10 h-36 w-36 rounded-full border border-violet-400/20" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              <LayoutGrid className="h-3.5 w-3.5" />
              Biblioteca de contenido
            </div>
            <h2 className="text-2xl font-black tracking-[-0.045em] sm:text-3xl">Propiedades</h2>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-400 sm:text-sm">
              Explora el inventario visualmente y abre cada ficha para administrar todos sus campos, multimedia y publicación.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCreateProperty()}
            disabled={publisherGateLoading}
            className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-2xl bg-white px-5 text-xs font-black uppercase tracking-[0.08em] text-slate-950 shadow-lg transition hover:bg-emerald-300 xl:self-auto"
          >
            {publisherGateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Nueva propiedad</span>
          </button>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: 'Inventario', value: properties.length + (wizardDraft ? 1 : 0), tone: 'text-white' },
            { label: 'Publicadas', value: propertyCollectionStats.published, tone: 'text-emerald-300' },
            { label: 'En revisión', value: propertyCollectionStats.review, tone: 'text-amber-300' },
            { label: 'Borradores', value: propertyCollectionStats.draft, tone: 'text-violet-300' },
            { label: 'Ocultas', value: propertyCollectionStats.hidden, tone: 'text-slate-300' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 backdrop-blur-sm">
              <p className={`text-xl font-black tracking-tight ${stat.tone}`}>{stat.value}</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_55px_-40px_rgba(15,23,42,0.45)]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search className="w-4 h-4 text-brand-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, ciudad o folio…"
              value={propertySearch}
              onChange={(event) => onSearchChange(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-xs font-semibold outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100/60"
            />
          </div>

          <div>
            <select
              value={propertyTypeFilter}
              onChange={(event) => onTypeFilterChange(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold outline-none focus:border-violet-400"
            >
              <option value="All">Todos los tipos</option>
              <option value="Apartment">Departamento</option>
              <option value="Beach House">Casa de playa</option>
              <option value="Cabin">Cabaña / terreno</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Villa">Casa / villa</option>
              <option value="Loft">Loft</option>
            </select>
          </div>

          <div>
            <select
              value={propertyStatusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as AdminPropertyStatusFilter)}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold outline-none focus:border-violet-400"
            >
              <option value="All">Todos los estados</option>
              <option value="Published">Publicadas</option>
              <option value="Review">En revisión</option>
              <option value="Draft">Borradores</option>
              <option value="Hidden">Ocultas</option>
            </select>
          </div>

          <div>
            <select
              value={propertyTierFilter}
              onChange={(event) => onTierFilterChange(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold outline-none focus:border-violet-400"
            >
              <option value="All">Todas las categorías</option>
              <option value="Premium">Premium</option>
              <option value="Luxury">Luxury</option>
              <option value="Exclusive">Exclusive</option>
              <option value="Curated">Curated</option>
            </select>
          </div>

          <div>
            <select
              value={`${propertySortField}:${propertySortAscending ? 'asc' : 'desc'}`}
              onChange={(event) => {
                const [field, direction] = event.target.value.split(':') as [AdminPropertySortField, 'asc' | 'desc'];
                onSortChange(field, direction === 'asc');
              }}
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-bold outline-none focus:border-violet-400"
            >
              <option value="title:asc">Título A–Z</option>
              <option value="title:desc">Título Z–A</option>
              <option value="location:asc">Ubicación</option>
              <option value="auraScore:desc">Mayor Towers Score</option>
            </select>
          </div>
        </div>
      </div>

      {paginatedProperties.length === 0 && !shouldShowWizardDraft ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Building className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-black text-slate-900">No encontramos propiedades</h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">Prueba otra búsqueda o limpia los filtros para volver a ver el inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shouldShowWizardDraft && wizardDraft ? (
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => void onCreateProperty()}
              className="group cursor-pointer overflow-hidden rounded-[26px] border border-violet-200 bg-white shadow-[0_20px_60px_-40px_rgba(109,40,217,0.5)] transition duration-300 hover:-translate-y-1 hover:border-violet-400"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#0f172a,#312e81)]">
                {wizardDraft.images?.[0] ? (
                  <Image
                    src={wizardDraft.images[0]}
                    alt={wizardDraft.title || 'Borrador de propiedad'}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                    className="object-cover opacity-90 transition duration-700 group-hover:scale-[1.045]"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-white/10 text-white backdrop-blur">
                      <Edit className="h-6 w-6" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/65 to-transparent p-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.09em] text-violet-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    Borrador automático
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMenuIdChange((current) => current === wizardDraft.draftId ? null : wizardDraft.draftId);
                      }}
                      aria-label="Abrir acciones del borrador"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur transition hover:bg-black/65"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openPropertyMenuId === wizardDraft.draftId ? (
                      <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl">
                        <button type="button" onClick={() => void onCreateProperty()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] font-bold hover:bg-slate-50">
                          <Edit className="h-3.5 w-3.5" /> Continuar
                        </button>
                        <button type="button" onClick={onDraftDelete} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] font-bold text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent p-4 pt-12 text-white">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] backdrop-blur">
                    <ImageIcon className="h-3 w-3" />
                    {wizardDraft.images?.length || 0}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.1em]">
                    Paso {Math.max(1, Number(wizardDraft.step || 1))}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">Guardado automáticamente</p>
                <h3 className="mt-1 line-clamp-2 min-h-10 text-[15px] font-black leading-tight tracking-[-0.025em] text-slate-950">
                  {wizardDraft.title || 'Propiedad sin título'}
                </h3>
                <p className="mt-2 flex items-center gap-1.5 truncate text-[10px] font-semibold text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  {[wizardDraft.location, wizardDraft.country].filter(Boolean).join(', ') || 'Ubicación pendiente'}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    Expira el {new Date(wizardDraft.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void onCreateProperty(); }} className="min-h-9 rounded-xl bg-violet-600 px-3 text-[10px] font-black text-white transition hover:bg-violet-700">
                    Continuar
                  </button>
                </div>
              </div>
            </motion.article>
          ) : null}

          {paginatedProperties.map((property, index) => {
            const status = property.folderStatus === 'UNDER_REVIEW'
              ? { label: 'En revisión', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
              : property.isPublished === true
                ? { label: 'Publicada', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                : property.folderStatus === 'DRAFT'
                  ? { label: 'Borrador', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
                  : { label: 'Oculta', dot: 'bg-rose-400', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
            const primaryOffering = property.offerings?.find((offering) => offering.status === 'ACTIVE')
              || property.offerings?.[0];
            const price = primaryOffering?.priceAmount
              ? new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: primaryOffering.currency || 'MXN',
                maximumFractionDigits: 0,
              }).format(primaryOffering.priceAmount)
              : null;
            const operation = primaryOffering?.mode === 'SALE'
              ? 'Venta'
              : primaryOffering?.mode === 'MONTHLY_RENT'
                ? 'Renta mensual'
                : primaryOffering?.mode === 'SHORT_RENT'
                  ? 'Estancias'
                  : primaryOffering?.mode === 'SWAP'
                    ? 'Intercambio'
                    : property.primaryOperation === 'SALE'
                      ? 'Venta'
                      : property.primaryOperation === 'RENT'
                        ? 'Renta'
                        : 'Intercambio';

            return (
              <motion.article
                key={property.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.25) }}
                onClick={() => onOpenProperty(property)}
                className="group cursor-pointer overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_55px_-42px_rgba(15,23,42,0.5)] transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_28px_70px_-40px_rgba(76,29,149,0.38)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  {property.images?.[0] ? (
                    <Image
                      src={property.images[0]}
                      alt={property.title}
                      fill
                      sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      className="object-cover transition duration-700 group-hover:scale-[1.045]"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <ImageIcon className="h-9 w-9" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent p-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.09em] backdrop-blur-md ${status.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      {property.isFeatured ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/35 text-amber-300 backdrop-blur-md">
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </span>
                      ) : null}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMenuIdChange((current) => current === property.id ? null : property.id);
                        }}
                        aria-label={`Abrir acciones de ${property.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/65"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openPropertyMenuId === property.id ? (
                        <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl">
                          <button type="button" onClick={() => void onDuplicateProperty(property)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold transition hover:bg-slate-50">
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                            Duplicar
                          </button>
                          <button type="button" onClick={() => void onTogglePublish(property.id, property.title).finally(() => onMenuIdChange(null))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold transition hover:bg-slate-50">
                            {property.isPublished ? <EyeOff className="h-3.5 w-3.5 text-slate-500" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                            {property.isPublished ? 'Ocultar' : 'Hacer visible'}
                          </button>
                          <div className="my-1 h-px bg-slate-100" />
                          <button type="button" onClick={() => void onDeleteProperty(property)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold text-rose-600 transition hover:bg-rose-50">
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-4 pt-10 text-white">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur-md">{operation}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur-md">
                        <ImageIcon className="h-3 w-3" />
                        {property.images?.length || 0}
                      </span>
                    </div>
                    {price ? <span className="text-sm font-black tracking-tight">{price}</span> : null}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">
                        {property.internalCode || `ID ${property.id.slice(0, 8)}`}
                      </p>
                      <h3 className="mt-1 line-clamp-2 min-h-10 text-[15px] font-black leading-tight tracking-[-0.025em] text-slate-950">
                        {property.title}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-xl bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">
                      Towers {property.auraScore}
                    </span>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 truncate text-[10px] font-semibold text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    {formatPropertyLocation(property.location, property.country)}
                  </p>

                  <div className="mt-4 flex items-center gap-3 border-y border-slate-100 py-3 text-[10px] font-bold text-slate-600">
                    <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-slate-400" />{property.bedrooms || 0}</span>
                    <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5 text-slate-400" />{property.bathrooms || 0}</span>
                    <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 text-slate-400" />{property.parkingSpaces || 0}</span>
                    {property.surfaceBuilt || property.surfaceTotal ? (
                      <span className="ml-auto text-slate-500">{property.surfaceBuilt || property.surfaceTotal} m²</span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenProperty(property);
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-[10px] font-black text-white transition hover:bg-violet-700"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Administrar
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFeature(property.id, property.title);
                        }}
                        aria-label={property.isFeatured ? 'Quitar de destacados' : 'Destacar propiedad'}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${property.isFeatured ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400 hover:text-amber-600'}`}
                      >
                        <Star className={`h-3.5 w-3.5 ${property.isFeatured ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.open(`/property/${property.id}`, '_blank', 'noopener,noreferrer');
                        }}
                        aria-label="Ver propiedad en el sitio"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {totalPropertyPages > 1 ? (
        <div className="flex items-center justify-between border-t border-brand-gray-100 pt-4">
          <span className="text-[10px] text-brand-gray-400 font-bold">
            {t('admin.showingPropsMsg', {
              start: (propertyPage - 1) * ADMIN_PAGINATION_LIMIT + 1,
              end: Math.min(totalPropertyCount, propertyPage * ADMIN_PAGINATION_LIMIT),
              total: totalPropertyCount,
            })}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange((previous) => Math.max(1, previous - 1))}
              disabled={propertyPage === 1}
              className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-brand-black px-3 select-none">
              {propertyPage} / {totalPropertyPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange((previous) => Math.min(totalPropertyPages, previous + 1))}
              disabled={propertyPage === totalPropertyPages}
              className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
