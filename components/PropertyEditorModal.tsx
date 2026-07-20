"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  GalleryHorizontalEnd,
  Home,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Property, PropertyMedia, PropertyOffering, PropertyOfferingMode } from '../lib/types';
import ImageUploadDropzone, { ImageMetadata } from './ImageUploadDropzone';
import VideoUploadDropzone from './VideoUploadDropzone';
import { getVirtualTourProvider } from '../lib/mediaEmbeds';
import GoogleAddressAutocomplete from './maps/GoogleAddressAutocomplete';
import type { GoogleAddressResult } from '../lib/maps/types';

interface PropertyEditorModalProps {
  isOpen: boolean;
  property: Property;
  onClose: () => void;
  onSubmit: (propertyData: Partial<Property>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

type EditorSectionId =
  | 'general'
  | 'location'
  | 'spaces'
  | 'amenities'
  | 'commercial'
  | 'media'
  | 'legal'
  | 'publishing';

type EditorForm = {
  title: string;
  description: string;
  type: Property['type'];
  valueRating: Property['valueRating'];
  developmentName: string;
  subdivisionName: string;
  privateNeighborhood: string;
  phaseStage: string;
  lotNumber: string;
  blockNumber: string;
  condominiumRegime: boolean;
  maintenanceFeeAmount: string;
  internalCode: string;
  primaryOperation: Property['primaryOperation'];
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  streetName: string;
  streetNumber: string;
  postalCode: string;
  locationReference: string;
  showPublicAddress: boolean;
  latitude: string;
  longitude: string;
  placeId: string;
  formattedAddress: string;
  geometrySource: NonNullable<Property['geometrySource']> | '';
  bedrooms: string;
  bathrooms: string;
  halfBathrooms: string;
  parkingSpaces: string;
  levelsCount: string;
  maxGuests: string;
  constructionAge: string;
  surfaceTotal: string;
  surfaceBuilt: string;
  surfaceFront: string;
  surfaceDepth: string;
  surfaceGarden: string;
  surfaceTerrace: string;
  surfaceRoofGarden: string;
  surfacePatio: string;
  amenities: string[];
  rules: string;
  servicesWater: boolean;
  servicesElectricity: boolean;
  servicesSewerage: boolean;
  servicesNatGas: boolean;
  servicesLpGas: boolean;
  servicesInternet: string;
  servicesGarbage: boolean;
  securityCctv: boolean;
  securityGuardhouse: boolean;
  security24_7: boolean;
  securityBiometric: boolean;
  legalDebtFree: boolean;
  legalPublicDeed: boolean;
  legalTaxCurrent: boolean;
  legalServicesPaid: boolean;
  legalOwnerType: string;
  legalIsMortgaged: boolean;
  ownerPrivateName: string;
  ownerPrivatePhone: string;
  ownerPrivateEmail: string;
  ownerContactTime: string;
  images: string[];
  imagesMetadata: Record<string, ImageMetadata>;
  videoUrl: string;
  youtubeUrl: string;
  virtualTourUrl: string;
  offerings: PropertyOffering[];
  isPublished: boolean;
  folderStatus: NonNullable<Property['folderStatus']>;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

const TYPE_OPTIONS: Array<{ value: Property['type']; label: string }> = [
  { value: 'Villa', label: 'Casa / Villa' },
  { value: 'Apartment', label: 'Departamento' },
  { value: 'Penthouse', label: 'Penthouse' },
  { value: 'Beach House', label: 'Casa de playa' },
  { value: 'Cabin', label: 'Cabaña / Terreno' },
  { value: 'Loft', label: 'Loft' },
];

const AMENITIES = [
  'Cocina integral', 'Cocina equipada', 'Cocina con isla', 'Sala doble altura',
  'Family Room', 'Sala TV', 'Oficina', 'Estudio', 'Cuarto de servicio',
  'Cuarto de lavado', 'Vestidor', 'Bodega', 'Bar', 'Cava', 'Alberca',
  'Terraza', 'Roof Garden', 'Jardín', 'Patio', 'Balcón', 'Asador',
  'Domótica', 'Cerradura inteligente', 'Paneles solares', 'Internet fibra óptica',
];

const NAV_ITEMS: Array<{
  id: EditorSectionId;
  label: string;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: 'Información', caption: 'Identidad del anuncio', icon: Home },
  { id: 'location', label: 'Ubicación', caption: 'Dirección y zona', icon: MapPin },
  { id: 'spaces', label: 'Espacios', caption: 'Medidas y capacidad', icon: SlidersHorizontal },
  { id: 'amenities', label: 'Amenidades', caption: 'Servicios y seguridad', icon: Sparkles },
  { id: 'commercial', label: 'Comercial', caption: 'Venta, renta o swap', icon: CircleDollarSign },
  { id: 'media', label: 'Multimedia', caption: 'Fotos, video y recorridos', icon: GalleryHorizontalEnd },
  { id: 'legal', label: 'Expediente', caption: 'Legal y contacto privado', icon: ShieldCheck },
  { id: 'publishing', label: 'Publicación', caption: 'Estado y buscadores', icon: FileCheck2 },
];

const stringValue = (value: unknown) => value == null ? '' : String(value);
const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
const numberOrZero = (value: string) => value.trim() === '' ? 0 : Number(value);

function cloneOfferings(offerings: PropertyOffering[] | undefined): PropertyOffering[] {
  return (offerings || []).map((offering) => ({
    ...offering,
    metadata: { ...(offering.metadata || {}) },
    swapPreferences: { ...(offering.swapPreferences || {}) },
  }));
}

function getMediaUrl(property: Property, types: PropertyMedia['mediaType'][]): string {
  return property.media?.find((item) => types.includes(item.mediaType))?.url || '';
}

function formFromProperty(property: Property): EditorForm {
  const locationParts = (property.location || '').split(',').map((part) => part.trim()).filter(Boolean);
  const trailingPart = locationParts.at(-1);
  if (trailingPart && property.country && trailingPart.localeCompare(property.country, undefined, { sensitivity: 'base' }) === 0) {
    locationParts.pop();
  }
  const inferredCity = property.city || locationParts[0] || '';
  const inferredState = property.state || locationParts.slice(1).join(', ');

  return {
    title: property.title || '',
    description: property.description || property.aiDescription || property.aiSummary || '',
    type: property.type || 'Apartment',
    valueRating: property.valueRating || 'Premium',
    developmentName: property.developmentName || '',
    subdivisionName: property.subdivisionName || '',
    privateNeighborhood: property.privateNeighborhood || '',
    phaseStage: property.phaseStage || '',
    lotNumber: property.lotNumber || '',
    blockNumber: property.blockNumber || '',
    condominiumRegime: property.condominiumRegime ?? false,
    maintenanceFeeAmount: stringValue(property.maintenanceFeeAmount),
    internalCode: property.internalCode || '',
    primaryOperation: property.primaryOperation || 'SWAP',
    city: inferredCity,
    state: inferredState,
    country: property.country || '',
    neighborhood: property.neighborhood || '',
    streetName: property.streetName || property.address || '',
    streetNumber: property.streetNumber || '',
    postalCode: property.postalCode || '',
    locationReference: property.locationReference || '',
    showPublicAddress: property.showPublicAddress ?? true,
    latitude: stringValue(property.latitude),
    longitude: stringValue(property.longitude),
    placeId: property.placeId || '',
    formattedAddress: property.formattedAddress || '',
    geometrySource: property.geometrySource || '',
    bedrooms: stringValue(property.bedrooms),
    bathrooms: stringValue(property.bathrooms),
    halfBathrooms: stringValue(property.halfBathrooms ?? 0),
    parkingSpaces: stringValue(property.parkingSpaces ?? 0),
    levelsCount: stringValue(property.levelsCount ?? 1),
    maxGuests: stringValue(property.maxGuests),
    constructionAge: stringValue(property.constructionAge),
    surfaceTotal: stringValue(property.surfaceTotal),
    surfaceBuilt: stringValue(property.surfaceBuilt),
    surfaceFront: stringValue(property.surfaceFront),
    surfaceDepth: stringValue(property.surfaceDepth),
    surfaceGarden: stringValue(property.surfaceGarden ?? 0),
    surfaceTerrace: stringValue(property.surfaceTerrace ?? 0),
    surfaceRoofGarden: stringValue(property.surfaceRoofGarden ?? 0),
    surfacePatio: stringValue(property.surfacePatio ?? 0),
    amenities: [...(property.amenities || [])],
    rules: (property.rules || []).join('\n'),
    servicesWater: property.servicesWater ?? true,
    servicesElectricity: property.servicesElectricity ?? true,
    servicesSewerage: property.servicesSewerage ?? true,
    servicesNatGas: property.servicesNatGas ?? false,
    servicesLpGas: property.servicesLpGas ?? true,
    servicesInternet: property.servicesInternet || '',
    servicesGarbage: property.servicesGarbage ?? true,
    securityCctv: property.securityCctv ?? false,
    securityGuardhouse: property.securityGuardhouse ?? false,
    security24_7: property.security24_7 ?? false,
    securityBiometric: property.securityBiometric ?? false,
    legalDebtFree: property.legalDebtFree ?? true,
    legalPublicDeed: property.legalPublicDeed ?? true,
    legalTaxCurrent: property.legalTaxCurrent ?? true,
    legalServicesPaid: property.legalServicesPaid ?? true,
    legalOwnerType: property.legalOwnerType || '',
    legalIsMortgaged: property.legalIsMortgaged ?? false,
    ownerPrivateName: property.ownerPrivateName || '',
    ownerPrivatePhone: property.ownerPrivatePhone || '',
    ownerPrivateEmail: property.ownerPrivateEmail || '',
    ownerContactTime: property.ownerContactTime || '',
    images: [...(property.images || [])],
    imagesMetadata: (property.metadata?.imagesMetadata || {}) as Record<string, ImageMetadata>,
    videoUrl: getMediaUrl(property, ['VIDEO']) || stringValue((property as Property & { videoUrl?: string }).videoUrl),
    youtubeUrl: getMediaUrl(property, ['YOUTUBE', 'VIMEO']) || stringValue((property as Property & { youtubeUrl?: string }).youtubeUrl),
    virtualTourUrl: getMediaUrl(property, ['MATTERPORT', 'VIRTUAL_TOUR']),
    offerings: cloneOfferings(property.offerings),
    isPublished: property.isPublished !== false,
    folderStatus: property.folderStatus || (property.isPublished === false ? 'DRAFT' : 'PUBLISHED'),
    metaTitle: property.metaTitle || '',
    metaDescription: property.metaDescription || '',
    metaKeywords: (property.metaKeywords || []).join(', '),
  };
}

function defaultOffering(property: Property, mode: PropertyOfferingMode): PropertyOffering {
  return {
    id: `offering-${mode}-${property.id}-${Date.now()}`,
    propertyId: property.id,
    mode,
    status: property.isPublished === false ? 'PAUSED' : 'ACTIVE',
    visibility: 'PUBLIC',
    title: property.title,
    description: property.description,
    priceAmount: mode === 'SALE' ? 0 : null,
    currency: 'MXN',
    billingPeriod: mode === 'SALE' ? 'TOTAL' : mode === 'MONTHLY_RENT' ? 'MONTH' : mode === 'SHORT_RENT' ? 'NIGHT' : 'NONE',
    isPriceNegotiable: mode !== 'SWAP',
    acceptsOffers: true,
    requiresApproval: true,
    allowInstantRequest: false,
    swapPreferences: {},
    swapValueTier: mode === 'SWAP' ? property.valueRating : null,
    auraScoreOverride: mode === 'SWAP' ? property.auraScore : null,
    availableFrom: property.availableStart || null,
    availableUntil: property.availableEnd || null,
    isFeatured: false,
    featuredRank: 0,
    metadata: {},
  };
}

function Field({
  label,
  hint,
  required,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="text-[11px] font-extrabold tracking-[0.02em] text-slate-700">
        {label} {required && <span className="text-violet-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-relaxed text-slate-400">{hint}</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${checked ? 'border-violet-200 bg-violet-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-violet-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: EditorSectionId;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`editor-${id}`} data-editor-section={id} className="scroll-mt-6 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.45)] sm:p-7">
      <div className="mb-6 border-b border-slate-100 pb-5">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">{eyebrow}</p>
        <h3 className="text-xl font-black tracking-[-0.035em] text-slate-950">{title}</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function PropertyEditorModal({ isOpen, property, onClose, onSubmit, onDelete }: PropertyEditorModalProps) {
  const initialForm = useMemo(() => formFromProperty(property), [property]);
  const [form, setForm] = useState<EditorForm>(initialForm);
  const [activeSection, setActiveSection] = useState<EditorSectionId>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef(JSON.stringify(initialForm));

  const inputClass = 'min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100/70';
  const isDirty = JSON.stringify(form) !== baselineRef.current;

  const update = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyGoogleAddress = (result: GoogleAddressResult) => {
    setSaved(false);
    setForm((current) => ({
      ...current,
      city: result.city || current.city,
      state: result.state || current.state,
      country: result.country || current.country,
      neighborhood: result.neighborhood || current.neighborhood,
      streetName: result.streetName || current.streetName,
      streetNumber: result.streetNumber || current.streetNumber,
      postalCode: result.postalCode || current.postalCode,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
      placeId: result.placeId,
      formattedAddress: result.formattedAddress,
      geometrySource: 'google_places',
    }));
  };

  useEffect(() => {
    const next = formFromProperty(property);
    setForm(next);
    baselineRef.current = JSON.stringify(next);
    setActiveSection('general');
    setSaveError('');
    setSaved(false);
  }, [property]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>('[data-editor-section]');
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection((visible.target as HTMLElement).dataset.editorSection as EditorSectionId);
    }, { root, rootMargin: '-8% 0px -70% 0px', threshold: [0, 0.1, 0.35] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isOpen]);

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty && typeof window !== 'undefined' && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar el editor?')) return;
    onClose();
  };

  const scrollToSection = (id: EditorSectionId) => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#editor-${id}`);
    if (!root || !target) return;
    root.scrollTo({ top: target.offsetTop - 18, behavior: 'smooth' });
    setActiveSection(id);
  };

  const toggleAmenity = (amenity: string) => {
    update('amenities', form.amenities.includes(amenity)
      ? form.amenities.filter((item) => item !== amenity)
      : [...form.amenities, amenity]);
  };

  const toggleOffering = (mode: PropertyOfferingMode) => {
    const exists = form.offerings.some((offering) => offering.mode === mode);
    update('offerings', exists
      ? form.offerings.filter((offering) => offering.mode !== mode)
      : [...form.offerings, defaultOffering(property, mode)]);
  };

  const updateOffering = (mode: PropertyOfferingMode, patch: Partial<PropertyOffering>) => {
    update('offerings', form.offerings.map((offering) => offering.mode === mode ? { ...offering, ...patch } : offering));
  };

  const buildMedia = (): Partial<PropertyMedia>[] => {
    const preserved = (property.media || []).filter((item) => !['IMAGE', 'VIDEO', 'YOUTUBE', 'VIMEO', 'MATTERPORT', 'VIRTUAL_TOUR'].includes(item.mediaType));
    const media: Partial<PropertyMedia>[] = form.images.map((url, index) => ({
      mediaType: 'IMAGE', url, displayOrder: index, isPrimary: index === 0, metadata: {},
    }));
    let order = media.length;
    if (form.videoUrl.trim()) media.push({ mediaType: 'VIDEO', url: form.videoUrl.trim(), displayOrder: order++, isPrimary: false, metadata: {} });
    if (form.youtubeUrl.trim()) media.push({ mediaType: form.youtubeUrl.includes('vimeo') ? 'VIMEO' : 'YOUTUBE', url: form.youtubeUrl.trim(), displayOrder: order++, isPrimary: false, metadata: {} });
    if (form.virtualTourUrl.trim()) media.push({ mediaType: 'MATTERPORT', url: form.virtualTourUrl.trim(), displayOrder: order++, isPrimary: false, metadata: { provider: getVirtualTourProvider(form.virtualTourUrl) } });
    preserved.forEach((item) => media.push({ ...item, displayOrder: order++ }));
    return media;
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.title.trim()) {
      setSaveError('El título es obligatorio.');
      scrollToSection('general');
      return;
    }
    if (!form.description.trim()) {
      setSaveError('La descripción es obligatoria.');
      scrollToSection('general');
      return;
    }
    if (!form.city.trim() || !form.country.trim()) {
      setSaveError('La ciudad y el país son obligatorios.');
      scrollToSection('location');
      return;
    }
    if (form.offerings.length === 0) {
      setSaveError('Conserva al menos una modalidad comercial.');
      scrollToSection('commercial');
      return;
    }

    // `country` has its own database field. Keeping it out of `location`
    // prevents views from rendering values such as "México, México".
    const location = [form.city.trim(), form.state.trim()].filter(Boolean).join(', ');
    const address = [form.streetName.trim(), form.streetNumber.trim()].filter(Boolean).join(' ');
    const offerings = form.offerings.map((offering) => ({
      ...offering,
      propertyId: property.id,
      title: form.title.trim(),
      description: form.description.trim(),
      status: (form.isPublished ? (offering.status === 'PAUSED' ? 'ACTIVE' : offering.status) : 'PAUSED') as PropertyOffering['status'],
    }));

    const nextMediaSignature = JSON.stringify({ images: form.images, videoUrl: form.videoUrl, youtubeUrl: form.youtubeUrl, virtualTourUrl: form.virtualTourUrl });
    const initialMediaSignature = JSON.stringify({ images: initialForm.images, videoUrl: initialForm.videoUrl, youtubeUrl: initialForm.youtubeUrl, virtualTourUrl: initialForm.virtualTourUrl });

    const patch: Partial<Property> = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      valueRating: form.valueRating,
      developmentName: form.developmentName.trim() || null,
      subdivisionName: form.subdivisionName.trim() || null,
      privateNeighborhood: form.privateNeighborhood.trim() || null,
      phaseStage: form.phaseStage.trim() || null,
      lotNumber: form.lotNumber.trim() || null,
      blockNumber: form.blockNumber.trim() || null,
      condominiumRegime: form.condominiumRegime,
      maintenanceFeeAmount: numberOrZero(form.maintenanceFeeAmount),
      internalCode: form.internalCode.trim() || undefined,
      primaryOperation: form.primaryOperation,
      location,
      city: form.city.trim(),
      state: form.state.trim() || null,
      country: form.country.trim(),
      address: address || undefined,
      neighborhood: form.neighborhood.trim() || null,
      streetName: form.streetName.trim() || null,
      streetNumber: form.streetNumber.trim() || null,
      postalCode: form.postalCode.trim() || null,
      locationReference: form.locationReference.trim() || null,
      showPublicAddress: form.showPublicAddress,
      latitude: numberOrNull(form.latitude),
      longitude: numberOrNull(form.longitude),
      placeId: form.placeId || null,
      formattedAddress: form.formattedAddress || null,
      geometrySource: form.geometrySource || 'manual',
      bedrooms: numberOrZero(form.bedrooms),
      bathrooms: numberOrZero(form.bathrooms),
      halfBathrooms: numberOrZero(form.halfBathrooms),
      parkingSpaces: numberOrZero(form.parkingSpaces),
      levelsCount: numberOrZero(form.levelsCount),
      maxGuests: numberOrZero(form.maxGuests),
      constructionAge: numberOrNull(form.constructionAge),
      surfaceTotal: numberOrNull(form.surfaceTotal),
      surfaceBuilt: numberOrNull(form.surfaceBuilt),
      surfaceFront: numberOrNull(form.surfaceFront),
      surfaceDepth: numberOrNull(form.surfaceDepth),
      surfaceGarden: numberOrZero(form.surfaceGarden),
      surfaceTerrace: numberOrZero(form.surfaceTerrace),
      surfaceRoofGarden: numberOrZero(form.surfaceRoofGarden),
      surfacePatio: numberOrZero(form.surfacePatio),
      amenities: form.amenities,
      rules: form.rules.split('\n').map((rule) => rule.trim()).filter(Boolean),
      servicesWater: form.servicesWater,
      servicesElectricity: form.servicesElectricity,
      servicesSewerage: form.servicesSewerage,
      servicesNatGas: form.servicesNatGas,
      servicesLpGas: form.servicesLpGas,
      servicesInternet: form.servicesInternet.trim(),
      servicesGarbage: form.servicesGarbage,
      securityCctv: form.securityCctv,
      securityGuardhouse: form.securityGuardhouse,
      security24_7: form.security24_7,
      securityBiometric: form.securityBiometric,
      legalDebtFree: form.legalDebtFree,
      legalPublicDeed: form.legalPublicDeed,
      legalTaxCurrent: form.legalTaxCurrent,
      legalServicesPaid: form.legalServicesPaid,
      legalOwnerType: form.legalOwnerType.trim() || null,
      legalIsMortgaged: form.legalIsMortgaged,
      ownerPrivateName: form.ownerPrivateName.trim() || null,
      ownerPrivatePhone: form.ownerPrivatePhone.trim() || null,
      ownerPrivateEmail: form.ownerPrivateEmail.trim() || null,
      ownerContactTime: form.ownerContactTime.trim() || null,
      offerings,
      isPublished: form.isPublished,
      folderStatus: form.folderStatus,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
      metaKeywords: form.metaKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
    };

    if (nextMediaSignature !== initialMediaSignature) {
      patch.images = form.images;
      patch.media = buildMedia() as PropertyMedia[];
    }

    setIsSaving(true);
    try {
      await onSubmit(patch);
      baselineRef.current = JSON.stringify(form);
      setSaved(true);
    } catch (error) {
      console.error('[PropertyEditorModal] Error saving property:', error);
      setSaveError(error instanceof Error ? error.message : 'No fue posible guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/55 p-0 backdrop-blur-md sm:p-5">
      <div className="mx-auto flex h-full max-w-[1500px] overflow-hidden bg-[#f6f7fb] shadow-2xl sm:rounded-[32px] sm:border sm:border-white/40">
        <aside className="hidden w-[270px] shrink-0 flex-col bg-slate-950 text-white lg:flex">
          <div className="border-b border-white/10 px-6 pb-6 pt-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-950/30">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black tracking-tight">Editor de propiedad</p>
                <p className="text-[10px] text-slate-400">Gestión integral del anuncio</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="aspect-[16/9] bg-slate-900">
                {form.images[0] ? <img src={form.images[0]} alt="Portada de la propiedad" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-7 w-7 text-slate-600" /></div>}
              </div>
              <div className="p-3.5">
                <p className="truncate text-xs font-extrabold">{form.title || 'Propiedad sin título'}</p>
                <p className="mt-1 truncate text-[10px] text-slate-400">{[form.city, form.state].filter(Boolean).join(', ') || 'Ubicación pendiente'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button key={item.id} type="button" onClick={() => scrollToSection(item.id)} className={`group mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${active ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/7 hover:text-white'}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-violet-100 text-violet-700' : 'bg-white/5 group-hover:bg-white/10'}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-extrabold">{item.label}</span>
                    <span className={`block truncate text-[9px] ${active ? 'text-slate-500' : 'text-slate-500'}`}>{item.caption}</span>
                  </span>
                  <span className={`text-[9px] font-black ${active ? 'text-violet-600' : 'text-slate-600'}`}>{String(index + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-3 text-[10px] text-slate-400">
              <span className={`h-2 w-2 rounded-full ${isDirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {isDirty ? 'Tienes cambios sin guardar' : 'Todos los cambios guardados'}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="z-20 flex min-h-[78px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl sm:px-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-black tracking-[-0.03em] text-slate-950 sm:text-lg">Editar propiedad</h2>
                <span className={`hidden rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider sm:inline-flex ${form.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{form.isPublished ? 'Publicada' : 'Borrador'}</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-xs">Todo el anuncio en una sola vista · {property.internalCode || property.id.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden items-center gap-1.5 text-[10px] font-bold sm:flex ${saved ? 'text-emerald-600' : isDirty ? 'text-amber-600' : 'text-slate-400'}`}>
                {saved ? <Check className="h-3.5 w-3.5" /> : <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />}
                {saved ? 'Guardado' : isDirty ? 'Cambios pendientes' : 'Sin cambios'}
              </span>
              <button type="button" onClick={handleSave} disabled={isSaving || !isDirty} className="flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-extrabold text-white shadow-lg shadow-slate-950/15 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45 sm:px-5">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{isSaving ? 'Guardando…' : 'Guardar cambios'}</span>
              </button>
              <button type="button" onClick={requestClose} aria-label="Cerrar editor" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><X className="h-5 w-5" /></button>
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} type="button" onClick={() => scrollToSection(item.id)} className={`whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-extrabold transition ${activeSection === item.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.label}</button>
            ))}
          </div>

          {saveError && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:mx-7">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{saveError}</span>
              <button type="button" onClick={() => setSaveError('')} aria-label="Cerrar error"><X className="h-4 w-4" /></button>
            </div>
          )}

          <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-4 [scrollbar-color:#8b5cf6_#e2e8f0] [scrollbar-width:thin] sm:px-7 sm:py-6">
            <div className="mx-auto flex max-w-[1040px] flex-col gap-5 pb-28">
              <Section id="general" eyebrow="01 · Identidad" title="Información principal" description="Estos datos construyen la portada pública del anuncio y la presentación que utiliza Eterna.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Título del anuncio" required className="md:col-span-2"><input value={form.title} onChange={(event) => update('title', event.target.value)} className={inputClass} placeholder="Ej. Departamento con terraza privada" /></Field>
                  <Field label="Descripción" required hint={`${form.description.length} caracteres · Explica distribución, estado, entorno y ventajas.`} className="md:col-span-2"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows={6} className={`${inputClass} resize-y py-3.5 leading-relaxed`} placeholder="Describe la propiedad con información útil y verificable…" /></Field>
                  <Field label="Tipo de propiedad"><select value={form.type} onChange={(event) => update('type', event.target.value as Property['type'])} className={inputClass}>{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Categoría Aura"><select value={form.valueRating} onChange={(event) => update('valueRating', event.target.value as Property['valueRating'])} className={inputClass}>{['Premium', 'Luxury', 'Exclusive', 'Curated'].map((option) => <option key={option}>{option}</option>)}</select></Field>
                  <Field label="Desarrollo / residencial"><input value={form.developmentName} onChange={(event) => update('developmentName', event.target.value)} className={inputClass} placeholder="Ej. Marina Gardens" /></Field>
                  <Field label="Fraccionamiento / privada"><input value={form.subdivisionName} onChange={(event) => update('subdivisionName', event.target.value)} className={inputClass} /></Field>
                  <Field label="Nombre de la privada"><input value={form.privateNeighborhood} onChange={(event) => update('privateNeighborhood', event.target.value)} className={inputClass} /></Field>
                  <Field label="Etapa del desarrollo"><input value={form.phaseStage} onChange={(event) => update('phaseStage', event.target.value)} className={inputClass} placeholder="Ej. Torre B · Entrega inmediata" /></Field>
                  <Field label="Lote"><input value={form.lotNumber} onChange={(event) => update('lotNumber', event.target.value)} className={inputClass} /></Field>
                  <Field label="Manzana"><input value={form.blockNumber} onChange={(event) => update('blockNumber', event.target.value)} className={inputClass} /></Field>
                  <Field label="Cuota de mantenimiento"><input type="number" min="0" value={form.maintenanceFeeAmount} onChange={(event) => update('maintenanceFeeAmount', event.target.value)} className={inputClass} placeholder="MXN" /></Field>
                  <Toggle checked={form.condominiumRegime} onChange={(value) => update('condominiumRegime', value)} label="Régimen condominal" description="La propiedad forma parte de un condominio." />
                </div>
              </Section>

              <Section id="location" eyebrow="02 · Dirección" title="Ubicación de la propiedad" description="La ciudad es el dato principal de búsqueda. La dirección exacta puede mantenerse privada en la vista pública.">
                <div className="mb-5">
                  <GoogleAddressAutocomplete
                    compact
                    onSelect={applyGoogleAddress}
                    selectedAddress={form.formattedAddress}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Ciudad" required><input value={form.city} onChange={(event) => update('city', event.target.value)} className={inputClass} autoComplete="address-level2" /></Field>
                  <Field label="Estado / provincia"><input value={form.state} onChange={(event) => update('state', event.target.value)} className={inputClass} autoComplete="address-level1" /></Field>
                  <Field label="País" required><input value={form.country} onChange={(event) => update('country', event.target.value)} className={inputClass} autoComplete="country-name" /></Field>
                  <Field label="Colonia / zona"><input value={form.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} className={inputClass} /></Field>
                  <Field label="Calle"><input value={form.streetName} onChange={(event) => update('streetName', event.target.value)} className={inputClass} autoComplete="address-line1" /></Field>
                  <Field label="Número"><input value={form.streetNumber} onChange={(event) => update('streetNumber', event.target.value)} className={inputClass} /></Field>
                  <Field label="Código postal"><input value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} className={inputClass} inputMode="numeric" autoComplete="postal-code" /></Field>
                  <Field label="Latitud"><input type="number" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} className={inputClass} /></Field>
                  <Field label="Longitud"><input type="number" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} className={inputClass} /></Field>
                  <Field label="Referencia para llegar" className="md:col-span-2 lg:col-span-3"><textarea value={form.locationReference} onChange={(event) => update('locationReference', event.target.value)} rows={3} className={`${inputClass} resize-y py-3.5`} placeholder="Ej. Acceso por avenida principal, frente al parque…" /></Field>
                  <div className="md:col-span-2 lg:col-span-3"><Toggle checked={form.showPublicAddress} onChange={(value) => update('showPublicAddress', value)} label="Mostrar dirección completa públicamente" description="Si lo desactivas, los visitantes verán únicamente la zona aproximada." /></div>
                </div>
              </Section>

              <Section id="spaces" eyebrow="03 · Distribución" title="Espacios y superficies" description="Actualiza la capacidad real y las medidas del inmueble. Todas las superficies se expresan en metros cuadrados.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ['bedrooms', 'Recámaras'], ['bathrooms', 'Baños completos'], ['halfBathrooms', 'Medios baños'], ['parkingSpaces', 'Estacionamientos'],
                    ['levelsCount', 'Niveles'], ['maxGuests', 'Capacidad'], ['constructionAge', 'Antigüedad (años)'], ['surfaceTotal', 'Terreno total (m²)'],
                    ['surfaceBuilt', 'Construcción (m²)'], ['surfaceFront', 'Frente (m)'], ['surfaceDepth', 'Fondo (m)'], ['surfaceGarden', 'Jardín (m²)'],
                    ['surfaceTerrace', 'Terraza (m²)'], ['surfaceRoofGarden', 'Roof garden (m²)'], ['surfacePatio', 'Patio (m²)'],
                  ] as Array<[keyof EditorForm, string]>).map(([key, label]) => (
                    <Field key={key} label={label}><input type="number" min="0" step={key.toString().startsWith('surface') ? '0.01' : '1'} value={form[key] as string} onChange={(event) => update(key, event.target.value as never)} className={inputClass} /></Field>
                  ))}
                </div>
              </Section>

              <Section id="amenities" eyebrow="04 · Experiencia" title="Amenidades, servicios y seguridad" description="Selecciona lo que realmente está disponible. Puedes conservar amenidades personalizadas ya registradas.">
                <div className="mb-7 flex flex-wrap gap-2">
                  {Array.from(new Set([...AMENITIES, ...form.amenities])).map((amenity) => {
                    const active = form.amenities.includes(amenity);
                    return <button key={amenity} type="button" onClick={() => toggleAmenity(amenity)} className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-extrabold transition ${active ? 'border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-200' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300 hover:text-violet-700'}`}>{active && <Check className="h-3 w-3" />}{amenity}</button>;
                  })}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle checked={form.servicesWater} onChange={(value) => update('servicesWater', value)} label="Agua" />
                  <Toggle checked={form.servicesElectricity} onChange={(value) => update('servicesElectricity', value)} label="Electricidad" />
                  <Toggle checked={form.servicesSewerage} onChange={(value) => update('servicesSewerage', value)} label="Drenaje" />
                  <Toggle checked={form.servicesGarbage} onChange={(value) => update('servicesGarbage', value)} label="Recolección de basura" />
                  <Toggle checked={form.servicesNatGas} onChange={(value) => update('servicesNatGas', value)} label="Gas natural" />
                  <Toggle checked={form.servicesLpGas} onChange={(value) => update('servicesLpGas', value)} label="Gas LP" />
                  <Field label="Internet"><input value={form.servicesInternet} onChange={(event) => update('servicesInternet', event.target.value)} className={inputClass} placeholder="Ej. Fibra óptica 500 Mbps" /></Field>
                  <Field label="Reglas de la propiedad" hint="Una regla por línea."><textarea value={form.rules} onChange={(event) => update('rules', event.target.value)} rows={4} className={`${inputClass} resize-y py-3.5`} /></Field>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Toggle checked={form.securityCctv} onChange={(value) => update('securityCctv', value)} label="Circuito cerrado" />
                  <Toggle checked={form.securityGuardhouse} onChange={(value) => update('securityGuardhouse', value)} label="Caseta de vigilancia" />
                  <Toggle checked={form.security24_7} onChange={(value) => update('security24_7', value)} label="Seguridad 24/7" />
                  <Toggle checked={form.securityBiometric} onChange={(value) => update('securityBiometric', value)} label="Acceso biométrico" />
                </div>
              </Section>

              <Section id="commercial" eyebrow="05 · Operación" title="Modalidades comerciales" description="Activa únicamente las formas en que deseas ofrecer la propiedad. Los datos existentes de cada modalidad se conservan.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ['SALE', 'Venta', 'Precio total'], ['MONTHLY_RENT', 'Renta mensual', 'Precio por mes'], ['SHORT_RENT', 'Renta temporal', 'Precio por noche'], ['SWAP', 'Intercambio', 'Preferencias de swap'],
                  ] as Array<[PropertyOfferingMode, string, string]>).map(([mode, label, caption]) => {
                    const active = form.offerings.some((offering) => offering.mode === mode);
                    return <button key={mode} type="button" onClick={() => toggleOffering(mode)} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="flex items-center justify-between"><span className="text-xs font-black text-slate-900">{label}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-violet-600 text-white' : 'border border-slate-300'}`}>{active && <Check className="h-3 w-3" />}</span></span><span className="mt-1 block text-[10px] text-slate-400">{caption}</span></button>;
                  })}
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  {form.offerings.map((offering) => (
                    <div key={offering.mode} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div><p className="text-xs font-black text-slate-950">{offering.mode === 'SALE' ? 'Venta' : offering.mode === 'MONTHLY_RENT' ? 'Renta mensual' : offering.mode === 'SHORT_RENT' ? 'Renta temporal' : 'Intercambio'}</p><p className="mt-0.5 text-[10px] text-slate-400">Configuración que verá el interesado</p></div>
                        <select value={offering.visibility} onChange={(event) => updateOffering(offering.mode, { visibility: event.target.value as PropertyOffering['visibility'] })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold"><option value="PUBLIC">Pública</option><option value="PRIVATE">Privada</option><option value="UNLISTED">No listada</option></select>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {offering.mode !== 'SWAP' && <Field label={offering.mode === 'SALE' ? 'Precio de venta' : offering.mode === 'MONTHLY_RENT' ? 'Renta mensual' : 'Precio por noche'}><input type="number" min="0" value={offering.priceAmount ?? ''} onChange={(event) => updateOffering(offering.mode, { priceAmount: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>}
                        {offering.mode !== 'SWAP' && <Field label="Moneda"><select value={offering.currency || 'MXN'} onChange={(event) => updateOffering(offering.mode, { currency: event.target.value })} className={inputClass}><option>MXN</option><option>USD</option><option>EUR</option></select></Field>}
                        <Field label="Disponible desde"><input type="date" value={offering.availableFrom || ''} onChange={(event) => updateOffering(offering.mode, { availableFrom: event.target.value || null })} className={inputClass} /></Field>
                        <Field label="Disponible hasta"><input type="date" value={offering.availableUntil || ''} onChange={(event) => updateOffering(offering.mode, { availableUntil: event.target.value || null })} className={inputClass} /></Field>
                        {offering.mode === 'SHORT_RENT' && <Field label="Noches mínimas"><input type="number" min="1" value={offering.minNights ?? ''} onChange={(event) => updateOffering(offering.mode, { minNights: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>}
                        {offering.mode === 'MONTHLY_RENT' && <Field label="Meses mínimos"><input type="number" min="1" value={offering.minMonths ?? ''} onChange={(event) => updateOffering(offering.mode, { minMonths: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>}
                        {(offering.mode === 'MONTHLY_RENT' || offering.mode === 'SHORT_RENT') && <Field label="Depósito"><input type="number" min="0" value={offering.securityDepositAmount ?? ''} onChange={(event) => updateOffering(offering.mode, { securityDepositAmount: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>}
                        {offering.mode === 'SWAP' && <Field label="Intercambio deseado" className="md:col-span-2 lg:col-span-4"><textarea value={typeof offering.swapPreferences?.text === 'string' ? offering.swapPreferences.text : ''} onChange={(event) => updateOffering(offering.mode, { swapPreferences: { ...offering.swapPreferences, text: event.target.value } })} rows={3} className={`${inputClass} resize-y py-3.5`} placeholder="Ciudades, fechas y tipo de propiedad que te interesan…" /></Field>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="media" eyebrow="06 · Contenido visual" title="Fotos, video y recorridos" description="La primera imagen funciona como portada. Puedes ordenar, reemplazar o eliminar el material existente.">
                <ImageUploadDropzone images={form.images} onChange={(images) => update('images', images)} imagesMetadata={form.imagesMetadata} onMetadataChange={(metadata) => update('imagesMetadata', metadata)} />
                <div className="mt-7 grid gap-5 lg:grid-cols-2">
                  <div><p className="mb-2 text-[11px] font-extrabold text-slate-700">Video de la propiedad</p><VideoUploadDropzone videoUrl={form.videoUrl} onChange={(url) => update('videoUrl', url)} /></div>
                  <div className="flex flex-col gap-4">
                    <Field label="YouTube o Vimeo"><input type="url" value={form.youtubeUrl} onChange={(event) => update('youtubeUrl', event.target.value)} className={inputClass} placeholder="https://youtube.com/watch?v=…" /></Field>
                    <Field label="Recorrido 3D / Matterport o YouTube"><input type="url" value={form.virtualTourUrl} onChange={(event) => update('virtualTourUrl', event.target.value)} className={inputClass} placeholder="https://my.matterport.com/show/… o https://youtu.be/…" /></Field>
                  </div>
                </div>
              </Section>

              <Section id="legal" eyebrow="07 · Expediente" title="Situación legal y contacto privado" description="Estos datos son de gestión interna. No se muestran públicamente salvo que otra sección lo indique.">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle checked={form.legalDebtFree} onChange={(value) => update('legalDebtFree', value)} label="Libre de gravamen" />
                  <Toggle checked={form.legalPublicDeed} onChange={(value) => update('legalPublicDeed', value)} label="Escritura pública" />
                  <Toggle checked={form.legalTaxCurrent} onChange={(value) => update('legalTaxCurrent', value)} label="Predial al corriente" />
                  <Toggle checked={form.legalServicesPaid} onChange={(value) => update('legalServicesPaid', value)} label="Servicios pagados" />
                  <Toggle checked={form.legalIsMortgaged} onChange={(value) => update('legalIsMortgaged', value)} label="Tiene hipoteca" />
                  <Field label="Tipo de propiedad legal"><input value={form.legalOwnerType} onChange={(event) => update('legalOwnerType', event.target.value)} className={inputClass} placeholder="Ej. Propiedad privada" /></Field>
                </div>
                <div className="my-7 h-px bg-slate-100" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre del propietario"><input value={form.ownerPrivateName} onChange={(event) => update('ownerPrivateName', event.target.value)} className={inputClass} autoComplete="name" /></Field>
                  <Field label="Teléfono"><input value={form.ownerPrivatePhone} onChange={(event) => update('ownerPrivatePhone', event.target.value)} className={inputClass} type="tel" autoComplete="tel" /></Field>
                  <Field label="Correo"><input value={form.ownerPrivateEmail} onChange={(event) => update('ownerPrivateEmail', event.target.value)} className={inputClass} type="email" autoComplete="email" /></Field>
                  <Field label="Horario preferido de contacto"><input value={form.ownerContactTime} onChange={(event) => update('ownerContactTime', event.target.value)} className={inputClass} placeholder="Ej. Lunes a viernes, 9:00–18:00" /></Field>
                </div>
              </Section>

              <Section id="publishing" eyebrow="08 · Visibilidad" title="Publicación y buscadores" description="Controla el estado operativo del anuncio y cómo se presenta en resultados de búsqueda.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Operación principal"><select value={form.primaryOperation || 'SWAP'} onChange={(event) => update('primaryOperation', event.target.value as Property['primaryOperation'])} className={inputClass}><option value="SALE">Venta</option><option value="RENT">Renta</option><option value="SWAP">Intercambio</option></select></Field>
                  <Field label="Estado del expediente"><select value={form.folderStatus} onChange={(event) => update('folderStatus', event.target.value as EditorForm['folderStatus'])} className={inputClass}><option value="DRAFT">Borrador</option><option value="PENDING_DOCUMENTS">Documentos pendientes</option><option value="UNDER_REVIEW">En revisión</option><option value="PUBLISHED">Publicado</option><option value="PAUSED">Pausado</option><option value="SOLD">Vendido</option><option value="RENTED">Rentado</option><option value="ARCHIVED">Archivado</option></select></Field>
                  <Field label="Código interno"><input value={form.internalCode} onChange={(event) => update('internalCode', event.target.value)} className={inputClass} placeholder="Se genera automáticamente si está vacío" /></Field>
                  <Toggle checked={form.isPublished} onChange={(value) => update('isPublished', value)} label="Anuncio visible" description="Disponible en Explorar y mediante su enlace público." />
                  <Field label="Título SEO" className="md:col-span-2"><input value={form.metaTitle} onChange={(event) => update('metaTitle', event.target.value)} className={inputClass} placeholder={form.title ? `${form.title} | AuraSwap` : ''} /></Field>
                  <Field label="Descripción SEO" className="md:col-span-2"><textarea value={form.metaDescription} onChange={(event) => update('metaDescription', event.target.value)} rows={3} className={`${inputClass} resize-y py-3.5`} /></Field>
                  <Field label="Palabras clave" hint="Sepáralas con comas." className="md:col-span-2"><input value={form.metaKeywords} onChange={(event) => update('metaKeywords', event.target.value)} className={inputClass} placeholder="departamento, terraza, Guadalajara" /></Field>
                </div>

                {onDelete && (
                  <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50/60 p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div><p className="text-xs font-black text-rose-900">Eliminar propiedad</p><p className="mt-1 text-[10px] leading-relaxed text-rose-700/70">Esta acción elimina el anuncio y sus relaciones. No se puede deshacer.</p></div>
                      {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-[10px] font-black text-rose-700 transition hover:bg-rose-600 hover:text-white"><Trash2 className="h-4 w-4" />Eliminar</button> : <div className="flex items-center gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl px-3 py-2 text-[10px] font-bold text-slate-500">Cancelar</button><button type="button" onClick={() => onDelete(property.id)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-black text-white">Sí, eliminar</button></div>}
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </main>

          <div className="pointer-events-none absolute bottom-5 right-5 hidden lg:block">
            <button type="button" onClick={() => scrollToSection(NAV_ITEMS[Math.min(NAV_ITEMS.findIndex((item) => item.id === activeSection) + 1, NAV_ITEMS.length - 1)].id)} className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-[10px] font-black text-slate-700 shadow-xl transition hover:border-violet-300 hover:text-violet-700">Siguiente sección <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
