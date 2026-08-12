"use client";

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { formatCount, formatPropertyLocation, formatPublishedAgo } from '@/lib/textHelpers';
import { useSwap } from '@/lib/context/SwapContext';
import { useTranslation } from '@/lib/context/LanguageContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Heart, Share, Calendar, MapPin, Sparkles, AlertCircle,
  BedDouble, Bath, Users, ArrowRight, ChevronLeft, ChevronDown,
  MessageSquareCode,
  FileText, BarChart2, FileCheck, RefreshCw,
  Car, Building, Home, PhoneCall, Mail, UserRound, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { launchConfetti } from '@/components/runtime/launchConfetti';
import { LeadType, PropertyOffering, PropertyOfferingMode } from '@/lib/types';
import { useLiveContext } from '@/lib/context/LiveContext';
import {
  ETERNA_OPEN_PROPERTY_VIDEO_EVENT,
  type EternaOpenPropertyVideoDetail,
} from '@/lib/eterna/events';
import { LegalDossierSection } from '@/components/property/sections/LegalDossierSection';
import { FinancingCompatibility } from '@/components/property/sections/FinancingCompatibility';
import { EternaMarketAnalysis } from '@/components/property/sections/EternaMarketAnalysis';
import {
  TowersValuationPanel,
} from '@/components/property/sections/TowersValuationPanel';
import InternalAdvisorMarketplacePanel from '@/components/property/InternalAdvisorMarketplacePanel';
import { PropertySectionCard, PropertySubIcon } from '@/components/property/PropertySectionCard';
import { useNearbyPlaces } from '@/hooks/useNearbyPlaces';
import {
  calculateMortgage,
  DEFAULT_MORTGAGE_SCENARIO,
  MORTGAGE_SIMULATION_EVENT,
} from '@/lib/finance/mortgage';
import type { MortgageSimulationEventDetail } from '@/lib/finance/mortgage';
import ProfileAvatar from '@/components/ProfileAvatar';
import {
  VALUATION_MODEL_VERSION,
  ValuationEngine,
} from '@/lib/valuation/ValuationEngine';
import { PropertyAmenitiesSection } from '@/features/properties/property-details/PropertyAmenitiesSection';
import { PropertyMultimediaSection } from '@/features/properties/property-details/PropertyMultimediaSection';
import { PropertyTechnicalDetails } from '@/features/properties/property-details/PropertyTechnicalDetails';
import {
  OFFERING_BADGE_META,
  REPRESENTATIVE_LABELS,
  getActivePropertyOfferingSummary,
  getPublicResponsible,
} from '@/features/properties/property-details/propertyDetailsData';
import { PropertyGalleryHero } from '@/features/properties/property-details/gallery/PropertyGalleryHero';
import { PropertyGalleryModal } from '@/features/properties/property-details/gallery/PropertyGalleryModal';
import { usePropertyGallery } from '@/features/properties/property-details/gallery/usePropertyGallery';
import { PropertyLocationModal } from '@/features/properties/property-details/location/PropertyLocationModal';
import { PropertyLocationSection } from '@/features/properties/property-details/location/PropertyLocationSection';
import { usePropertyLocationModal } from '@/features/properties/property-details/location/usePropertyLocationModal';
import { buildPresentationValuation } from '@/features/properties/property-details/propertyValuation';
import {
  RentalTermCardGrid,
  RentalTermList,
  buildRentalTerms,
  formatRentalMoney,
} from '@/features/properties/property-details/rentalTerms';
import {
  formatPropertyCalendarMonth,
  usePropertyAvailability,
} from '@/features/properties/property-details/usePropertyAvailability';

interface PropertyDetailsClientProps {
  id: string;
}

export default function PropertyDetailsClient({ id }: PropertyDetailsClientProps) {
  const router = useRouter();
  const { properties, myProperties, requestSwap, favorites, toggleFavorite, currentUser, swaps, createLead, loading } = useSwap();
  const { t, language } = useTranslation();
  const { setActiveProperty, clearActiveProperty, openChat } = useLiveContext();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const property = useMemo(
    () => properties.find((candidate) => candidate.id === id),
    [id, properties],
  );
  const publicResponsible = useMemo(
    () => property ? getPublicResponsible(property) : null,
    [property],
  );
  const hasResponsible = publicResponsible !== null;

  const gallery = usePropertyGallery(property);
  const galleryMediaItems = gallery.mediaItems;
  const openGallery = gallery.openGallery;
  const locationModal = usePropertyLocationModal(id);

  useEffect(() => {
    const handleOpenPropertyVideo = (event: Event) => {
      const detail = (event as CustomEvent<EternaOpenPropertyVideoDetail>).detail;
      if (detail?.propertyId !== id) return;

      const firstVideoIndex = galleryMediaItems.findIndex((item) => item.type !== 'image');
      if (firstVideoIndex >= 0) openGallery(firstVideoIndex);
    };

    window.addEventListener(ETERNA_OPEN_PROPERTY_VIDEO_EVENT, handleOpenPropertyVideo);
    return () => window.removeEventListener(ETERNA_OPEN_PROPERTY_VIDEO_EVENT, handleOpenPropertyVideo);
  }, [galleryMediaItems, id, openGallery]);

  // Financing Calculator States
  const [downPaymentPct, setDownPaymentPct] = useState<number>(DEFAULT_MORTGAGE_SCENARIO.downPaymentPercent);
  const [financingTermYears, setFinancingTermYears] = useState<number>(DEFAULT_MORTGAGE_SCENARIO.years);
  const [mortgageAnnualRatePct, setMortgageAnnualRatePct] = useState<number>(DEFAULT_MORTGAGE_SCENARIO.annualRatePercent);

  useEffect(() => {
    const handleMortgageSimulation = (event: Event) => {
      const detail = (event as CustomEvent<MortgageSimulationEventDetail>).detail;
      if (!detail || detail.propertyId !== id) return;
      setDownPaymentPct(detail.downPaymentPercent);
      setFinancingTermYears(detail.years);
      setMortgageAnnualRatePct(detail.annualRatePercent);
    };

    window.addEventListener(MORTGAGE_SIMULATION_EVENT, handleMortgageSimulation);
    return () => window.removeEventListener(MORTGAGE_SIMULATION_EVENT, handleMortgageSimulation);
  }, [id]);

  const nearby = useNearbyPlaces(property?.latitude ?? null, property?.longitude ?? null);
  const automatedValuation = useMemo(
    () => property
      ? (property.valuation?.modelVersion === VALUATION_MODEL_VERSION
          ? property.valuation
          : ValuationEngine.evaluate(property, properties))
      : null,
    [property, properties],
  );
  const enrichedProperty = useMemo(
    () => property ? {
      ...property,
      valuation: automatedValuation,
      nearbyPlaces: nearby.data?.places || [],
    } : null,
    [property, automatedValuation, nearby.data?.places],
  );

  useEffect(() => {
    if (enrichedProperty) {
      setActiveProperty(enrichedProperty);
    }
    return () => {
      clearActiveProperty();
    };
  }, [enrichedProperty, setActiveProperty, clearActiveProperty]);

  const {
    activeOfferingModes,
    activeRentOffering,
    activeSaleOffering,
    activeSwapOffering,
  } = useMemo(() => getActivePropertyOfferingSummary(property), [property]);
  const hasSwapOffering = activeOfferingModes.includes('SWAP');

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedModeOverride, setSelectedMode] = useState<PropertyOfferingMode | null>(null);
  const selectedMode = selectedModeOverride && activeOfferingModes.includes(selectedModeOverride)
    ? selectedModeOverride
    : activeOfferingModes.includes('SWAP')
      ? 'SWAP'
      : activeOfferingModes[0] || null;
  const presentationValuation = useMemo(
    () => buildPresentationValuation({
      automatedValuation,
      language,
      offerings: property?.offerings,
      selectedMode,
    }),
    [automatedValuation, language, property?.offerings, selectedMode],
  );
  const {
    rentAmountDueAtSigning,
    rentCurrency,
    rentMonthsDueAtSigning,
    rentSecurityDeposit,
    rentTotalDueAtSigning,
    rentalTermItems,
  } = useMemo(
    () => buildRentalTerms(property, activeRentOffering, language),
    [activeRentOffering, language, property],
  );
  const [leadSuccessOpen, setLeadSuccessOpen] = useState(false);
  const [selectedLeadOffering, setSelectedLeadOffering] = useState<PropertyOffering | null>(null);
  const [leadContactPreference, setLeadContactPreference] = useState<'message' | 'call'>('message');
  const [leadMessage, setLeadMessage] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [selectedMyPropIdOverride, setSelectedMyPropId] = useState('');
  const selectedMyPropId = selectedMyPropIdOverride || myProperties[0]?.id || '';
  const [swapMessage, setSwapMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const {
    bookedRanges,
    calendarDays,
    calendarMonth,
    calendarYear,
    endDate,
    handleDateClick,
    handleNextMonth,
    handlePrevMonth,
    hasOverlap,
    numNights,
    rangeStatus,
    startDate,
  } = usePropertyAvailability({
    property,
    selectedMyPropertyId: selectedMyPropId,
    swaps,
  });

  const isSelfProperty = Boolean(property && currentUser && property.hostId === currentUser.id);

  useEffect(() => {
    const handleEternaContact = (event: Event) => {
      const detail = (event as CustomEvent<{
        propertyId?: string;
        channel?: 'message' | 'call';
        message?: string;
      }>).detail;

      if (!property || !hasResponsible || detail?.propertyId !== property.id) return;

      const offering = activeSaleOffering || activeRentOffering;
      const channel = detail.channel === 'call' ? 'call' : 'message';
      const fallbackMessage = channel === 'call'
        ? (language === 'es'
            ? `Hola, me interesa "${property.title}" y quisiera solicitar una llamada con el responsable comercial.`
            : `Hello, I am interested in "${property.title}" and would like to request a call with the advisor.`)
        : (language === 'es'
            ? `Hola, me interesa "${property.title}" y quisiera recibir más información.`
            : `Hello, I am interested in "${property.title}" and would like more information.`);
      const message = detail.message?.trim() || fallbackMessage;

      if (offering) {
        setSelectedLeadOffering(offering);
        setLeadContactPreference(channel);
        setLeadMessage(message);
        setLeadError('');
        setLeadModalOpen(true);
        return;
      }

      if (hasSwapOffering) {
        setSwapMessage(message);
        setModalOpen(true);
      }
    };

    window.addEventListener('eterna:open-property-contact', handleEternaContact);
    return () => window.removeEventListener('eterna:open-property-contact', handleEternaContact);
  }, [activeRentOffering, activeSaleOffering, hasResponsible, hasSwapOffering, language, property]);

  // If properties are still empty (initializing), render a loading skeleton
  if (!hasMounted || loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-gray-200 border-t-brand-black animate-spin" />
          <span className="text-[10px] uppercase font-black tracking-widest text-brand-gray-400">Loading premium spaces...</span>
        </div>
      </div>
    );
  }

  // If not found in reactive list, render beautiful 404 Space not found layout
  if (!property) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-2xl font-extrabold text-brand-black mb-3">Space not found</h2>
        <p className="text-brand-gray-500 mb-6 max-w-md leading-relaxed font-semibold">
          The property you are looking for is not available in the public catalog.
        </p>
        <button 
          onClick={() => router.push('/explore')} 
          className="px-6 py-3 bg-brand-black text-white hover:bg-brand-gray-800 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          Return to Explore
        </button>
      </div>
    );
  }

  const isFavorited = favorites.includes(property.id);

  const handleFavorite = () => {
    toggleFavorite(property.id);
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMyPropId) return;

    setIsSubmitting(true);
    
    // Simulate API delay
    setTimeout(() => {
      // Trigger global state swap request
      requestSwap({
        senderPropertyId: selectedMyPropId,
        receiverId: property.hostId,
        receiverPropertyId: property.id,
        startDate,
        endDate,
        message: swapMessage,
      });

      setIsSubmitting(false);
      setModalOpen(false);
      setSuccessOpen(true);

      // Fire a premium startup confetti show
      launchConfetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 }
      });
    }, 1000);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !selectedLeadOffering || !leadMessage.trim()) return;

    setIsSubmittingLead(true);
    setLeadError('');

    try {
      await createLead({
        propertyId: property.id,
        offeringId: selectedLeadOffering.id,
        leadType: selectedLeadOffering.mode as LeadType,
        message: leadMessage.trim(),
      });

      setLeadModalOpen(false);
      setLeadSuccessOpen(true);
      setLeadMessage('');
      setSelectedLeadOffering(null);
    } catch (err) {
      console.error('[PropertyDetails] Lead submission failed:', err);
      setLeadError(
        currentUser
          ? (language === 'es' ? 'No pudimos enviar tu solicitud. Intenta de nuevo.' : 'We could not send your request. Please try again.')
          : (language === 'es' ? 'Inicia sesión para enviar una solicitud.' : 'Please sign in to send a request.')
      );
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleBack = () => {
    if (typeof window === 'undefined') return;

    const cameFromAuraSwap = document.referrer
      ? new URL(document.referrer).origin === window.location.origin
      : false;

    if (cameFromAuraSwap) {
      router.back();
      return;
    }

    router.push('/explore');
  };

  const publicationLabel = formatPublishedAgo(
    property.publishedAt || property.createdAt,
    language === 'es' ? 'es' : 'en',
  );

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24">
      
      {/* 1. Sub-Header: Title & Sharing Controls */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="mb-1 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label={language === 'es' ? 'Volver a la página anterior' : 'Return to the previous page'}
            className="group inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-brand-gray-200 bg-white px-3.5 text-xs font-extrabold text-brand-gray-600 shadow-xs transition-all hover:border-brand-gray-300 hover:bg-brand-gray-50 hover:text-brand-black active:scale-[0.97]"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>{language === 'es' ? 'Atrás' : 'Back'}</span>
          </button>
          {property.internalCode && (
            <span
              title={language === 'es' ? 'Folio interno Towers México' : 'Towers México internal reference'}
              className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gray-400"
            >
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              Ref. {property.internalCode}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-black">
            {t(`properties.${property.id}.title`, undefined, property.title)}
          </h1>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full border border-brand-gray-200 hover:border-brand-black text-xs font-bold text-brand-gray-500 hover:text-brand-black transition-colors cursor-pointer h-9">
              <Share className="w-3.5 h-3.5 shrink-0" />
              <span>{t('details.share')}</span>
            </button>
            <button 
              onClick={handleFavorite}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full border text-xs transition-all cursor-pointer h-9 ${
                isFavorited 
                  ? 'bg-brand-rose/5 border-brand-rose text-brand-rose font-bold'
                  : 'border-brand-gray-200 hover:border-brand-black text-brand-gray-500 hover:text-brand-black font-bold'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 shrink-0 ${isFavorited ? 'fill-brand-rose' : ''}`} />
              <span>{isFavorited ? t('details.saved') : t('details.save')}</span>
            </button>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-brand-gray-500 sm:text-sm">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-gray-400" />
            <span>{formatPropertyLocation(property.location, property.country)}</span>
          </div>
          {publicationLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-brand-gray-400" />
              {publicationLabel}
            </span>
          )}
        </div>

        {activeOfferingModes.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400">
                Disponible como
              </span>
              {activeOfferingModes.map((mode) => {
                const meta = OFFERING_BADGE_META[mode];
                return (
                  <span
                    key={mode}
                    className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[10px] font-black uppercase leading-none tracking-[0.1em] ${meta.className}`}
                  >
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Premium Image Grid (Apple/Airbnb Inspired) */}
      <PropertyGalleryHero controller={gallery} language={language} property={property} />
      <TowersValuationPanel
        property={property}
        valuation={presentationValuation}
        language={language === 'es' ? 'es' : 'en'}
        onAskEterna={() => openChat(
          language === 'es'
            ? 'Explícame la estimación Towers de esta propiedad, su rango, confianza y comparables.'
            : 'Explain the Towers estimate for this property, including its range, confidence and comparables.',
        )}
        className="mb-10"
      />

      {/* 3. Main Split-Pane Content */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        
        {/* Left Column: Specifications & Descriptions */}
        <div className="flex-1 flex w-full flex-col gap-5">
          
          {/* Price display at the top of Left Column */}
          {(() => {
            let priceText = '';
            let labelText = '';
            if (selectedMode === 'SALE' && activeSaleOffering) {
              priceText = activeSaleOffering.priceAmount != null
                ? `${activeSaleOffering.currency || 'USD'} $${activeSaleOffering.priceAmount.toLocaleString()}`
                : (language === 'es' ? 'Precio a consultar' : 'Price on request');
              labelText = language === 'es' ? 'Precio de Venta' : 'Sale Price';
            } else if ((selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') && activeRentOffering) {
              priceText = activeRentOffering.priceAmount != null
                ? `${activeRentOffering.currency || 'USD'} $${activeRentOffering.priceAmount.toLocaleString()} / ${language === 'es' ? 'periodo' : 'period'}`
                : (language === 'es' ? 'Precio a consultar' : 'Price on request');
              labelText = language === 'es' ? 'Precio de Renta' : 'Rental Price';
            } else if (selectedMode === 'SWAP') {
              priceText = language === 'es' ? 'Disponible para Intercambio' : 'Available for Swap';
              labelText = language === 'es' ? 'Modalidad de Trueque' : 'Swap Mode';
            }

            if (!priceText) return null;

            return (
              <div className="border-b border-brand-gray-200/80 pb-5 animate-in fade-in duration-300">
                <span className="inline-block bg-brand-accent/10 text-brand-accent px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">{labelText}</span>
                <div className="text-3xl font-black text-brand-black tracking-tight mt-2 flex items-baseline gap-1">
                  {priceText}
                </div>
              </div>
            );
          })()}

          {/* Core specs: one consistent grid so every value is easy to scan. */}
          {(() => {
            const specs = [
              {
                key: 'bedrooms',
                Icon: BedDouble,
                badge: null,
                label: language === 'es' ? 'Recámaras' : 'Bedrooms',
                value: language === 'es'
                  ? formatCount(Number(property.bedrooms) || 0, 'recámara', 'recámaras', 'feminine')
                  : `${Number(property.bedrooms) || 0} bedroom${Number(property.bedrooms) === 1 ? '' : 's'}`,
              },
              {
                key: 'bathrooms',
                Icon: Bath,
                badge: null,
                label: language === 'es' ? 'Baños completos' : 'Full bathrooms',
                value: language === 'es'
                  ? formatCount(Number(property.bathrooms) || 0, 'baño completo', 'baños completos', 'masculine')
                  : `${Number(property.bathrooms) || 0} full bathroom${Number(property.bathrooms) === 1 ? '' : 's'}`,
              },
              {
                key: 'halfBathrooms',
                Icon: Bath,
                badge: '½',
                label: language === 'es' ? 'Medios baños' : 'Half bathrooms',
                value: language === 'es'
                  ? formatCount(Number(property.halfBathrooms) || 0, 'medio baño', 'medios baños', 'masculine')
                  : `${Number(property.halfBathrooms) || 0} half bathroom${Number(property.halfBathrooms) === 1 ? '' : 's'}`,
              },
              {
                key: 'parkingSpaces',
                Icon: Car,
                badge: null,
                label: language === 'es' ? 'Estacionamientos' : 'Parking',
                value: language === 'es'
                  ? formatCount(Number(property.parkingSpaces) || 0, 'estacionamiento', 'estacionamientos', 'masculine')
                  : `${Number(property.parkingSpaces) || 0} parking space${Number(property.parkingSpaces) === 1 ? '' : 's'}`,
              },
              ...(selectedMode === 'SALE' && Number(property.levelsCount) > 0 ? [{
                key: 'levelsCount',
                Icon: Building,
                badge: null,
                label: language === 'es' ? 'Niveles' : 'Levels',
                value: language === 'es'
                  ? formatCount(Number(property.levelsCount), 'nivel', 'niveles', 'masculine')
                  : `${property.levelsCount} level${Number(property.levelsCount) === 1 ? '' : 's'}`,
              }] : []),
              ...(selectedMode === 'SALE' && Number(property.surfaceBuilt) > 0 ? [{
                key: 'surfaceBuilt',
                Icon: Building,
                badge: null,
                label: language === 'es' ? 'Construcción' : 'Built area',
                value: `${property.surfaceBuilt} m²`,
              }] : []),
              ...(selectedMode === 'SALE' && Number(property.surfaceTotal) > 0 ? [{
                key: 'surfaceTotal',
                Icon: Home,
                badge: null,
                label: language === 'es' ? 'Terreno' : 'Lot size',
                value: `${property.surfaceTotal} m²`,
              }] : []),
              ...(selectedMode !== 'SALE' && Number(property.maxGuests) > 0 ? [{
                key: 'maxGuests',
                Icon: Users,
                badge: null,
                label: t('details.guests'),
                value: language === 'es'
                  ? formatCount(Number(property.maxGuests), 'persona', 'personas', 'feminine')
                  : `${property.maxGuests} guest${Number(property.maxGuests) === 1 ? '' : 's'}`,
              }] : []),
              ...(selectedMode === 'SWAP' && property.valueRating ? [{
                key: 'valueRating',
                Icon: RefreshCw,
                badge: null,
                label: language === 'es' ? 'Categoría' : 'Swap tier',
                value: `${property.valueRating} Swap`,
              }] : []),
            ];

            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(({ key, Icon, badge, label, value }) => (
                  <article
                    key={key}
                    className="group relative flex min-h-[138px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-neutral-200/75 bg-white p-4 shadow-[0_16px_35px_-32px_rgba(15,23,42,0.65)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_20px_38px_-28px_rgba(15,23,42,0.4)]"
                  >
                    <div className="flex items-start">
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-neutral-950 text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.95)]">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        {badge && (
                          <span className="absolute -bottom-1.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-md border-2 border-white bg-amber-400 px-1 text-[10px] font-black leading-none text-neutral-950 shadow-sm">
                            {badge}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-auto pt-3">
                      <span className="block text-[10px] font-black uppercase leading-tight tracking-[0.09em] text-neutral-400">
                        {label}
                      </span>
                      <strong className="mt-1 block text-sm font-black leading-snug tracking-tight text-neutral-900 sm:text-base">
                        {value}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}

          {/* 1. Descripción */}
          <PropertySectionCard
            icon={FileText}
            eyebrow={language === 'es' ? 'Presentación' : 'Overview'}
            title={t('details.aboutSpace')}
          >
            <p className="text-sm text-brand-gray-500 leading-relaxed whitespace-pre-line font-medium">
              {t(`properties.${property.id}.description`, undefined, property.description)}
            </p>
          </PropertySectionCard>

          {/* 5. Amenidades */}
          <PropertyAmenitiesSection property={property} />
          {/* Technical details, services and security in one progressive disclosure. */}
          <PropertyTechnicalDetails property={property} language={language} />

          {/* 7. Multimedia Avanzada (Pestañas) */}
          <PropertyMultimediaSection language={language} property={property} />
          {/* 8. Ubicación y Mapa */}
          <PropertyLocationSection
            property={property}
            places={nearby.data?.places}
            loading={nearby.loading}
            error={nearby.error}
            language={language}
          />
          {/* Responsable público: no se generan identidades ni canales de contacto de relleno. */}
          {publicResponsible ? (
            <section className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white px-5 py-6 shadow-[0_22px_55px_-42px_rgba(15,23,42,0.55)] sm:px-6 sm:py-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
                <div className="flex items-center gap-4">
                  <ProfileAvatar
                    src={publicResponsible.photo}
                    name={publicResponsible.name}
                    className="h-20 w-20 border border-neutral-200"
                    textClassName="text-xl"
                  />
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-neutral-700">
                      {publicResponsible.representativeType
                        ? REPRESENTATIVE_LABELS[publicResponsible.representativeType][language === 'es' ? 'es' : 'en']
                        : (language === 'es' ? 'Publicador de la propiedad' : 'Property publisher')}
                    </span>
                    <h4 className="mt-2 break-words text-xl font-black leading-tight text-brand-black sm:text-2xl">
                      {publicResponsible.name}
                    </h4>
                    {(publicResponsible.position || publicResponsible.company) && (
                      <p className="mt-2 text-xs font-semibold text-brand-gray-500">
                        {[publicResponsible.position, publicResponsible.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {publicResponsible.representativeType && (
                      <span className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-700">
                        <ShieldCheck className="h-3 w-3" />
                        {language === 'es' ? 'Contacto de publicación completado' : 'Publisher contact completed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/55 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {publicResponsible.whatsapp && (
                      <a
                        href={`https://wa.me/${publicResponsible.whatsapp}?text=${encodeURIComponent(
                          language === 'es'
                            ? `Hola ${publicResponsible.name}, me interesa "${property.title}" (folio ${property.internalCode || property.id}).`
                            : `Hello ${publicResponsible.name}, I am interested in "${property.title}" (reference ${property.internalCode || property.id}).`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-[10px] font-extrabold text-white"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    )}
                    {publicResponsible.phone && (
                      <a href={`tel:${publicResponsible.phone}`} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-extrabold text-neutral-800">
                        <PhoneCall className="h-4 w-4" />
                        {language === 'es' ? 'Llamar' : 'Call'}
                      </a>
                    )}
                    {publicResponsible.email && (
                      <a
                        href={`mailto:${publicResponsible.email}?subject=${encodeURIComponent(`${property.title} · Towers México`)}`}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-extrabold text-neutral-800"
                      >
                        <Mail className="h-4 w-4" />
                        {language === 'es' ? 'Correo' : 'Email'}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push(`/profile/${publicResponsible.profileId}`)}
                      className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-extrabold text-neutral-800"
                    >
                      <UserRound className="h-4 w-4" />
                      {language === 'es' ? 'Ver perfil' : 'View profile'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] border border-dashed border-amber-300 bg-amber-50/60 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-xs font-black text-amber-950">
                    {language === 'es' ? 'Contacto no disponible' : 'Contact unavailable'}
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold leading-relaxed text-amber-900/75">
                    {language === 'es'
                      ? 'Este anuncio aún no tiene un responsable público validado. Las solicitudes y datos de contacto permanecen deshabilitados.'
                      : 'This listing does not yet have a validated public representative. Requests and contact details remain disabled.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* El expediente legal aplica a operaciones de compraventa, no a rentas. */}
          {selectedMode !== 'MONTHLY_RENT' && selectedMode !== 'SHORT_RENT' && (
            <LegalDossierSection property={property} language={language} />
          )}

          {/* Métodos de Pago / Financiamiento Card (Dynamic based on selectedMode) */}
          {selectedMode === 'SALE' && (
            <FinancingCompatibility property={property} language={language} />
          )}

          <InternalAdvisorMarketplacePanel property={property} language={language} />

          {((selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') || selectedMode === 'SWAP') && (
            <PropertySectionCard
              icon={selectedMode === 'SWAP' ? RefreshCw : FileCheck}
              eyebrow={language === 'es' ? 'Condiciones comerciales' : 'Commercial terms'}
              title={selectedMode === 'SWAP'
                ? (language === 'es' ? 'Formas de intercambio aceptadas' : 'Accepted swap framework')
                : (language === 'es' ? 'Condiciones de contratación' : 'Lease terms & conditions')}
              description={selectedMode === 'SWAP'
                ? (language === 'es' ? 'Revisa las modalidades y preferencias declaradas para este intercambio.' : 'Review the declared modes and preferences for this exchange.')
                : (language === 'es' ? 'Consulta los requisitos principales antes de solicitar esta propiedad.' : 'Review the main requirements before requesting this property.')}
              className="animate-in fade-in duration-300"
            >
              {/* RENT mode: Conditions of lease */}
              {(selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') && activeRentOffering && (
                <RentalTermCardGrid items={rentalTermItems} />
              )}

              {/* SWAP mode: Forms of exchange accepted */}
              {selectedMode === 'SWAP' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Intercambio directo:' : 'Direct swap:'}</span>
                      <span className="text-emerald-700 font-extrabold">{language === 'es' ? 'Aceptado' : 'Accepted'}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Intercambio + diferencia:' : 'Swap + cash:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {activeSwapOffering?.swapCashDifferenceAllowed === true
                          ? (language === 'es' ? 'Declarado aceptado' : 'Declared accepted')
                          : activeSwapOffering?.swapCashDifferenceAllowed === false
                            ? (language === 'es' ? 'Declarado no aceptado' : 'Declared not accepted')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Solo propiedades:' : 'Properties only:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {property.metadata?.swapPropertiesOnly === true
                          ? (language === 'es' ? 'Declarado: sí' : 'Declared: yes')
                          : property.metadata?.swapPropertiesOnly === false
                            ? (language === 'es' ? 'Declarado: no' : 'Declared: no')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Vehículos + diferencia:' : 'Vehicles + cash:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {property.metadata?.swapVehiclesAllowed === true
                          ? (language === 'es' ? 'Declarados aceptados' : 'Declared allowed')
                          : property.metadata?.swapVehiclesAllowed === false
                            ? (language === 'es' ? 'Declarados no aceptados' : 'Declared not allowed')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Terrenos:' : 'Land lots:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {property.metadata?.swapLandAllowed === true
                          ? (language === 'es' ? 'Declarados aceptados' : 'Declared allowed')
                          : property.metadata?.swapLandAllowed === false
                            ? (language === 'es' ? 'Declarados no aceptados' : 'Declared not allowed')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Departamentos:' : 'Apartments:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {property.metadata?.swapApartmentsAllowed === true
                          ? (language === 'es' ? 'Declarados aceptados' : 'Declared allowed')
                          : property.metadata?.swapApartmentsAllowed === false
                            ? (language === 'es' ? 'Declarados no aceptados' : 'Declared not allowed')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-brand-gray-150 pt-3 mt-1" />
                  <h4 className="text-xs font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-brand-gray-400" />
                    <span>{language === 'es' ? 'Busca recibir a cambio:' : 'Seeks to receive in return:'}</span>
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {['Casa', 'Departamento', 'Terreno', 'Local', 'Vehículo', 'Efectivo'].map((item) => {
                      const isLookingFor = Array.isArray(property.metadata?.swapPreferencesTags)
                        && property.metadata.swapPreferencesTags.includes(item);
                      return (
                        <span 
                          key={item}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all duration-200 ${
                            isLookingFor 
                              ? 'bg-brand-accent/10 border-brand-accent text-brand-accent shadow-xs' 
                              : 'bg-brand-gray-50 border-brand-gray-300 text-brand-gray-400 opacity-60'
                          }`}
                        >
                          {isLookingFor ? '✓ ' : ''}{item}
                        </span>
                      );
                    })}
                  </div>
                  {property.desiredExchange && (
                    <div className="p-4 bg-brand-gray-50 border border-brand-gray-300 rounded-2xl text-xs font-semibold text-brand-black mt-3.5 flex flex-col gap-1 w-full">
                      <span className="text-brand-gray-500 font-bold uppercase tracking-wider text-[9px]">{language === 'es' ? 'Preferencia de Intercambio Deseada:' : 'Desired Exchange Preference:'}</span>
                      <span className="text-brand-black font-extrabold text-xs">{property.desiredExchange}</span>
                    </div>
                  )}
                </>
              )}
            </PropertySectionCard>
          )}


          {/* 10. Análisis Inmobiliario con IA (Eterna) */}
          <EternaMarketAnalysis property={property} language={language} />

        </div>

        {/* Right Column: Sticky Hybrid Booking / Swap / Purchase widget */}
        <div className="w-full lg:w-96 lg:sticky lg:top-28 shrink-0">
          <div className="w-full overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white p-5 shadow-[0_22px_55px_-42px_rgba(15,23,42,0.55)] sm:p-6">
            
            {/* Segmented Mode Control if 2 or more offerings are active */}
            {activeOfferingModes.length >= 2 && (
              <div className="flex bg-brand-gray-100 p-1 rounded-2xl mb-5 border border-brand-gray-200/40 relative">
                {activeOfferingModes.map((mode) => {
                  const isActive = selectedMode === mode;
                  let label = '';
                  if (mode === 'SWAP') label = 'Swap 🔄';
                  else if (mode === 'SHORT_RENT') label = language === 'es' ? 'Temp 🏡' : 'Short 🏡';
                  else if (mode === 'MONTHLY_RENT') label = language === 'es' ? 'Mes 📅' : 'Monthly 📅';
                  else if (mode === 'SALE') label = language === 'es' ? 'Venta' : 'Sale';

                  return (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`flex-1 py-2 text-center text-[10px] font-black rounded-xl transition-all duration-200 cursor-pointer relative z-10 select-none ${
                        isActive 
                          ? 'bg-white text-brand-black shadow-sm'
                          : 'text-brand-gray-500 hover:text-brand-black'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* EXPERIENCE 1: SWAP */}
            {selectedMode === 'SWAP' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">{t('details.directSwap')}</span>
                    <p className="text-[10px] text-brand-gray-500 font-bold uppercase tracking-wider mt-0.5">{t('details.rentFreeExchange')}</p>
                  </div>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-600">
                    {language === 'es' ? 'Modalidad declarada' : 'Declared mode'}
                  </span>
                </div>

                {/* Selected Dates Display */}
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="bg-brand-gray-50 p-3 rounded-2xl border border-brand-gray-200/50 flex flex-col gap-0.5 animate-in fade-in">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">{t('details.checkIn')}</span>
                    <span className="text-xs font-extrabold text-brand-black">
                      {startDate ? startDate : (language === 'es' ? 'Seleccionar' : 'Select')}
                    </span>
                  </div>
                  <div className="bg-brand-gray-50 p-3 rounded-2xl border border-brand-gray-200/50 flex flex-col gap-0.5 animate-in fade-in">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">{t('details.checkOut')}</span>
                    <span className="text-xs font-extrabold text-brand-black">
                      {endDate ? endDate : (language === 'es' ? 'Seleccionar' : 'Select')}
                    </span>
                  </div>
                </div>

                {/* Inline Calendar */}
                <div className="border border-brand-gray-200 rounded-2xl p-4 bg-white shadow-xs animate-in fade-in">
                  {/* Month navigation header */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <button 
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 hover:bg-brand-gray-50 rounded-lg border border-brand-gray-200 text-brand-gray-600 hover:text-brand-black transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    
                    <span className="text-xs font-extrabold text-brand-black select-none">
                      {formatPropertyCalendarMonth(calendarMonth, calendarYear, language)}
                    </span>
                    
                    <button 
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-brand-gray-50 rounded-lg border border-brand-gray-200 text-brand-gray-600 hover:text-brand-black transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Days of week header */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {(language === 'es' ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((dayName) => (
                      <span key={dayName} className="text-[9px] font-bold uppercase tracking-wider text-brand-gray-400 select-none">
                        {dayName}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const dayStr = day.date.toISOString().split('T')[0];
                      const isSelectedStart = startDate === dayStr;
                      const isSelectedEnd = endDate === dayStr;
                      const isSelected = isSelectedStart || isSelectedEnd;
                      const isInRange = startDate && endDate && dayStr > startDate && dayStr < endDate;

                      const isOccupied = bookedRanges.some(b => dayStr >= b.start && dayStr <= b.end);
                      const isWithinBounds = property ? (dayStr >= property.availableStart && dayStr <= property.availableEnd) : false;
                      const isAvailable = isWithinBounds && !isOccupied;

                      let dayClass = 'relative text-center aspect-square flex items-center justify-center text-xs font-semibold select-none transition-all duration-150 ';
                      
                      if (day.type !== 'current') {
                        dayClass += 'opacity-25 ';
                      }

                      if (isSelected) {
                        dayClass += 'bg-brand-accent text-white font-extrabold shadow-sm rounded-full cursor-pointer scale-105 z-10 ';
                      } else if (isInRange) {
                        dayClass += 'bg-brand-accent/15 text-brand-black cursor-pointer rounded-none ';
                      } else if (isOccupied) {
                        dayClass += 'text-red-500 line-through cursor-not-allowed ';
                      } else if (!isWithinBounds) {
                        dayClass += 'text-brand-gray-300 bg-brand-gray-50/20 cursor-not-allowed ';
                      } else {
                        dayClass += 'text-brand-black hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer rounded-full ';
                      }

                      let tooltipText = '';
                      if (isOccupied) {
                        tooltipText = language === 'es' ? 'Fecha reservada (No disponible)' : 'Reserved date (Unavailable)';
                      } else if (!isWithinBounds) {
                        tooltipText = language === 'es' ? 'Fuera de disponibilidad' : 'Outside available window';
                      } else if (isAvailable) {
                        tooltipText = language === 'es' ? 'Fecha disponible' : 'Available date';
                      }

                      return (
                        <div
                          key={day.key}
                          onClick={() => (isAvailable ? handleDateClick(day.date) : null)}
                          className={dayClass}
                          title={tooltipText}
                        >
                          <span className="relative z-10">{day.date.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Overlap Status Indicators */}
                {startDate && endDate && (
                  <div className="mt-1 transition-all">
                    {rangeStatus === 'available' && (
                      <div className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold shadow-xs animate-in fade-in">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span>{language === 'es' ? '✓ Fechas disponibles para swap recíproco' : '✓ Dates fully available for reciprocal swap'}</span>
                      </div>
                    )}
                    {rangeStatus === 'partial' && (
                      <div className="bg-amber-50 text-amber-700 border border-amber-200/50 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold shadow-xs animate-in fade-in">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>{language === 'es' ? '⚠ Parcialmente ocupado. Selecciona otras fechas.' : '⚠ Partially occupied. Please choose other dates.'}</span>
                      </div>
                    )}
                    {rangeStatus === 'unavailable' && (
                      <div className="bg-rose-50 text-rose-700 border border-rose-200/50 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold shadow-xs animate-in fade-in">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <span>{language === 'es' ? '✗ Fechas no disponibles en este periodo' : '✗ Dates not available in this period'}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Service Fee Info */}
                <div className="flex flex-col gap-3 pt-2 text-xs">
                  <div className="bg-brand-gray-50/90 rounded-2xl p-3 border border-brand-gray-200/40 text-[9px] leading-relaxed text-brand-gray-500 font-semibold flex items-start gap-2 shadow-innerScale">
                    <span className="text-brand-accent text-xs">ℹ</span>
                    <p>
                      {language === 'es' 
                        ? "Etapa Exploratoria: No se solicitan datos de pago en esta fase. Los costes detallados son estimaciones aplicables únicamente si ambos propietarios confirman el swap de mutuo acuerdo."
                        : "Exploratory Stage: No payment details are requested in this phase. Detailed fees are estimates applicable only if both owners mutually confirm the swap."}
                    </p>
                  </div>

                  {/* Detailed trueque preferences card */}
                  <div className="bg-brand-gray-50 rounded-2xl p-4 border border-brand-gray-200/40 text-[11px] leading-relaxed text-brand-gray-600 font-semibold flex flex-col gap-2 shadow-xs mb-1">
                    <div className="flex items-center justify-between text-brand-black font-extrabold text-[9px] uppercase tracking-wider text-brand-accent">
                      <span>🔄</span>
                      <span>{language === 'es' ? 'Preferencias de Intercambio' : 'Swap Preferences'}</span>
                    </div>
                    <div className="border-t border-brand-gray-200/60 my-1" />
                    <div className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span>{language === 'es' ? 'Acepta:' : 'Accepts:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {[
                          property.metadata?.swapAcceptsHouse === true ? (language === 'es' ? 'Casa' : 'House') : null,
                          property.metadata?.swapAcceptsDept === true ? (language === 'es' ? 'Depto' : 'Condo') : null,
                          property.metadata?.swapAcceptsLand ? (language === 'es' ? 'Terreno' : 'Land') : null,
                          property.metadata?.swapAcceptsVehicle ? (language === 'es' ? 'Vehículo' : 'Vehicle') : null
                        ].filter(Boolean).join(', ') || (language === 'es' ? 'Sin preferencias documentadas' : 'No documented preferences')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span>{language === 'es' ? 'Efectivo como diferencia:' : 'Cash difference:'}</span>
                      <span className="text-brand-black font-extrabold">
                        {property.metadata?.swapAcceptsCash === true
                          ? (language === 'es' ? 'Declarado como aceptado' : 'Declared accepted')
                          : property.metadata?.swapAcceptsCash === false
                            ? (language === 'es' ? 'Declarado como no aceptado' : 'Declared not accepted')
                            : (language === 'es' ? 'Sin confirmar' : 'Unconfirmed')}
                      </span>
                    </div>
                    {property.metadata?.swapMaxCashDiff && (
                      <div className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                        <span>{language === 'es' ? 'Diferencia máxima:' : 'Max difference:'}</span>
                        <span className="text-brand-black font-extrabold">${Number(property.metadata?.swapMaxCashDiff).toLocaleString()} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{language === 'es' ? 'Ciudades aceptadas:' : 'Preferred cities:'}</span>
                      <span className="text-brand-black font-extrabold">{property.desiredExchange || (language === 'es' ? 'Sin preferencia documentada' : 'No documented preference')}</span>
                    </div>
                  </div>
                </div>

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl flex flex-col gap-2 shadow-sm text-xs leading-relaxed text-brand-black animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-brand-accent uppercase tracking-wider text-[10px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{language === 'es' ? 'Tu Anuncio' : 'Your Listing'}</span>
                    </div>
                    <p className="text-brand-gray-500 font-medium leading-relaxed">
                      {t('details.selfSwapWarning')}
                    </p>
                  </div>
                ) : hasResponsible ? (
                  <button 
                    onClick={() => setModalOpen(true)}
                    disabled={rangeStatus !== 'available'}
                    className={`w-full py-4 rounded-2xl text-sm font-bold shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer mt-2 ${
                      rangeStatus !== 'available'
                        ? 'bg-brand-gray-200 text-brand-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-brand-accent hover:bg-brand-accent/90 text-white hover:scale-[1.01]'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>
                      {!startDate || !endDate 
                        ? (language === 'es' ? 'Selecciona fechas' : 'Select dates') 
                        : (language === 'es' ? 'Proponer intercambio' : t('details.requestSwapBtn'))}
                    </span>
                  </button>
                ) : null}

                <span className="text-[10px] text-brand-gray-500 text-center block leading-relaxed font-semibold px-2">
                  {language === 'es' 
                    ? "Explorarás la compatibilidad del intercambio antes de cualquier confirmación. No existe ningún cargo ni compromiso en esta etapa."
                    : "You will explore swap compatibility before any confirmation. There is no charge or commitment at this stage."}
                </span>
              </div>
            )}

            {/* EXPERIENCE 2: SHORT_RENT (Airbnb/Wander premium style) */}
            {selectedMode === 'SHORT_RENT' && activeRentOffering && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex items-baseline border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">
                      {activeRentOffering.priceAmount != null
                        ? `${activeRentOffering.currency || 'USD'} $${activeRentOffering.priceAmount.toLocaleString()}`
                        : (language === 'es' ? 'Precio a consultar' : 'Price on request')}
                    </span>
                    <span className="text-xs text-brand-gray-500 font-semibold"> / {language === 'es' ? 'noche' : 'night'}</span>
                  </div>
                </div>

                {/* Selected Dates Display */}
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="bg-brand-gray-50 p-3 rounded-2xl border border-brand-gray-200/50 flex flex-col gap-0.5 animate-in fade-in">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">{t('details.checkIn')}</span>
                    <span className="text-xs font-extrabold text-brand-black">
                      {startDate ? startDate : (language === 'es' ? 'Seleccionar' : 'Select')}
                    </span>
                  </div>
                  <div className="bg-brand-gray-50 p-3 rounded-2xl border border-brand-gray-200/50 flex flex-col gap-0.5 animate-in fade-in">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">{t('details.checkOut')}</span>
                    <span className="text-xs font-extrabold text-brand-black">
                      {endDate ? endDate : (language === 'es' ? 'Seleccionar' : 'Select')}
                    </span>
                  </div>
                </div>

                {/* Inline Calendar */}
                <div className="border border-brand-gray-200 rounded-2xl p-4 bg-white shadow-xs animate-in fade-in">
                  {/* Month navigation header */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <button 
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 hover:bg-brand-gray-50 rounded-lg border border-brand-gray-200 text-brand-gray-600 hover:text-brand-black transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    
                    <span className="text-xs font-extrabold text-brand-black select-none">
                      {formatPropertyCalendarMonth(calendarMonth, calendarYear, language)}
                    </span>
                    
                    <button 
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-brand-gray-50 rounded-lg border border-brand-gray-200 text-brand-gray-600 hover:text-brand-black transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Days of week header */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {(language === 'es' ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((dayName) => (
                      <span key={dayName} className="text-[9px] font-bold uppercase tracking-wider text-brand-gray-400 select-none">
                        {dayName}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const dayStr = day.date.toISOString().split('T')[0];
                      const isSelectedStart = startDate === dayStr;
                      const isSelectedEnd = endDate === dayStr;
                      const isSelected = isSelectedStart || isSelectedEnd;
                      const isInRange = startDate && endDate && dayStr > startDate && dayStr < endDate;

                      const isOccupied = bookedRanges.some(b => dayStr >= b.start && dayStr <= b.end);
                      const isWithinBounds = property ? (dayStr >= property.availableStart && dayStr <= property.availableEnd) : false;
                      const isAvailable = isWithinBounds && !isOccupied;

                      let dayClass = 'relative text-center aspect-square flex items-center justify-center text-xs font-semibold select-none transition-all duration-150 ';
                      
                      if (day.type !== 'current') {
                        dayClass += 'opacity-25 ';
                      }

                      if (isSelected) {
                        dayClass += 'bg-brand-accent text-white font-extrabold shadow-sm rounded-full cursor-pointer scale-105 z-10 ';
                      } else if (isInRange) {
                        dayClass += 'bg-brand-accent/15 text-brand-black cursor-pointer rounded-none ';
                      } else if (isOccupied) {
                        dayClass += 'text-red-500 line-through cursor-not-allowed ';
                      } else if (!isWithinBounds) {
                        dayClass += 'text-brand-gray-300 bg-brand-gray-50/20 cursor-not-allowed ';
                      } else {
                        dayClass += 'text-brand-black hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer rounded-full ';
                      }

                      return (
                        <div
                          key={day.key}
                          onClick={() => (isAvailable ? handleDateClick(day.date) : null)}
                          className={dayClass}
                        >
                          <span className="relative z-10">{day.date.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Specifications List */}
                <div className="bg-brand-gray-50 rounded-2xl p-3 border border-brand-gray-200/40 text-[10px] leading-relaxed text-brand-gray-600 font-semibold flex flex-col gap-1.5">
                  {activeRentOffering.minNights != null && (
                    <div className="flex justify-between">
                      <span>{language === 'es' ? 'Estancia mínima:' : 'Minimum stay:'}</span>
                      <span className="text-brand-black font-bold">{activeRentOffering.minNights} {language === 'es' ? 'noches' : 'nights'}</span>
                    </div>
                  )}
                  {activeRentOffering.securityDepositAmount != null && (
                    <div className="flex justify-between">
                      <span>{language === 'es' ? 'Depósito declarado:' : 'Declared deposit:'}</span>
                      <span className="text-brand-black font-bold">
                        {activeRentOffering.currency || 'USD'} ${activeRentOffering.securityDepositAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Calculation Summary */}
                {startDate && endDate && activeRentOffering.priceAmount != null && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-brand-gray-100 text-xs">
                    <div className="flex justify-between text-brand-gray-500">
                      <span>${activeRentOffering.priceAmount} x {numNights} {language === 'es' ? 'noches' : 'nights'}</span>
                      <span className="font-semibold text-brand-black">
                        ${(activeRentOffering.priceAmount * numNights).toLocaleString()} {activeRentOffering.currency || 'USD'}
                      </span>
                    </div>
                    {activeRentOffering.metadata?.weeklyPrice && numNights >= 7 && (
                      <div className="flex justify-between text-emerald-600 font-semibold text-[10px]">
                        <span>{language === 'es' ? '¡Descuento semanal aplicado!' : 'Weekly discount applied!'}</span>
                        <span>-${Math.floor((activeRentOffering.priceAmount * numNights) - (Number(activeRentOffering.metadata.weeklyPrice) * (numNights / 7)))} {activeRentOffering.currency || 'USD'}</span>
                      </div>
                    )}
                    {activeRentOffering.securityDepositAmount != null && (
                      <div className="flex justify-between text-brand-gray-500">
                        <span>{language === 'es' ? 'Depósito de garantía' : 'Security deposit'}</span>
                        <span className="font-semibold text-brand-black">${activeRentOffering.securityDepositAmount.toLocaleString()} {activeRentOffering.currency || 'USD'}</span>
                      </div>
                    )}
                    {activeRentOffering.cleaningFeeAmount != null && (
                      <div className="flex justify-between text-brand-gray-500">
                        <span>{language === 'es' ? 'Tarifa de limpieza' : 'Cleaning fee'}</span>
                        <span className="font-semibold text-brand-black">${activeRentOffering.cleaningFeeAmount.toLocaleString()} {activeRentOffering.currency || 'USD'}</span>
                      </div>
                    )}
                    <div className="border-t border-brand-gray-100 my-1" />
                    <div className="flex items-center justify-between font-bold text-brand-black text-sm">
                      <span>{language === 'es' ? 'Total estimado' : 'Estimated Total'}</span>
                      <span>
                        ${(
                          (activeRentOffering.priceAmount * numNights)
                          + (activeRentOffering.securityDepositAmount || 0)
                          + (activeRentOffering.cleaningFeeAmount || 0)
                        ).toLocaleString()} {activeRentOffering.currency || 'USD'}
                      </span>
                    </div>
                  </div>
                )}

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : hasResponsible ? (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = startDate && endDate 
                        ? (language === 'es' 
                            ? `Hola, me interesa rentar tu propiedad temporalmente del ${startDate} al ${endDate}.`
                            : `Hello, I'm interested in renting your property from ${startDate} to ${endDate}.`)
                        : '';
                      setSelectedLeadOffering(activeRentOffering);
                      setLeadMessage(msg);
                      setLeadModalOpen(true);
                    }}
                    className="w-full py-4 rounded-2xl bg-brand-black hover:bg-brand-black/90 text-white text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer mt-2"
                  >
                    <span>{language === 'es' ? 'Reservar estadía' : 'Book stay'}</span>
                  </button>
                ) : null}
              </div>
            )}

            {/* EXPERIENCE 3: MONTHLY_RENT (Airbnb/Wander premium style) */}
            {selectedMode === 'MONTHLY_RENT' && activeRentOffering && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex items-baseline justify-between border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">
                      {activeRentOffering.priceAmount != null
                        ? `${activeRentOffering.currency || 'USD'} $${activeRentOffering.priceAmount.toLocaleString()}`
                        : (language === 'es' ? 'Precio a consultar' : 'Price on request')}
                    </span>
                    <span className="text-xs text-brand-gray-500 font-semibold"> / {language === 'es' ? 'mes' : 'month'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                      {language === 'es' ? 'Renta Larga' : 'Long-Term'}
                    </span>
                  </div>
                </div>

                <RentalTermList items={rentalTermItems} />

                {rentAmountDueAtSigning != null && rentTotalDueAtSigning != null && (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="space-y-3 px-4 py-4 text-xs">
                      <div className="flex justify-between gap-4 text-slate-500">
                        <span>
                          {rentMonthsDueAtSigning === 1
                            ? (language === 'es' ? 'Primer mes de renta' : 'First month rent')
                            : `${rentMonthsDueAtSigning} ${language === 'es' ? 'meses de renta por adelantado' : 'months of rent in advance'}`}
                        </span>
                        <span className="font-bold text-slate-950">{formatRentalMoney(rentAmountDueAtSigning, rentCurrency)}</span>
                      </div>
                      {rentSecurityDeposit != null && (
                        <div className="flex justify-between gap-4 text-slate-500">
                          <span>{language === 'es' ? 'Depósito de garantía' : 'Security deposit'}</span>
                          <span className="font-bold text-slate-950">{formatRentalMoney(rentSecurityDeposit, rentCurrency)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-4 bg-slate-950 px-4 py-4 text-white">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/55">
                          {language === 'es' ? 'Pago inicial estimado' : 'Estimated initial payment'}
                        </p>
                        <p className="mt-1 text-xs font-bold">
                          {language === 'es' ? 'Total debido al firmar' : 'Total due at signing'}
                        </p>
                      </div>
                      <span className="text-lg font-black tracking-tight">{formatRentalMoney(rentTotalDueAtSigning, rentCurrency)}</span>
                    </div>
                  </div>
                )}

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : hasResponsible ? (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = language === 'es' 
                        ? `Hola, me interesa rentar tu propiedad por base mensual. Quisiera más información sobre los términos del contrato.`
                        : `Hello, I'm interested in renting your property on a monthly basis. I'd like more information about the contract terms.`;
                      setSelectedLeadOffering(activeRentOffering);
                      setLeadMessage(msg);
                      setLeadModalOpen(true);
                    }}
                    className="w-full py-4 rounded-2xl bg-brand-black hover:bg-brand-black/90 text-white text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer mt-2"
                  >
                    <span>{language === 'es' ? 'Solicitar arrendamiento' : 'Apply for lease'}</span>
                  </button>
                ) : null}
              </div>
            )}

            {/* EXPERIENCE 4: SALE (Sotheby's / Pacaso luxury style) */}
            {selectedMode === 'SALE' && activeSaleOffering && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="mb-1 border-b border-neutral-200/70 pb-5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-neutral-950 bg-neutral-950 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,0.8)]">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {language === 'es' ? 'Propiedad en venta' : 'Property for sale'}
                  </span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-[-0.045em] text-brand-black">
                      {activeSaleOffering.priceAmount != null
                        ? `${activeSaleOffering.currency || 'USD'} $${activeSaleOffering.priceAmount.toLocaleString()}`
                        : (language === 'es' ? 'Precio a consultar' : 'Price on request')}
                    </span>
                  </div>

                  {/* Historial de Precios (Zillow-like) */}
                  {property.priceHistory && (
                    <div className="mt-2 p-3 bg-brand-gray-50 rounded-2xl border border-brand-gray-200/50 flex flex-col gap-1.5 text-xs font-semibold">
                      <div className="flex justify-between items-center text-[10px] text-brand-gray-400 font-black uppercase tracking-wider">
                        <span>{language === 'es' ? 'Historial de Precios' : 'Price History'}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          property.priceHistory.trend === 'DOWN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          property.priceHistory.trend === 'UP' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-brand-gray-100 text-brand-gray-500'
                        }`}>
                          {property.priceHistory.trend === 'DOWN' ? (language === 'es' ? 'Bajó ↓' : 'Dropped ↓') :
                           property.priceHistory.trend === 'UP' ? (language === 'es' ? 'Subió ↑' : 'Increased ↑') :
                           (language === 'es' ? 'Estable' : 'Stable')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-brand-gray-550 text-[11px] mt-0.5">
                        <span>{language === 'es' ? 'Precio Inicial:' : 'Original Price:'}</span>
                        <span className="text-brand-black line-through">${property.priceHistory.initialPrice.toLocaleString()} MXN</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span>{language === 'es' ? 'Último Cambio:' : 'Last Modified:'}</span>
                        <span className="text-brand-black font-bold">
                          {property.priceHistory.lastModificationDate}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-brand-gray-500">
                    {language === 'es'
                      ? 'Publicación comercial. La disponibilidad, titularidad y documentación deben confirmarse antes de cualquier operación.'
                      : 'Commercial listing. Availability, ownership, and documentation must be confirmed before any transaction.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-[22px] border border-neutral-200/80 bg-neutral-50/45 p-4 text-xs font-semibold leading-relaxed text-brand-gray-600">
                  <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-brand-black">
                    <PropertySubIcon icon={ShieldCheck} className="h-9 w-9 rounded-xl" iconClassName="h-4 w-4" />
                    <span>{language === 'es' ? 'Alcance de la publicación' : 'Listing scope'}</span>
                  </div>
                  <p className="text-[10px] text-brand-gray-500 leading-normal font-medium">
                    {language === 'es'
                      ? 'Towers México facilita el contacto y la gestión del interés. Este anuncio no incluye ni garantiza servicios de escrow, notaría, crédito o cierre.'
                      : 'Towers México facilitates contact and inquiry management. This listing does not include or guarantee escrow, notary, lending, or closing services.'}
                  </p>
                  <div className="my-1 border-t border-neutral-200/70" />
                  <div className="flex justify-between items-center text-[10px]">
                    <span>{language === 'es' ? 'Acepta ofertas de compra:' : 'Accepts buying offers:'}</span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black">
                      {activeSaleOffering.acceptsOffers === true
                        ? (language === 'es' ? 'DECLARADO: SÍ' : 'DECLARED: YES')
                        : activeSaleOffering.acceptsOffers === false
                          ? (language === 'es' ? 'DECLARADO: NO' : 'DECLARED: NO')
                          : (language === 'es' ? 'SIN CONFIRMAR' : 'UNCONFIRMED')}
                    </span>
                  </div>
                </div>

                {/* Simulación orientativa disponible sólo cuando existe un precio publicado. */}
                {activeSaleOffering.priceAmount != null && (
                <details className="group overflow-hidden rounded-[22px] border border-neutral-200/80 bg-white">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-brand-black transition-colors hover:bg-neutral-50/70 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-3 text-[9px] font-black uppercase tracking-[0.1em] text-neutral-700">
                      <PropertySubIcon icon={BarChart2} className="h-9 w-9 rounded-xl" iconClassName="h-4 w-4" />
                      <span className="leading-snug">{language === 'es' ? 'Simulador hipotecario' : 'Mortgage simulator'}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-3.5 border-t border-neutral-200/70 bg-neutral-50/35 px-4 pb-4 pt-4">

                  {/* Down payment percentage selector */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-brand-gray-500">
                      <span>{language === 'es' ? 'Enganche:' : 'Down payment:'}</span>
                      <span className="text-brand-black">{downPaymentPct}% (${Math.round(activeSaleOffering.priceAmount * (downPaymentPct / 100)).toLocaleString()} {activeSaleOffering.currency || 'USD'})</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={10}
                      value={downPaymentPct}
                      onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                      className="w-full accent-brand-accent h-1 bg-brand-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-brand-gray-400 font-semibold px-0.5">
                      <span>20%</span>
                      <span>40%</span>
                      <span>60%</span>
                      <span>80%</span>
                    </div>
                  </div>

                  {/* Plazo selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-brand-gray-500">{language === 'es' ? 'Plazo del Crédito:' : 'Loan Term:'}</span>
                    <div className="flex gap-1.5 bg-brand-gray-200/40 p-0.5 rounded-xl border border-brand-gray-200/60">
                      {[10, 15, 20].map((years) => (
                        <button
                          key={years}
                          type="button"
                          onClick={() => setFinancingTermYears(years)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${financingTermYears === years ? 'bg-white text-brand-black shadow-xs' : 'text-brand-gray-500 hover:text-brand-black'}`}
                        >
                          {years} {language === 'es' ? 'años' : 'years'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculator Payment display */}
                  {(() => {
                    const price = activeSaleOffering.priceAmount;
                    const mortgage = calculateMortgage(price, {
                      downPaymentPercent: downPaymentPct,
                      years: financingTermYears,
                      annualRatePercent: mortgageAnnualRatePct,
                    });

                    if (!mortgage) return null;

                    return (
                      <div className="bg-brand-accent/5 p-3 rounded-2xl border border-brand-accent/20 flex flex-col gap-1 text-center">
                        <span className="text-[9px] font-black uppercase text-brand-accent tracking-wider">
                          {language === 'es' ? 'Mensualidad Estimada' : 'Estimated Monthly Payment'}
                        </span>
                        <span className="text-xl font-black text-brand-black">
                          ${Math.round(mortgage.monthlyPayment).toLocaleString()} {activeSaleOffering.currency || 'USD'}
                        </span>
                        <span className="text-[9px] text-brand-gray-500 font-semibold">
                          {language === 'es'
                            ? `Escenario editable: ${100 - downPaymentPct}% financiado a ${mortgageAnnualRatePct}%. No es una oferta de crédito.`
                            : `Editable scenario: ${100 - downPaymentPct}% financed at ${mortgageAnnualRatePct}%. This is not a loan offer.`}
                        </span>
                      </div>
                    );
                  })()}
                  </div>
                </details>
                )}

                {isSelfProperty ? (
                  <div className="mt-2 rounded-[18px] border border-neutral-200/80 bg-neutral-50/60 p-4 text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : hasResponsible ? (
                  <div className="flex flex-col gap-2.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const msg = language === 'es' 
                          ? `Hola, estoy interesado en adquirir esta propiedad. Me gustaría recibir los documentos del listado y programar una llamada de información.`
                          : `Hello, I'm interested in buying this property. I'd like to receive the listing documents and schedule an informational call.`;
                        setSelectedLeadOffering(activeSaleOffering);
                        setLeadMessage(msg);
                        setLeadModalOpen(true);
                      }}
                      className="w-full py-3.5 rounded-2xl bg-brand-black hover:bg-brand-black/90 text-white text-xs font-black tracking-wider uppercase transition-all duration-200 hover:scale-[1.01] active:scale-95 shadow-md cursor-pointer"
                    >
                      {language === 'es' ? 'Contactar Asesor / Comprar' : 'Contact Advisor / Purchase'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const msg = language === 'es' 
                          ? `Hola, me gustaría agendar una visita virtual o presencial para conocer los detalles físicos de la propiedad en venta.`
                          : `Hello, I'd like to schedule a virtual or in-person tour to view the property's physical details.`;
                        setSelectedLeadOffering(activeSaleOffering);
                        setLeadMessage(msg);
                        setLeadModalOpen(true);
                      }}
                      className="w-full py-3 rounded-2xl border border-amber-500/50 hover:bg-amber-500/5 text-amber-700 text-xs font-extrabold transition-all duration-200 cursor-pointer"
                    >
                      {language === 'es' ? 'Solicitar Visita / Tour Privado' : 'Request Tour / Private View'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

          </div>
        </div>
      </div>



      {/* 4. Elegant Interactive Swap Request Modal Sheet */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div
              className="absolute inset-0 bg-brand-black/45 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-xl bg-white rounded-3xl p-6 shadow-floating border border-brand-gray-200/60 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleRequestSubmit}>
                <div className="flex flex-col gap-6">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-brand-gray-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-brand-black">{t('details.modalTitle')}</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">{t('details.modalSubtitle', { location: property.location })}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)}
                      className="text-xs text-brand-gray-500 hover:text-brand-black font-semibold cursor-pointer"
                    >
                      {t('details.cancel')}
                    </button>
                  </div>

                  {/* Property Selector Grid */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">{t('details.selectPropLabel')}</label>
                    
                    {myProperties.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {myProperties.map((myProp) => {
                          const isSelected = selectedMyPropId === myProp.id;
                          const imageUrl = myProp.images[0];
                          const thumbnailUrl = !imageUrl
                            ? null
                            : myProp.metadata?.imagesMetadata?.[imageUrl]?.thumbnailUrl
                              || (imageUrl.includes('property-images/') && !imageUrl.includes('-thumb.webp') && imageUrl.endsWith('.webp')
                                ? imageUrl.replace(/\.webp$/, '-thumb.webp')
                                : imageUrl);
                          return (
                            <button
                              key={myProp.id}
                              type="button"
                              onClick={() => setSelectedMyPropId(myProp.id)}
                              className={`p-3 rounded-2xl border text-left flex gap-3 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent shadow-sm'
                                  : 'border-brand-gray-200 hover:border-brand-black bg-white'
                              }`}
                            >
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-brand-gray-100">
                                {thumbnailUrl && (
                                  <Image
                                    src={thumbnailUrl}
                                    alt={myProp.title}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    unoptimized
                                  />
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-brand-black truncate">{myProp.title}</p>
                                <p className="text-[10px] text-brand-gray-500 truncate mt-0.5">{myProp.location}</p>
                                <p className="text-[9px] text-brand-accent font-bold mt-1 uppercase tracking-wider">{myProp.type}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center p-4 bg-brand-gray-50 border border-dashed border-brand-gray-200 rounded-2xl text-xs text-brand-gray-500 font-semibold">
                        {t('details.noPropListed')}
                      </div>
                    )}
                  </div>

                  {/* Selected Dates Display (Reused from property sheet) */}
                  <div className="flex flex-col gap-2 animate-in fade-in">
                    <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">
                      {language === 'es' ? 'Fechas Seleccionadas' : 'Selected Dates'}
                    </label>
                    <div className="bg-brand-gray-50 p-4 rounded-2xl border border-brand-gray-200/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-brand-accent shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider block leading-none mb-1">
                            {language === 'es' ? 'Fechas del intercambio' : 'Exchange Dates'}
                          </span>
                          <span className="text-xs font-extrabold text-brand-black">
                            {startDate} {language === 'es' ? 'al' : 'to'} {endDate}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/40 px-2 py-0.5 rounded-md">
                        {language === 'es' ? 'Fechas Fijas' : 'Fixed Dates'}
                      </span>
                    </div>
                  </div>

                  {hasOverlap && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2 mt-1">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{t('details.datesOverlapWarning')}</span>
                    </div>
                  )}

                  {/* Personalized Message */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">{t('details.writeNote', { host: property.hostName })}</label>
                    <textarea
                      placeholder={t('details.writeNotePlaceholder', { host: property.hostName })}
                      value={swapMessage}
                      onChange={(e) => setSwapMessage(e.target.value)}
                      required
                      className="w-full h-24 p-3.5 bg-brand-gray-50 border border-brand-gray-200 rounded-xl text-xs font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed text-brand-black"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-between border-t border-brand-gray-100 pt-4 mt-2">
                    <span className="text-[10px] text-brand-gray-500">{t('details.serviceFee')}: 29 €</span>
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedMyPropId || !swapMessage.trim() || hasOverlap}
                      className={`px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                        isSubmitting || !selectedMyPropId || !swapMessage.trim() || hasOverlap
                          ? 'bg-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                          : 'bg-brand-accent hover:bg-brand-accent/90 active:scale-95'
                      }`}
                    >
                      {isSubmitting ? t('details.sendingRequestBtn') : t('details.sendRequestBtn')}
                    </button>
                  </div>

                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Lead capture modal for rent and sale offerings */}
      <AnimatePresence>
        {leadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0"
              onClick={() => setLeadModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.94, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 18 }}
              className="relative z-10 w-full max-w-md bg-white rounded-3xl p-7 shadow-floating border border-brand-gray-200/60"
            >
              <form onSubmit={handleLeadSubmit} className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                    {leadContactPreference === 'call'
                      ? <PhoneCall className="w-6 h-6" />
                      : <MessageSquareCode className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-brand-black leading-tight">
                      {leadContactPreference === 'call'
                        ? (language === 'es' ? 'Solicitar una llamada' : 'Request a call')
                        : selectedLeadOffering?.mode === 'SALE'
                        ? (language === 'es' ? 'Solicitar información' : 'Request information')
                        : (language === 'es' ? 'Consultar disponibilidad' : 'Check availability')}
                    </h3>
                    <p className="text-xs text-brand-gray-500 leading-relaxed font-semibold mt-1">
                      {leadContactPreference === 'call'
                        ? (language === 'es'
                            ? 'Eterna preparó tu solicitud. Puedes ajustarla antes de pedir que el responsable comercial te llame.'
                            : 'Eterna prepared your request. You can edit it before asking the advisor to call you.')
                        : (language === 'es'
                            ? 'Eterna preparó un mensaje con tu interés. Revísalo y envíalo al responsable de la propiedad.'
                            : 'Eterna prepared a message based on your interest. Review it and send it to the property advisor.')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400">
                    {language === 'es' ? 'Mensaje' : 'Message'}
                  </label>
                  <textarea
                    value={leadMessage}
                    onChange={(e) => setLeadMessage(e.target.value)}
                    required
                    placeholder={
                      selectedLeadOffering?.mode === 'SALE'
                        ? (language === 'es' ? 'Hola, me gustaría recibir más información sobre esta propiedad.' : 'Hi, I would like to receive more information about this property.')
                        : (language === 'es' ? 'Hola, me gustaría consultar disponibilidad para esta propiedad.' : 'Hi, I would like to check availability for this property.')
                    }
                    className="w-full h-28 p-3.5 bg-brand-gray-50 border border-brand-gray-200 rounded-2xl text-sm font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed text-brand-black"
                  />
                </div>

                {leadError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-600">
                    {leadError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setLeadModalOpen(false)}
                    className="sm:w-1/3 py-3 border border-brand-gray-200 hover:border-brand-black text-brand-black rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLead || !leadMessage.trim()}
                    className={`sm:flex-1 py-3 rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                      isSubmittingLead || !leadMessage.trim()
                        ? 'bg-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                        : 'bg-brand-black hover:bg-brand-gray-800 text-white'
                    }`}
                  >
                    {isSubmittingLead
                      ? (language === 'es' ? 'Enviando...' : 'Sending...')
                      : leadContactPreference === 'call'
                        ? (language === 'es' ? 'Solicitar llamada' : 'Request call')
                        : (language === 'es' ? 'Enviar mensaje' : 'Send message')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Lead confirmation modal */}
      <AnimatePresence>
        {leadSuccessOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-black/55 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0"
              onClick={() => setLeadSuccessOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 24 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-8 shadow-floating border border-brand-gray-200/50 text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-extrabold text-brand-black mb-2">
                {leadContactPreference === 'call'
                  ? (language === 'es' ? 'Llamada solicitada' : 'Call requested')
                  : (language === 'es' ? 'Mensaje enviado' : 'Message sent')}
              </h3>
              <p className="text-xs text-brand-gray-500 leading-relaxed mb-6 font-semibold">
                {leadContactPreference === 'call'
                  ? (language === 'es'
                      ? 'Tu solicitud quedó registrada. El responsable podrá revisar tu interés y ponerse en contacto contigo.'
                      : 'Your request was registered. The advisor can review your interest and contact you.')
                  : (language === 'es'
                      ? 'Tu interés quedó registrado. El responsable podrá revisar el mensaje desde su panel de leads.'
                      : 'Your interest was registered. The advisor can review the message from their leads panel.')}
              </p>

              <button
                onClick={() => setLeadSuccessOpen(false)}
                className="w-full py-3 bg-brand-black hover:bg-brand-gray-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                {language === 'es' ? 'Entendido' : 'Got it'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eterna location experience: map and nearby places without losing page context. */}
      <PropertyLocationModal
        controller={locationModal}
        property={property}
        places={nearby.data?.places}
        loading={nearby.loading}
        error={nearby.error}
        language={language}
      />
      {/* Premium Lightbox Gallery Modal */}
      <PropertyGalleryModal controller={gallery} language={language} property={property} />
      {/* 7. Success Dialog Popup */}
      <AnimatePresence>
        {successOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-black/55 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-floating border border-brand-gray-200/50 text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-6">
                <MessageSquareCode className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-extrabold text-brand-black mb-2">{t('details.successTitle')}</h3>
              
              <p className="text-xs text-brand-gray-500 leading-relaxed mb-6">
                {t('details.successDesc', { host: property.hostName })}
              </p>

              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => {
                    setSuccessOpen(false);
                    router.push('/messages');
                  }}
                  className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  {t('details.goChatBtn')}
                </button>
                <button
                  onClick={() => {
                    setSuccessOpen(false);
                    router.push('/dashboard');
                  }}
                  className="w-full py-3 border border-brand-gray-200 hover:border-brand-black text-brand-black rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {t('details.goDashBtn')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
