'use client';

import { memo, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeDollarSign,
  BarChart3,
  Bath,
  BedDouble,
  Building2,
  Camera,
  Compass,
  FileCheck2,
  FileText,
  Images,
  KeyRound,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  PhoneCall,
  Play,
  Ruler,
  Scale,
  Sparkles,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import GooglePropertyLocation from '@/components/property/GooglePropertyLocation';
import ProfileAvatar from '@/components/ProfileAvatar';
import { PropertySectionCard } from '@/components/property/PropertySectionCard';
import { EternaMarketAnalysis } from '@/components/property/sections/EternaMarketAnalysis';
import { FinancingCompatibility } from '@/components/property/sections/FinancingCompatibility';
import { LegalDossierSection } from '@/components/property/sections/LegalDossierSection';
import {
  TowersValuationPanel,
  type TowersPropertyValuation,
} from '@/components/property/sections/TowersValuationPanel';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { EternaPropertyVisualSection } from '@/lib/eterna/events';
import type { NearbyPlace } from '@/lib/maps/types';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { Property, PropertyOffering } from '@/lib/types';
import { PropertyAmenitiesSection } from '../PropertyAmenitiesSection';
import { PropertyMultimediaSection } from '../PropertyMultimediaSection';
import { PropertyTechnicalDetails } from '../PropertyTechnicalDetails';
import {
  OFFERING_BADGE_META,
  REPRESENTATIVE_LABELS,
  getActivePropertyOfferingSummary,
  getPublicResponsible,
} from '../propertyDetailsData';

const EMPTY_NEARBY_PLACES: NearbyPlace[] = [];

interface PropertyEternaVisualPanelProps {
  activeSection: EternaPropertyVisualSection | null;
  error: string | null;
  language: LanguageType;
  loading: boolean;
  onClose: () => void;
  onOpenGallery: (index: number) => void;
  places?: NearbyPlace[];
  property: Property;
  valuation: TowersPropertyValuation | null | undefined;
}

type SectionMeta = {
  eyebrowEs: string;
  eyebrowEn: string;
  titleEs: string;
  titleEn: string;
  icon: LucideIcon;
  accent: string;
};

const SECTION_META: Record<EternaPropertyVisualSection, SectionMeta> = {
  summary: { eyebrowEs: 'Resumen guiado', eyebrowEn: 'Guided brief', titleEs: 'Lo esencial de esta propiedad', titleEn: 'The property at a glance', icon: Sparkles, accent: 'text-violet-700' },
  gallery: { eyebrowEs: 'Galería visual', eyebrowEn: 'Visual gallery', titleEs: 'Fotos de la propiedad', titleEn: 'Property photos', icon: Images, accent: 'text-rose-700' },
  description: { eyebrowEs: 'Descripción', eyebrowEn: 'Description', titleEs: 'Así es la propiedad', titleEn: 'About this property', icon: FileText, accent: 'text-sky-700' },
  amenities: { eyebrowEs: 'Comodidades', eyebrowEn: 'Amenities', titleEs: 'Amenidades y equipamiento', titleEn: 'Amenities & features', icon: Compass, accent: 'text-emerald-700' },
  technical: { eyebrowEs: 'Ficha técnica', eyebrowEn: 'Technical profile', titleEs: 'Espacios, superficies y servicios', titleEn: 'Spaces, surfaces & services', icon: Ruler, accent: 'text-amber-700' },
  media: { eyebrowEs: 'Multimedia', eyebrowEn: 'Media', titleEs: 'Videos, recorridos y planos', titleEn: 'Videos, tours & floor plans', icon: Play, accent: 'text-fuchsia-700' },
  location: { eyebrowEs: 'Ubicación interactiva', eyebrowEn: 'Interactive location', titleEs: 'Mapa y lugares cercanos', titleEn: 'Map & nearby places', icon: MapPin, accent: 'text-sky-700' },
  valuation: { eyebrowEs: 'Inteligencia de mercado', eyebrowEn: 'Market intelligence', titleEs: 'Estimación automatizada Towers', titleEn: 'Towers automated estimate', icon: Scale, accent: 'text-indigo-700' },
  financing: { eyebrowEs: 'Adquisición', eyebrowEn: 'Acquisition', titleEs: 'Financiamiento y métodos de pago', titleEn: 'Financing & payment methods', icon: WalletCards, accent: 'text-emerald-700' },
  legal: { eyebrowEs: 'Debida diligencia', eyebrowEn: 'Due diligence', titleEs: 'Situación documental', titleEn: 'Document status', icon: FileCheck2, accent: 'text-amber-700' },
  contact: { eyebrowEs: 'Contacto verificado', eyebrowEn: 'Verified contact', titleEs: 'Responsable de la publicación', titleEn: 'Listing representative', icon: UserRound, accent: 'text-cyan-700' },
  commercial: { eyebrowEs: 'Condiciones comerciales', eyebrowEn: 'Commercial terms', titleEs: 'Precio y modalidades disponibles', titleEn: 'Price & available modes', icon: BadgeDollarSign, accent: 'text-emerald-700' },
  market: { eyebrowEs: 'Evidencia comercial', eyebrowEn: 'Commercial evidence', titleEs: 'Datos de mercado documentados', titleEn: 'Documented market data', icon: BarChart3, accent: 'text-violet-700' },
};

const formatPrice = (offering: PropertyOffering, language: LanguageType) => {
  if (offering.priceAmount == null) return language === 'es' ? 'Precio a consultar' : 'Price on request';
  const amount = new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: offering.currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(offering.priceAmount);
  const period = offering.mode === 'SHORT_RENT'
    ? (language === 'es' ? ' / noche' : ' / night')
    : offering.mode === 'MONTHLY_RENT'
      ? (language === 'es' ? ' / mes' : ' / month')
      : '';
  return `${amount}${period}`;
};

function EmptyVisual({ language, message }: { language: LanguageType; message?: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-[28px] border border-dashed border-neutral-300 bg-white/70 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white">
        <KeyRound className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-black text-neutral-950">
        {language === 'es' ? 'Información aún no publicada' : 'Information not published yet'}
      </p>
      <p className="mt-1 max-w-md text-xs font-semibold leading-relaxed text-neutral-500">
        {message || (language === 'es'
          ? 'Eterna no inventará datos: esta sección se completará cuando el responsable los publique.'
          : 'Eterna will not invent details; this section will appear when the representative publishes them.')}
      </p>
    </div>
  );
}

function SummaryVisual({ language, property }: { language: LanguageType; property: Property }) {
  const { activeOfferingModes, activeRentOffering, activeSaleOffering } = getActivePropertyOfferingSummary(property);
  const primaryOffering = activeSaleOffering || activeRentOffering;
  const cover = property.images?.[0];
  const specs = [
    { icon: BedDouble, label: language === 'es' ? 'Recámaras' : 'Bedrooms', value: property.bedrooms || '—' },
    { icon: Bath, label: language === 'es' ? 'Baños' : 'Bathrooms', value: property.bathrooms || '—' },
    { icon: Ruler, label: language === 'es' ? 'Construcción' : 'Built area', value: property.surfaceBuilt ? `${property.surfaceBuilt} m²` : '—' },
    { icon: Building2, label: language === 'es' ? 'Niveles' : 'Levels', value: property.levelsCount || '—' },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_70px_-45px_rgba(15,23,42,0.65)]">
      <div className="grid lg:min-h-[520px] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative h-28 bg-neutral-100 sm:h-40 lg:h-auto lg:min-h-[520px]">
          {cover ? (
            <Image src={cover} alt={property.title} fill priority unoptimized sizes="(max-width: 1023px) 100vw, 40vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300"><Camera className="h-10 w-10" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white backdrop-blur-md lg:bottom-5 lg:left-5">
            {language === 'es' ? 'Foto de portada' : 'Cover photo'}
          </span>
        </div>

        <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-9">
          <div className="flex flex-wrap gap-2">
            {activeOfferingModes.map((mode) => (
              <span key={mode} className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${OFFERING_BADGE_META[mode].className}`}>
                {OFFERING_BADGE_META[mode].label}
              </span>
            ))}
          </div>
          <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.035em] text-neutral-950 sm:text-2xl lg:text-4xl">{property.title}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 sm:text-xs">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{formatPropertyLocation(property.location, property.country)}</span>
          </p>
          {primaryOffering && (
            <p className="mt-3 text-lg font-black tracking-tight text-emerald-700 sm:text-2xl">{formatPrice(primaryOffering, language)}</p>
          )}

          <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
            {specs.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2 text-center sm:p-3">
                <Icon className="mx-auto h-3.5 w-3.5 text-neutral-700 sm:h-4 sm:w-4" />
                <p className="mt-1 text-xs font-black text-neutral-950 sm:text-sm">{value}</p>
                <p className="hidden text-[8px] font-bold uppercase tracking-[0.09em] text-neutral-400 sm:block">{label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 line-clamp-2 text-xs font-semibold leading-relaxed text-neutral-600 sm:line-clamp-3 sm:text-sm">
            {property.aiSummary || property.description}
          </p>
          {property.amenities?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {property.amenities.slice(0, 4).map((amenity) => (
                <span key={amenity} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-extrabold text-neutral-600">{amenity}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryVisual({ language, onOpenGallery, property }: {
  language: LanguageType;
  onOpenGallery: (index: number) => void;
  property: Property;
}) {
  const images = property.images || [];
  if (images.length === 0) return <EmptyVisual language={language} />;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {images.slice(0, 9).map((image, index) => (
        <button
          key={`${image}-${index}`}
          type="button"
          onClick={() => onOpenGallery(index)}
          className={`group relative overflow-hidden rounded-2xl bg-neutral-100 ${index === 0 ? 'col-span-2 aspect-[16/9] sm:row-span-2 sm:aspect-auto' : 'aspect-square'}`}
        >
          <Image src={image} alt={`${property.title} ${index + 1}`} fill unoptimized sizes="(max-width: 639px) 50vw, 30vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
          <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" /></span>
        </button>
      ))}
    </div>
  );
}

function TechnicalVisual({ language, property }: { language: LanguageType; property: Property }) {
  const basics = [
    [language === 'es' ? 'Recámaras' : 'Bedrooms', property.bedrooms],
    [language === 'es' ? 'Baños completos' : 'Full bathrooms', property.bathrooms],
    [language === 'es' ? 'Medios baños' : 'Half bathrooms', property.halfBathrooms],
    [language === 'es' ? 'Estacionamientos' : 'Parking spaces', property.parkingSpaces],
    [language === 'es' ? 'Construcción' : 'Built area', property.surfaceBuilt ? `${property.surfaceBuilt} m²` : null],
    [language === 'es' ? 'Terreno' : 'Lot area', property.surfaceTotal ? `${property.surfaceTotal} m²` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== 0);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {basics.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <dt className="text-[9px] font-black uppercase tracking-[0.11em] text-neutral-400">{label}</dt>
            <dd className="mt-2 text-lg font-black text-neutral-950">{value}</dd>
          </div>
        ))}
      </dl>
      <PropertyTechnicalDetails property={property} language={language} expanded />
    </div>
  );
}

function ContactVisual({ language, property }: { language: LanguageType; property: Property }) {
  const responsible = getPublicResponsible(property);
  if (!responsible) return <EmptyVisual language={language} />;
  const representative = responsible.representativeType
    ? REPRESENTATIVE_LABELS[responsible.representativeType][language === 'es' ? 'es' : 'en']
    : (language === 'es' ? 'Responsable de la publicación' : 'Listing representative');
  return (
    <div className="grid gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-[auto_1fr] sm:p-7">
      <ProfileAvatar src={responsible.photo} name={responsible.name} className="h-16 w-16" textClassName="text-xl" />
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-700">{representative}</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight text-neutral-950">{responsible.name}</h3>
        {(responsible.position || responsible.company) && <p className="mt-1 text-xs font-semibold text-neutral-500">{[responsible.position, responsible.company].filter(Boolean).join(' · ')}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {responsible.whatsapp && <a href={`https://wa.me/${responsible.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-black text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
          {responsible.phone && <a href={`tel:${responsible.phone}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-xs font-black text-neutral-800"><PhoneCall className="h-4 w-4" />{language === 'es' ? 'Llamar' : 'Call'}</a>}
          {responsible.email && <a href={`mailto:${responsible.email}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-xs font-black text-neutral-800"><Mail className="h-4 w-4" />{language === 'es' ? 'Correo' : 'Email'}</a>}
        </div>
      </div>
    </div>
  );
}

function CommercialVisual({ language, property }: { language: LanguageType; property: Property }) {
  const offerings = (property.offerings || []).filter((offering) => offering.status === 'ACTIVE' && offering.visibility === 'PUBLIC');
  if (offerings.length === 0) return <EmptyVisual language={language} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {offerings.map((offering) => {
        const meta = OFFERING_BADGE_META[offering.mode];
        return (
          <article key={offering.id} className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.11em] ${meta.className}`}>{meta.label}</span>
            <p className="mt-4 text-2xl font-black tracking-tight text-neutral-950">{formatPrice(offering, language)}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-neutral-500">{offering.description || (language === 'es' ? 'Modalidad publicada y disponible para consulta.' : 'Published mode available for inquiry.')}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-500">
              {offering.acceptsOffers && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{language === 'es' ? 'Acepta ofertas' : 'Offers accepted'}</span>}
              {offering.isPriceNegotiable && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{language === 'es' ? 'Negociable' : 'Negotiable'}</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export const PropertyEternaVisualPanel = memo(function PropertyEternaVisualPanel({
  activeSection,
  error,
  language,
  loading,
  onClose,
  onOpenGallery,
  places,
  property,
  valuation,
}: PropertyEternaVisualPanelProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const meta = activeSection ? SECTION_META[activeSection] : null;
  const marketEvidence = property.metadata?.marketEvidence as Record<string, unknown> | undefined;
  const hasMarketEvidence = Boolean(
    (property.appraisalAmount && property.appraisalDate && property.appraisalExpert)
      || (property.priceHistory?.currentPrice && property.priceHistory.lastModificationDate)
      || (marketEvidence?.source && marketEvidence?.measuredAt),
  );
  const hasMultimedia = useMemo(() => (property.media || []).some((item) => item.mediaType !== 'IMAGE'), [property.media]);

  if (!mounted) return null;

  const content = activeSection === 'summary' ? <SummaryVisual language={language} property={property} />
    : activeSection === 'gallery' ? <GalleryVisual language={language} onOpenGallery={onOpenGallery} property={property} />
      : activeSection === 'description' ? (
        <PropertySectionCard icon={FileText} eyebrow={language === 'es' ? 'Descripción' : 'Description'} title={language === 'es' ? 'Así es la propiedad' : 'About this property'}>
          <p className="whitespace-pre-line text-sm font-semibold leading-7 text-neutral-600">{property.description || (language === 'es' ? 'Sin descripción publicada.' : 'No description published.')}</p>
        </PropertySectionCard>
      )
        : activeSection === 'amenities' ? (property.amenities?.length || property.metadata?.customAmenities?.length ? <PropertyAmenitiesSection property={property} /> : <EmptyVisual language={language} />)
          : activeSection === 'technical' ? <TechnicalVisual language={language} property={property} />
            : activeSection === 'media' ? (hasMultimedia ? <PropertyMultimediaSection language={language} property={property} /> : <EmptyVisual language={language} />)
              : activeSection === 'location' ? (property.latitude !== null && property.longitude !== null ? <GooglePropertyLocation property={property} places={places || EMPTY_NEARBY_PLACES} loading={loading} error={error} language={language === 'es' ? 'es' : 'en'} /> : <EmptyVisual language={language} />)
                : activeSection === 'valuation' ? <TowersValuationPanel property={property} valuation={valuation} language={language === 'es' ? 'es' : 'en'} />
                  : activeSection === 'financing' ? <FinancingCompatibility property={property} language={language} />
                    : activeSection === 'legal' ? <LegalDossierSection property={property} language={language} />
                      : activeSection === 'contact' ? <ContactVisual language={language} property={property} />
                        : activeSection === 'commercial' ? <CommercialVisual language={language} property={property} />
                          : activeSection === 'market' ? (hasMarketEvidence ? <EternaMarketAnalysis property={property} language={language} /> : <EmptyVisual language={language} />)
                            : null;

  const Icon = meta?.icon || Sparkles;
  return createPortal(
    <AnimatePresence>
      {activeSection && meta && (
        <motion.div
          key={activeSection}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end bg-slate-950/68 backdrop-blur-md lg:items-center lg:pr-[430px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="eterna-property-visual-title"
          data-testid="eterna-property-visual"
          data-visual-section={activeSection}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.section
            initial={{ y: 42, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 42, scale: 0.985 }}
            transition={{ type: 'spring', damping: 29, stiffness: 290 }}
            className={`flex w-full flex-col overflow-hidden border border-white/70 bg-[#f6f6f3] shadow-[0_35px_110px_rgba(2,6,23,0.5)] lg:mx-auto lg:max-w-6xl lg:rounded-[34px] ${activeSection === 'summary' ? 'max-h-[88dvh] rounded-t-[30px]' : 'h-[93dvh] rounded-t-[30px] lg:h-auto lg:max-h-[92dvh]'}`}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/80 bg-white px-4 py-3.5 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-lg shadow-neutral-950/15 sm:h-11 sm:w-11">
                  <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className={`text-[8px] font-black uppercase tracking-[0.18em] sm:text-[9px] ${meta.accent}`}>{language === 'es' ? meta.eyebrowEs : meta.eyebrowEn}</p>
                  <h2 id="eterna-property-visual-title" className="mt-1 truncate text-base font-black tracking-tight text-neutral-950 sm:text-xl">{language === 'es' ? meta.titleEs : meta.titleEn}</h2>
                  <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-neutral-500 sm:text-xs">{property.title}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-950" aria-label={language === 'es' ? 'Cerrar apartado' : 'Close section'}>
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className={`${activeSection === 'summary' ? 'overflow-hidden p-3 sm:p-5' : 'overflow-y-auto p-4 sm:p-6'}`}>
              {content}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
