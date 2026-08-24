/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Sparkles, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PropertyOffering, PropertyOfferingMode } from '@/lib/types';
import { useTranslation } from '@/lib/context/LanguageContext';
import { getVirtualTourProvider } from '@/lib/mediaEmbeds';
import { PropertyValidator } from '@/lib/services/PropertyValidator';
import { useSwap } from '@/lib/context/SwapContext';
import type { GoogleAddressResult } from '@/lib/maps/types';
import styles from './PropertyWizardModal.module.css';
import {
  normalizeForMatch,
  type PropertyListingImportResult,
} from '@/lib/propertyImport/propertyListingImport';
import { AMENITY_OPTIONS } from '@/lib/propertyFeatures';
import {
  readPropertyWizardDraft,
  removePropertyWizardDraft,
  savePropertyWizardDraft,
} from '@/lib/propertyWizardDraft';
import { WIZARD_STEP_COPY } from '../property-wizard/constants';
import { WizardPreviewPanel } from '../property-wizard/components/WizardPreviewPanel';
import { WizardScrollControls } from '../property-wizard/components/WizardScrollControls';
import { AmenitiesStep } from '../property-wizard/sections/AmenitiesStep';
import { BasicInfoStep } from '../property-wizard/sections/BasicInfoStep';
import { CommercializationStep } from '../property-wizard/sections/CommercializationStep';
import { CommercialSchemeStep } from '../property-wizard/sections/CommercialSchemeStep';
import { LocationStep } from '../property-wizard/sections/LocationStep';
import { MediaStep } from '../property-wizard/sections/MediaStep';
import { OwnerContactStep } from '../property-wizard/sections/OwnerContactStep';
import { PublisherIdentityStep } from '../property-wizard/sections/PublisherIdentityStep';
import { RentalTermsStep } from '../property-wizard/sections/RentalTermsStep';
import { ReviewStep } from '../property-wizard/sections/ReviewStep';
import { SaleLegalStep } from '../property-wizard/sections/SaleLegalStep';
import { SwapPreferencesStep } from '../property-wizard/sections/SwapPreferencesStep';
import { TechnicalSpecsStep } from '../property-wizard/sections/TechnicalSpecsStep';
import type {
  DBType,
  PropertyWizardModalProps,
  RentalCommissionModel,
  RentalFurnishingStatus,
  UIType,
  WizardPublisherType,
  WizardServerError,
  WizardStep,
} from '../property-wizard/types';
import {
  getListingQuality,
  getPreviewPriceLabel,
  getWizardSteps,
  mapDbToUiType,
  mapPublisherType,
  mapUiToDbType,
  showWizardToast as showToast,
  trackWizardMetric as trackMetric,
} from '../property-wizard/utils';

export default function PropertyWizardModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  onDelete,
  publisherRepresentativeType,
}: PropertyWizardModalProps) {
  const { t, language } = useTranslation();
  const { currentUser } = useSwap();
  const normalizedRole = String(currentUser?.role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const canCaptureOwnerContact = normalizedRole === 'ADMIN' || normalizedRole === 'INTERNAL_ADVISOR';
  const [step, setStep] = useState<WizardStep>(publisherRepresentativeType ? 1 : 0);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const [localDeleteConfirm, setLocalDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [, setIsSubmitting] = useState(false);
  const [supabaseError, setSupabaseError] = useState<WizardServerError | null>(null);


  // Swap limits
  const [swapMinValue, setSwapMinValue] = useState<number | ''>('');
  const [swapMaxValue, setSwapMaxValue] = useState<number | ''>('');

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // STEP 0: Publisher Type
  const [publisherType, setPublisherType] = useState<WizardPublisherType>(
    mapPublisherType(publisherRepresentativeType),
  );

  // STEP 1: Offerings Selection
  const [selectedModes, setSelectedModes] = useState<PropertyOfferingMode[]>(['SALE']);
  const [activeConfigTab, setActiveConfigTab] = useState<PropertyOfferingMode>('SALE');

  useEffect(() => {
    if (selectedModes.length > 0 && !selectedModes.includes(activeConfigTab)) {
      setActiveConfigTab(selectedModes[0]);
    }
  }, [selectedModes, activeConfigTab]);

  useEffect(() => {
    if (isOpen) {
      let currentMode: PropertyOfferingMode | null = null;
      if (step === 6) currentMode = 'SWAP';
      else if (step === 7) currentMode = 'MONTHLY_RENT';
      else if (step === 8) currentMode = 'SALE';
      else if (selectedModes.length > 0) currentMode = selectedModes[0];

      window.dispatchEvent(new CustomEvent('auraswap:wizard-step', {
        detail: {
          isOpen: true,
          step,
          mode: currentMode,
          isEditing: !!initialData,
          propertyTitle: initialData?.title || null
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('auraswap:wizard-step', {
        detail: {
          isOpen: false,
          step: null,
          mode: null,
          isEditing: false,
          propertyTitle: null
        }
      }));
    }

    return () => {
      window.dispatchEvent(new CustomEvent('auraswap:wizard-step', {
        detail: {
          isOpen: false,
          step: null,
          mode: null,
          isEditing: false,
          propertyTitle: null
        }
      }));
    };
  }, [isOpen, step, activeConfigTab, selectedModes, initialData]);

  // STEP 1: Basic Info (New fields)
  const [title, setTitle] = useState('');
  const [subtitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<UIType>('Departamento');
  const [developmentName, setDevelopmentName] = useState('');

  // STEP 2: Location
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [stateName, setStateName] = useState<string | null>(null);
  const [geometrySource, setGeometrySource] = useState<'google_places' | 'google_geocoding' | 'manual' | 'legacy' | null>(null);
  const [addressEntryMode, setAddressEntryMode] = useState<'google' | 'manual'>('google');
  
  // Location Details
  const [neighborhood, setNeighborhood] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [locationReference, setLocationReference] = useState('');
  const [showPublicAddress, setShowPublicAddress] = useState(false);

  // Optional, private operational contact. Persisted outside the public
  // property payload and only collected from staff accounts.
  const [ownerRelationship, setOwnerRelationship] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerContactPreference, setOwnerContactPreference] = useState('');
  const [ownerViewingDays, setOwnerViewingDays] = useState<string[]>([]);
  const [ownerViewingStartTime, setOwnerViewingStartTime] = useState('');
  const [ownerViewingEndTime, setOwnerViewingEndTime] = useState('');
  const [ownerHasKeys, setOwnerHasKeys] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [ownerOccupancyStatus, setOwnerOccupancyStatus] = useState('');
  const [ownerAppointmentNoticeHours, setOwnerAppointmentNoticeHours] = useState<number | ''>('');
  const [ownerVisitInstructions, setOwnerVisitInstructions] = useState('');
  const [ownerExtraNotes, setOwnerExtraNotes] = useState('');

  // STEP 4: Specs & Features
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [halfBathrooms, setHalfBathrooms] = useState(0);
  const [parkingSpaces, setParkingSpaces] = useState(0);
  const [levelsCount, setLevelsCount] = useState(1);
  const [maxGuests, setMaxGuests] = useState(4);
  const [constructionAge, setConstructionAge] = useState<number | ''>('');
  const [conservationState, setConservationState] = useState('Excellent');
  const [constructionType, setConstructionType] = useState('Modern');

  // Surfaces
  const [surfaceTotal, setSurfaceTotal] = useState<number | ''>('');
  const [surfaceBuilt, setSurfaceBuilt] = useState<number | ''>('');
  const [surfaceFront, setSurfaceFront] = useState<number | ''>('');
  const [surfaceDepth, setSurfaceDepth] = useState<number | ''>('');
  const [surfaceGarden, setSurfaceGarden] = useState(0);
  const [surfaceTerrace, setSurfaceTerrace] = useState(0);
  const [surfaceRoofGarden, setSurfaceRoofGarden] = useState(0);
  const [surfacePatio, setSurfacePatio] = useState(0);

  // STEP 5: Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [newCustomAmenity, setNewCustomAmenity] = useState('');

  // STEP 6: Legal Info
  const [legalDebtFree, setLegalDebtFree] = useState<boolean | null>(null);
  const [legalPublicDeed, setLegalPublicDeed] = useState<boolean | null>(null);
  const [legalTaxCurrent, setLegalTaxCurrent] = useState<boolean | null>(null);
  const [legalServicesPaid, setLegalServicesPaid] = useState<boolean | null>(null);
  const [legalOwnerType, setLegalOwnerType] = useState('Privada');
  const [legalIsMortgaged, setLegalIsMortgaged] = useState<boolean | null>(null);

  // Expanded Legal & Appraisal & Commercial fields
  const [legalLienType, setLegalLienType] = useState<string>('');
  const [legalLienObservations, setLegalLienObservations] = useState<string>('');
  const [legalRegime, setLegalRegime] = useState<string>('');
  const [legalLandUse, setLegalLandUse] = useState<string>('');
  const [legalRestrictions, setLegalRestrictions] = useState<string>('');
  const [legalDocumentationComplete, setLegalDocumentationComplete] = useState<boolean | null>(null);
  const [legalJuridicalResponsible, setLegalJuridicalResponsible] = useState<string>('');
  const [legalLastUpdate, setLegalLastUpdate] = useState<string>('');

  const [appraisalAmount, setAppraisalAmount] = useState<number | ''>('');
  const [appraisalDate, setAppraisalDate] = useState<string>('');
  const [appraisalExpert, setAppraisalExpert] = useState<string>('');
  const [appraisalValidity, setAppraisalValidity] = useState<string>('');

  const [appreciationLevel, setAppreciationLevel] = useState<'Alta' | 'Media' | 'Baja' | 'En desarrollo' | ''>('');
  const [commercialStatus, setCommercialStatus] = useState<string>('');

  // Operation specific new fields - VENTA
  const [valuationAmount, setValuationAmount] = useState<number | ''>('');
  const [catastralValue, setCatastralValue] = useState<number | ''>('');
  const [condoRegime, setCondoRegime] = useState(false);
  const [maintenanceFee, setMaintenanceFee] = useState<number | ''>('');

  // Operation specific new fields - RENTA
  const [advanceMonths, setAdvanceMonths] = useState<number>(1);
  const [requiresGuarantor, setRequiresGuarantor] = useState(false);
  const [requiresLegalPolicy, setRequiresLegalPolicy] = useState(false);
  const [acceptsPets, setAcceptsPets] = useState(false);
  const [rentalFurnishingStatus, setRentalFurnishingStatus] = useState<RentalFurnishingStatus>('UNFURNISHED');
  const [includesWater, setIncludesWater] = useState(false);
  const [includesElectricity, setIncludesElectricity] = useState(false);
  const [includesInternet, setIncludesInternet] = useState(false);
  const [includesMaintenance, setIncludesMaintenance] = useState(false);
  const [rentRules, setRentRules] = useState('');

  // Operation specific new fields - SWAP
  const [swapMaxCashDiff, setSwapMaxCashDiff] = useState<number | ''>('');
  const [swapAcceptsVehicle, setSwapAcceptsVehicle] = useState(false);
  const [swapAcceptsLand, setSwapAcceptsLand] = useState(false);
  const [swapAcceptsDept, setSwapAcceptsDept] = useState(false);
  const [swapAcceptsHouse, setSwapAcceptsHouse] = useState(false);
  const [swapAcceptsCash, setSwapAcceptsCash] = useState(false);
  const [swapPriority, setSwapPriority] = useState<'Alta' | 'Media' | 'Baja'>('Media');

  // STEP 7: Media & Gallery
  const [images, setImages] = useState<string[]>([]);
  const [imagesMetadata, setImagesMetadata] = useState<Record<string, any>>({});
  const [videoPlaceholder, setVideoPlaceholder] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [virtualTourPlaceholder, setVirtualTourPlaceholder] = useState('');

  // STEP 8: Commercial & SEO
  const [isExclusive, setIsExclusive] = useState(false);
  const [commissionTotalPct, setCommissionTotalPct] = useState<number | ''>('');
  const [commissionSharedPct, setCommissionSharedPct] = useState<number | ''>('');
  const [rentalCommissionModel, setRentalCommissionModel] = useState<RentalCommissionModel>('ONE_MONTH_RENT');
  const [metaTitle] = useState('');
  const [metaDescription] = useState('');

  // STEP 3: Dynamic Pricing Settings
  // Swap settings
  const [swapValueTier, setSwapValueTier] = useState<'Premium' | 'Luxury' | 'Exclusive' | 'Curated'>('Premium');
  const [swapAvailableStart, setSwapAvailableStart] = useState('');
  const [swapAvailableEnd, setSwapAvailableEnd] = useState('');
  const [swapPreferences, setSwapPreferences] = useState('');

  // Short rent settings
  const [nightlyPrice, setNightlyPrice] = useState(0);
  const [weeklyPrice, setWeeklyPrice] = useState(0);
  const [shortMinNights, setShortMinNights] = useState(2);
  const [shortDeposit, setShortDeposit] = useState(0);

  // Monthly rent settings
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [monthlyDeposit, setMonthlyDeposit] = useState(0);
  const [monthlyCurrency, setMonthlyCurrency] = useState<'MXN' | 'USD'>('MXN');
  const [monthlyMinMonths, setMonthlyMinMonths] = useState(12);
  const [monthlyAvailableFrom, setMonthlyAvailableFrom] = useState('');
  const [monthlyContract, setMonthlyContract] = useState(false);

  // Sale settings
  const [salePrice, setSalePrice] = useState(0);
  const [saleCurrency, setSaleCurrency] = useState('MXN');
  const [saleAcceptsOffers, setSaleAcceptsOffers] = useState(false);
  const [acceptsBankCredit, setAcceptsBankCredit] = useState(false);
  const [acceptsInfonavit, setAcceptsInfonavit] = useState(false);
  const [acceptsFovissste, setAcceptsFovissste] = useState(false);
  const [acceptsCash, setAcceptsCash] = useState(false);
  const [developerFinancing, setDeveloperFinancing] = useState(false);

  // Optional quick import from an existing WhatsApp/Facebook/listing text.
  const [listingSourceText, setListingSourceText] = useState('');
  const [isImportingListing, setIsImportingListing] = useState(false);
  const [listingImportError, setListingImportError] = useState('');
  const [listingImportSummary, setListingImportSummary] = useState<string[]>([]);
  const [listingImportProvider, setListingImportProvider] = useState('');
  const [isImportPanelExpanded, setIsImportPanelExpanded] = useState(true);

  const applyImportedListing = (result: PropertyListingImportResult) => {
    if (result.title) setTitle(result.title);
    if (result.shortDescription) {
      setShortDescription(result.shortDescription);
      setDescription(result.shortDescription);
    }
    if (result.propertyType !== 'Desconocido') setType(result.propertyType);
    if (result.developmentName) setDevelopmentName(result.developmentName);

    if (result.operation !== 'UNKNOWN') {
      const importedMode = result.operation === 'SHORT_RENT'
        ? 'MONTHLY_RENT'
        : result.operation;
      setSelectedModes([importedMode]);
      setActiveConfigTab(importedMode);
    }

    if (result.priceAmount > 0) {
      if (result.operation === 'MONTHLY_RENT' || result.operation === 'SHORT_RENT') {
        setMonthlyPrice(result.priceAmount);
      } else {
        setSalePrice(result.priceAmount);
      }
    }
    if (result.currency !== 'UNKNOWN') setSaleCurrency(result.currency);

    if (result.bedrooms > 0) setBedrooms(result.bedrooms);
    if (result.fullBathrooms > 0) setBathrooms(result.fullBathrooms);
    if (result.halfBathrooms > 0) setHalfBathrooms(result.halfBathrooms);
    if (result.levels > 0) setLevelsCount(result.levels);
    if (result.parkingSpaces > 0) setParkingSpaces(result.parkingSpaces);
    if (result.surfaceTotal > 0) setSurfaceTotal(result.surfaceTotal);
    if (result.surfaceBuilt > 0) setSurfaceBuilt(result.surfaceBuilt);
    if (result.surfaceFront > 0) setSurfaceFront(result.surfaceFront);
    if (result.surfaceDepth > 0) setSurfaceDepth(result.surfaceDepth);

    if (result.city) {
      setCity(result.city);
      setLocation(result.city);
    }
    if (result.state) setStateName(result.state);
    if (result.country) setCountry(result.country);
    if (result.neighborhood) setNeighborhood(result.neighborhood);
    if (result.addressHint) setLocationReference(result.addressHint);

    if (result.financingMentioned) {
      setAcceptsBankCredit(result.financing.bankCredit);
      setAcceptsInfonavit(result.financing.infonavit);
      setAcceptsFovissste(result.financing.fovissste);
      setAcceptsCash(result.financing.cash);
      setDeveloperFinancing(result.financing.developer);
    }

    const amenityByNormalizedName = new Map(
      AMENITY_OPTIONS.map((amenity) => [normalizeForMatch(amenity), amenity]),
    );
    const importedPreset: string[] = [];
    const importedCustom: string[] = [];
    [...result.presetAmenities, ...result.customAmenities].forEach((amenity) => {
      const canonical = amenityByNormalizedName.get(normalizeForMatch(amenity));
      if (canonical) {
        if (!importedPreset.includes(canonical)) importedPreset.push(canonical);
        return;
      }
      if (
        amenity
        && !importedCustom.some((item) => normalizeForMatch(item) === normalizeForMatch(amenity))
      ) {
        importedCustom.push(amenity);
      }
    });
    setSelectedAmenities((previous) => Array.from(new Set([...previous, ...importedPreset])));
    setCustomAmenities((previous) => {
      const next = [...previous];
      importedCustom.forEach((amenity) => {
        if (!next.some((item) => normalizeForMatch(item) === normalizeForMatch(amenity))) {
          next.push(amenity);
        }
      });
      return next;
    });

    const summary = result.detectedFacts.filter((fact) => !/\bprecio\b/i.test(fact));
    if (result.priceAmount > 0) {
      summary.unshift(
        `$${result.priceAmount.toLocaleString('es-MX')} ${result.currency === 'UNKNOWN' ? 'MXN' : result.currency}`,
      );
    }
    if (importedPreset.length + importedCustom.length > 0) {
      summary.push(`${importedPreset.length + importedCustom.length} amenidades`);
    }
    setListingImportSummary(Array.from(new Set(summary)).slice(0, 8));
    setFieldErrors((previous) => ({
      ...previous,
      title: '',
      description: '',
      selectedModes: '',
      salePrice: '',
    }));
  };

  const handleImportListing = async () => {
    const cleanSource = listingSourceText.trim();
    if (cleanSource.length < 20 || isImportingListing) return;

    setIsImportingListing(true);
    setListingImportError('');
    setListingImportSummary([]);
    trackMetric('property_listing_import_started', { characterCount: cleanSource.length });

    try {
      const response = await fetch('/api/property/import-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSource }),
      });
      const payload = await response.json() as {
        result?: PropertyListingImportResult;
        provider?: string;
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || 'No fue posible analizar el anuncio.');
      }

      applyImportedListing(payload.result);
      setListingImportProvider(payload.provider || 'gemini');
      setIsImportPanelExpanded(false);
      trackMetric('property_listing_import_completed', {
        provider: payload.provider || 'gemini',
        detectedFacts: payload.result.detectedFacts.length,
        amenities: payload.result.presetAmenities.length + payload.result.customAmenities.length,
      });
      showToast('Anuncio analizado. Revisa los datos precargados paso a paso.', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'No fue posible analizar el anuncio.';
      setListingImportError(message);
      trackMetric('property_listing_import_failed', { message });
    } finally {
      setIsImportingListing(false);
    }
  };

  // Populate data when editing
  useEffect(() => {
    setLocalDeleteConfirm(false);
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      const loadedUiType = (initialData.metadata?.uiPropertyType as UIType) || mapDbToUiType(initialData.type as DBType);
      setType(loadedUiType);
      const normalizeLocationPart = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const savedLocationParts = (initialData.location || '').split(',').map(part => part.trim()).filter(Boolean);
      const savedCountry = normalizeLocationPart(initialData.country || '');
      const savedCity = initialData.city || savedLocationParts
        .filter(part => !savedCountry || normalizeLocationPart(part) !== savedCountry)
        .pop() || '';
      setLocation(savedCity);
      setCountry(initialData.country || '');
      setAddress(initialData.address || '');
      setShowPublicAddress(initialData.showPublicAddress === true);
      setLatitude(initialData.latitude !== undefined && initialData.latitude !== null ? Number(initialData.latitude) : null);
      setLongitude(initialData.longitude !== undefined && initialData.longitude !== null ? Number(initialData.longitude) : null);
      setPlaceId(initialData.placeId || null);
      setFormattedAddress(initialData.formattedAddress || null);
      setCity(savedCity || null);
      setStateName(initialData.state || null);
      setGeometrySource(initialData.geometrySource || null);
      setAddressEntryMode(initialData.placeId ? 'google' : 'manual');
      setBedrooms(initialData.bedrooms || 2);
      setBathrooms(initialData.bathrooms || 2);
      setHalfBathrooms(Number(initialData.metadata?.halfBathrooms) || 0);
      setMaxGuests(initialData.maxGuests || 4);
      setSelectedAmenities(initialData.amenities || []);
      setCustomAmenities(initialData.metadata?.customAmenities || []);
      setImages(initialData.images || []);
      setImagesMetadata(initialData.metadata?.imagesMetadata || {});
      
      const loadedVideoUrls = [
        ...(initialData.media || []).filter((media) => media.mediaType === 'VIDEO').map((media) => media.url),
        ...(Array.isArray(initialData.metadata?.videoUrls) ? initialData.metadata.videoUrls : []),
        ...(initialData.metadata?.videoUrl ? [initialData.metadata.videoUrl] : []),
      ].filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index).slice(0, 5);
      const loadedYoutubeUrl = initialData.media?.find(m => m.mediaType === 'YOUTUBE' || m.mediaType === 'VIMEO')?.url || initialData.metadata?.videoPlaceholder || '';
      const loadedVirtualTour = initialData.media?.find(m => m.mediaType === 'MATTERPORT' || m.mediaType === 'VIRTUAL_TOUR')?.url || initialData.metadata?.virtualTourPlaceholder || '';

      setVideoUrls(loadedVideoUrls);
      setVideoPlaceholder(loadedYoutubeUrl);
      setVirtualTourPlaceholder(loadedVirtualTour);
      
      const modes = (initialData.offerings || []).map(o => o.mode);
      if (modes.length > 0) {
        setSelectedModes(modes);
        setActiveConfigTab(modes[0]);
      } else {
        setSelectedModes(['SALE']);
        setActiveConfigTab('SALE');
      }

      // Populate Step 5 fields from offerings
      const swapOff = initialData.offerings?.find(o => o.mode === 'SWAP');
      if (swapOff) {
        setSwapValueTier((swapOff.swapValueTier as any) || 'Premium');
        setSwapAvailableStart(swapOff.availableFrom || '');
        setSwapAvailableEnd(swapOff.availableUntil || '');
        setSwapPreferences(typeof swapOff.swapPreferences?.text === 'string' ? swapOff.swapPreferences.text : '');
        setSwapMinValue(swapOff.swapMinValue || '');
        setSwapMaxValue(swapOff.swapMaxValue || '');
      }

      const shortOff = initialData.offerings?.find(o => o.mode === 'SHORT_RENT');
      if (shortOff) {
        setNightlyPrice(shortOff.priceAmount || 0);
        setShortMinNights(shortOff.minNights || 2);
        setShortDeposit(shortOff.securityDepositAmount || 0);
        setWeeklyPrice(Number(shortOff.metadata?.weeklyPrice) || 0);
      }

      const monthlyOff = initialData.offerings?.find(o => o.mode === 'MONTHLY_RENT');
      if (monthlyOff) {
        setMonthlyPrice(monthlyOff.priceAmount || 0);
        setMonthlyDeposit(monthlyOff.securityDepositAmount || 0);
        setMonthlyCurrency(monthlyOff.currency === 'USD' ? 'USD' : 'MXN');
        setMonthlyMinMonths(monthlyOff.minMonths || 12);
        setMonthlyAvailableFrom(monthlyOff.availableFrom || '');
        setMonthlyContract(monthlyOff.metadata?.requiresContract !== false);
        setRentalCommissionModel(
          monthlyOff.metadata?.rentalCommissionModel === 'PERCENTAGE'
            ? 'PERCENTAGE'
            : 'ONE_MONTH_RENT'
        );
      }

      const saleOff = initialData.offerings?.find(o => o.mode === 'SALE');
      if (saleOff) {
        setSalePrice(saleOff.priceAmount || 0);
        setSaleCurrency(saleOff.currency || 'MXN');
        setSaleAcceptsOffers(saleOff.acceptsOffers !== false);
        setAcceptsBankCredit(saleOff.acceptsBankCredit === true);
        setAcceptsInfonavit(saleOff.acceptsInfonavit === true);
        setAcceptsFovissste(saleOff.acceptsFovissste === true);
        setAcceptsCash(saleOff.acceptsCash === true);
        setDeveloperFinancing(saleOff.developerFinancing === true);
      }
      
      // Venta Extra
      setValuationAmount(initialData.metadata?.valuationAmount || '');
      setCatastralValue(initialData.metadata?.catastralValue || '');
      setCondoRegime(!!initialData.metadata?.condoRegime);
      setMaintenanceFee(initialData.metadata?.maintenanceFee || '');

      // Expanded Legal & Appraisal & Commercial fields load
      setLegalLienType(initialData.legalLienType || '');
      setLegalLienObservations(initialData.legalLienObservations || '');
      setLegalRegime(initialData.legalRegime || initialData.legalOwnerType || '');
      setLegalLandUse(initialData.legalLandUse || '');
      setLegalRestrictions(initialData.legalRestrictions || '');
      setLegalDebtFree(initialData.legalDebtFree ?? null);
      setLegalPublicDeed(initialData.legalPublicDeed ?? null);
      setLegalTaxCurrent(initialData.legalTaxCurrent ?? null);
      setLegalServicesPaid(initialData.legalServicesPaid ?? null);
      setLegalIsMortgaged(initialData.legalIsMortgaged ?? null);
      setLegalDocumentationComplete(initialData.legalDocumentationComplete ?? null);
      setLegalJuridicalResponsible(initialData.legalJuridicalResponsible || '');
      setLegalLastUpdate(initialData.legalLastUpdate || '');
      setAppraisalAmount(initialData.appraisalAmount || '');
      setAppraisalDate(initialData.appraisalDate || '');
      setAppraisalExpert(initialData.appraisalExpert || '');
      setAppraisalValidity(initialData.appraisalValidity || '');
      setAppreciationLevel(initialData.appreciationLevel || '');
      setCommercialStatus(initialData.commercialStatus || '');

      // Renta Extra
      setAdvanceMonths(initialData.metadata?.advanceMonths || 1);
      setRequiresGuarantor(!!initialData.metadata?.requiresGuarantor);
      setRequiresLegalPolicy(!!initialData.metadata?.requiresLegalPolicy);
      setAcceptsPets(initialData.metadata?.acceptsPets !== false);
      setRentalFurnishingStatus(
        initialData.metadata?.rentalFurnishingStatus === 'SEMI_FURNISHED'
          ? 'SEMI_FURNISHED'
          : initialData.metadata?.isFurnished === true
            ? 'FURNISHED'
            : 'UNFURNISHED'
      );
      const includedServices = Array.isArray(initialData.metadata?.includedRentalServices)
        ? initialData.metadata.includedRentalServices
        : [];
      const legacyIncludesAllServices = initialData.metadata?.includesServices === true;
      setIncludesWater(legacyIncludesAllServices || includedServices.includes('WATER'));
      setIncludesElectricity(legacyIncludesAllServices || includedServices.includes('ELECTRICITY'));
      setIncludesInternet(legacyIncludesAllServices || includedServices.includes('INTERNET'));
      setIncludesMaintenance(initialData.metadata?.includesMaintenance !== false);
      setRentRules(initialData.metadata?.rentRules || '');
      // Swap Extra
      setSwapMaxCashDiff(initialData.metadata?.swapMaxCashDiff || '');
      setSwapAcceptsVehicle(!!initialData.metadata?.swapAcceptsVehicle);
      setSwapAcceptsLand(!!initialData.metadata?.swapAcceptsLand);
      setSwapAcceptsDept(initialData.metadata?.swapAcceptsDept !== false);
      setSwapAcceptsHouse(initialData.metadata?.swapAcceptsHouse !== false);
      setSwapAcceptsCash(initialData.metadata?.swapAcceptsCash !== false);
      setSwapPriority(initialData.metadata?.swapPriority || 'Media');

      setPublisherType((initialData.metadata?.publisherType as any) || 'owner');
      setListingSourceText('');
      setListingImportSummary([]);
      setListingImportProvider('');
      setListingImportError('');
      setIsImportPanelExpanded(false);
      setStep(1); // Skip Step 0 when editing
    } else {
      // Reset to defaults
      setStep(publisherRepresentativeType ? 1 : 0);
      setPublisherType(mapPublisherType(publisherRepresentativeType));
      setSelectedModes(['SALE']);
      setActiveConfigTab('SALE');
      setTitle('');
      setDescription('');
      
      // Venta reset
      setValuationAmount('');
      setCatastralValue('');
      setCondoRegime(false);
      setMaintenanceFee('');

      // Expanded Legal & Appraisal & Commercial fields reset
      setLegalDebtFree(null);
      setLegalPublicDeed(null);
      setLegalTaxCurrent(null);
      setLegalServicesPaid(null);
      setLegalIsMortgaged(null);
      setLegalLienType('');
      setLegalLienObservations('');
      setLegalRegime('');
      setLegalLandUse('');
      setLegalRestrictions('');
      setLegalDocumentationComplete(null);
      setLegalJuridicalResponsible('');
      setLegalLastUpdate('');
      setAppraisalAmount('');
      setAppraisalDate('');
      setAppraisalExpert('');
      setAppraisalValidity('');
      setAppreciationLevel('');
      setCommercialStatus('');
      // Renta reset
      setAdvanceMonths(1);
      setRequiresGuarantor(false);
      setRequiresLegalPolicy(false);
      setAcceptsPets(false);
      setRentalFurnishingStatus('UNFURNISHED');
      setIncludesWater(false);
      setIncludesElectricity(false);
      setIncludesInternet(false);
      setIncludesMaintenance(false);
      setRentRules('');
      // Swap reset
      setSwapMaxCashDiff('');
      setSwapAcceptsVehicle(false);
      setSwapAcceptsLand(false);
      setSwapAcceptsDept(false);
      setSwapAcceptsHouse(false);
      setSwapAcceptsCash(false);
      setSwapPriority('Media');
      setSwapMinValue('');
      setSwapMaxValue('');
      setType('Departamento');
      setDevelopmentName('');
      setShortDescription('');
      setLocation('');
      setCountry('');
      setAddress('');
      setShowPublicAddress(false);
      setLatitude(null);
      setLongitude(null);
      setPlaceId(null);
      setFormattedAddress(null);
      setCity(null);
      setStateName(null);
      setGeometrySource(null);
      setAddressEntryMode('google');
      setBedrooms(2);
      setBathrooms(2);
      setHalfBathrooms(0);
      setMaxGuests(4);
      setSelectedAmenities([]);
      setCustomAmenities([]);
      setImages([]);
      setImagesMetadata({});
      setVideoPlaceholder('');
      setVideoUrls([]);
      setVirtualTourPlaceholder('');
      setSalePrice(0);
      setSaleCurrency('MXN');
      setMonthlyPrice(0);
      setMonthlyDeposit(0);
      setMonthlyCurrency('MXN');
      setMonthlyMinMonths(12);
      setMonthlyAvailableFrom('');
      setMonthlyContract(false);
      setRentalCommissionModel('ONE_MONTH_RENT');
      setSaleAcceptsOffers(false);
      setAcceptsBankCredit(false);
      setAcceptsInfonavit(false);
      setAcceptsFovissste(false);
      setAcceptsCash(false);
      setDeveloperFinancing(false);
      setListingSourceText('');
      setListingImportSummary([]);
      setListingImportProvider('');
      setListingImportError('');
      setIsImportPanelExpanded(true);
    }
  }, [initialData, isOpen, publisherRepresentativeType]);

  // Auto-save to localStorage
  useEffect(() => {
    // Only auto-save if we are in draft mode and not publishing/submitting
    if (!isOpen || !!initialData || !isDraftHydrated) return;
    
    const draftData = {
      step,
      publisherType,
      selectedModes,
      title,
      shortDescription,
      description,
      type,
      developmentName,
      location,
      country,
      address,
      latitude,
      longitude,
      placeId,
      formattedAddress,
      addressEntryMode,
      city,
      stateName,
      neighborhood,
      postalCode,
      streetName,
      streetNumber,
      locationReference,
      showPublicAddress,
      bedrooms,
      bathrooms,
      halfBathrooms,
      parkingSpaces,
      levelsCount,
      maxGuests,
      surfaceTotal,
      surfaceBuilt,
      surfaceFront,
      surfaceDepth,
      selectedAmenities,
      customAmenities,
      images,
      imagesMetadata,
      videoUrls,
      videoPlaceholder,
      virtualTourPlaceholder,
      isExclusive,
      commissionTotalPct,
      commissionSharedPct,
      // prices
      salePrice,
      saleCurrency,
      saleAcceptsOffers,
      acceptsBankCredit,
      acceptsInfonavit,
      acceptsFovissste,
      acceptsCash,
      developerFinancing,
      monthlyPrice,
      monthlyDeposit,
      monthlyCurrency,
      monthlyMinMonths,
      monthlyAvailableFrom,
      monthlyContract,
      nightlyPrice,
      shortMinNights,
      shortDeposit,
      weeklyPrice,
      swapValueTier,
      swapAvailableStart,
      swapAvailableEnd,
      swapPreferences,
      // operation specific
      valuationAmount,
      catastralValue,
      condoRegime,
      maintenanceFee,
      advanceMonths,
      requiresGuarantor,
      requiresLegalPolicy,
      acceptsPets,
      rentalFurnishingStatus,
      includesWater,
      includesElectricity,
      includesInternet,
      includesMaintenance,
      rentRules,
      rentalCommissionModel,
      swapMaxCashDiff,
      swapAcceptsVehicle,
      swapAcceptsLand,
      swapAcceptsDept,
      swapAcceptsHouse,
      swapAcceptsCash,
      swapPriority,
      // legal
      legalDebtFree,
      legalPublicDeed,
      legalTaxCurrent,
      legalServicesPaid,
      legalOwnerType,
      legalIsMortgaged,
      legalLienType,
      legalLienObservations,
      legalRegime,
      legalLandUse,
      legalRestrictions,
      legalDocumentationComplete,
      legalJuridicalResponsible,
      legalLastUpdate,
      appraisalAmount,
      appraisalDate,
      appraisalExpert,
      appraisalValidity,
      appreciationLevel,
      commercialStatus,
      listingSourceText,
      listingImportSummary,
      listingImportProvider,
      isImportPanelExpanded,
    };

    console.log('[GeoTrace] [Fase C] Guardando borrador recuperable con coordenadas:', { latitude: draftData.latitude, longitude: draftData.longitude });
    savePropertyWizardDraft(draftData);
  }, [
    isOpen,
    initialData,
    isDraftHydrated,
    step,
    publisherType,
    selectedModes,
    title,
    shortDescription,
    description,
    type,
    developmentName,
    location,
    country,
    address,
    latitude,
    longitude,
    placeId,
    formattedAddress,
    addressEntryMode,
    city,
    stateName,
    neighborhood,
    postalCode,
    streetName,
    streetNumber,
    locationReference,
    showPublicAddress,
    bedrooms,
    bathrooms,
    halfBathrooms,
    parkingSpaces,
    levelsCount,
    maxGuests,
    surfaceTotal,
    surfaceBuilt,
    surfaceFront,
    surfaceDepth,
    selectedAmenities,
    customAmenities,
    images,
    imagesMetadata,
    videoUrls,
    videoPlaceholder,
    virtualTourPlaceholder,
    isExclusive,
    commissionTotalPct,
    commissionSharedPct,
    salePrice,
    saleCurrency,
    saleAcceptsOffers,
    acceptsBankCredit,
    acceptsInfonavit,
    acceptsFovissste,
    acceptsCash,
    developerFinancing,
    monthlyPrice,
    monthlyDeposit,
    monthlyCurrency,
    monthlyMinMonths,
    monthlyAvailableFrom,
    monthlyContract,
    nightlyPrice,
    shortMinNights,
    shortDeposit,
    weeklyPrice,
    swapValueTier,
    swapAvailableStart,
    swapAvailableEnd,
    swapPreferences,
    valuationAmount,
    catastralValue,
    condoRegime,
    maintenanceFee,
    advanceMonths,
    requiresGuarantor,
    requiresLegalPolicy,
    acceptsPets,
    rentalFurnishingStatus,
    includesWater,
    includesElectricity,
    includesInternet,
    includesMaintenance,
    rentRules,
    rentalCommissionModel,
    swapMaxCashDiff,
    swapAcceptsVehicle,
    swapAcceptsLand,
    swapAcceptsDept,
    swapAcceptsHouse,
    swapAcceptsCash,
    swapPriority,
    legalDebtFree,
    legalPublicDeed,
    legalTaxCurrent,
    legalServicesPaid,
    legalOwnerType,
    legalIsMortgaged,
    legalLienType,
    legalLienObservations,
    legalRegime,
    legalLandUse,
    legalRestrictions,
    legalDocumentationComplete,
    legalJuridicalResponsible,
    legalLastUpdate,
    appraisalAmount,
    appraisalDate,
    appraisalExpert,
    appraisalValidity,
    appreciationLevel,
    commercialStatus,
    listingSourceText,
    listingImportSummary,
    listingImportProvider,
    isImportPanelExpanded,
  ]);

  // Load draft check on modal mount or open
  useEffect(() => {
    if (isOpen && !initialData) {
      const parsed = readPropertyWizardDraft() as any;
      if (parsed) {
        try {
          console.log('[GeoTrace] [Fase C] Borrador cargado desde localStorage con coordenadas:', { latitude: parsed.latitude, longitude: parsed.longitude });
          if (typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 12) {
            setStep(parsed.step as WizardStep);
          }
          if (parsed.title || parsed.location) {
            // Auto restore draft
            if (parsed.publisherType) setPublisherType(parsed.publisherType);
            if (Array.isArray(parsed.selectedModes) && parsed.selectedModes.length > 0) {
              setSelectedModes(parsed.selectedModes);
              setActiveConfigTab(parsed.selectedModes[0]);
            } else {
              setSelectedModes(['SALE']);
              setActiveConfigTab('SALE');
            }
            if (parsed.title) setTitle(parsed.title);
            if (parsed.shortDescription) {
              setShortDescription(parsed.shortDescription);
              setDescription(parsed.description || parsed.shortDescription);
            }
            if (parsed.type) setType(parsed.type);
            if (parsed.developmentName) setDevelopmentName(parsed.developmentName);
            if (parsed.location) setLocation(parsed.location);
            if (parsed.country) setCountry(parsed.country);
            if (parsed.address) setAddress(parsed.address);
            if (parsed.latitude) setLatitude(parsed.latitude);
            if (parsed.longitude) setLongitude(parsed.longitude);
            if (parsed.placeId) setPlaceId(parsed.placeId);
            if (parsed.formattedAddress) setFormattedAddress(parsed.formattedAddress);
            if (parsed.addressEntryMode === 'google' || parsed.addressEntryMode === 'manual') setAddressEntryMode(parsed.addressEntryMode);
            if (parsed.city) setCity(parsed.city);
            if (parsed.stateName) setStateName(parsed.stateName);
            if (parsed.neighborhood) setNeighborhood(parsed.neighborhood);
            if (parsed.postalCode) setPostalCode(parsed.postalCode);
            if (parsed.streetName) setStreetName(parsed.streetName);
            if (parsed.streetNumber) setStreetNumber(parsed.streetNumber);
            if (parsed.locationReference) setLocationReference(parsed.locationReference);
            if (parsed.showPublicAddress !== undefined) setShowPublicAddress(parsed.showPublicAddress);
            if (parsed.bedrooms) setBedrooms(parsed.bedrooms);
            if (parsed.bathrooms) setBathrooms(parsed.bathrooms);
            if (parsed.halfBathrooms) setHalfBathrooms(parsed.halfBathrooms);
            if (parsed.parkingSpaces !== undefined) setParkingSpaces(parsed.parkingSpaces);
            if (parsed.levelsCount !== undefined) setLevelsCount(parsed.levelsCount);
            if (parsed.maxGuests) setMaxGuests(parsed.maxGuests);
            if (parsed.surfaceTotal !== undefined) setSurfaceTotal(parsed.surfaceTotal);
            if (parsed.surfaceBuilt !== undefined) setSurfaceBuilt(parsed.surfaceBuilt);
            if (parsed.surfaceFront !== undefined) setSurfaceFront(parsed.surfaceFront);
            if (parsed.surfaceDepth !== undefined) setSurfaceDepth(parsed.surfaceDepth);
            if (parsed.selectedAmenities) setSelectedAmenities(parsed.selectedAmenities);
            if (parsed.customAmenities) setCustomAmenities(parsed.customAmenities);
            if (parsed.images) setImages(parsed.images);
            if (parsed.imagesMetadata) setImagesMetadata(parsed.imagesMetadata);
            if (Array.isArray(parsed.videoUrls)) setVideoUrls(parsed.videoUrls.slice(0, 5));
            else if (parsed.videoUrl) setVideoUrls([parsed.videoUrl]);
            if (parsed.videoPlaceholder) setVideoPlaceholder(parsed.videoPlaceholder);
            if (parsed.virtualTourPlaceholder) setVirtualTourPlaceholder(parsed.virtualTourPlaceholder);
            if (parsed.isExclusive !== undefined) setIsExclusive(parsed.isExclusive);
            if (parsed.commissionTotalPct !== undefined) setCommissionTotalPct(parsed.commissionTotalPct);
            if (parsed.commissionSharedPct !== undefined) setCommissionSharedPct(parsed.commissionSharedPct);
            if (parsed.salePrice) setSalePrice(parsed.salePrice);
            if (parsed.saleCurrency) setSaleCurrency(parsed.saleCurrency);
            if (parsed.saleAcceptsOffers !== undefined) setSaleAcceptsOffers(parsed.saleAcceptsOffers);
            if (parsed.acceptsBankCredit !== undefined) setAcceptsBankCredit(parsed.acceptsBankCredit);
            if (parsed.acceptsInfonavit !== undefined) setAcceptsInfonavit(parsed.acceptsInfonavit);
            if (parsed.acceptsFovissste !== undefined) setAcceptsFovissste(parsed.acceptsFovissste);
            if (parsed.acceptsCash !== undefined) setAcceptsCash(parsed.acceptsCash);
            if (parsed.developerFinancing !== undefined) setDeveloperFinancing(parsed.developerFinancing);
            if (parsed.monthlyPrice) setMonthlyPrice(parsed.monthlyPrice);
            if (parsed.monthlyDeposit) setMonthlyDeposit(parsed.monthlyDeposit);
            if (parsed.monthlyCurrency === 'MXN' || parsed.monthlyCurrency === 'USD') setMonthlyCurrency(parsed.monthlyCurrency);
            if (parsed.monthlyMinMonths) setMonthlyMinMonths(parsed.monthlyMinMonths);
            if (parsed.monthlyAvailableFrom) setMonthlyAvailableFrom(parsed.monthlyAvailableFrom);
            if (parsed.monthlyContract !== undefined) setMonthlyContract(parsed.monthlyContract);
            if (parsed.nightlyPrice) setNightlyPrice(parsed.nightlyPrice);
            if (parsed.shortMinNights) setShortMinNights(parsed.shortMinNights);
            if (parsed.shortDeposit) setShortDeposit(parsed.shortDeposit);
            if (parsed.weeklyPrice) setWeeklyPrice(parsed.weeklyPrice);
            if (parsed.swapValueTier) setSwapValueTier(parsed.swapValueTier);
            if (parsed.swapAvailableStart) setSwapAvailableStart(parsed.swapAvailableStart);
            if (parsed.swapAvailableEnd) setSwapAvailableEnd(parsed.swapAvailableEnd);
            if (parsed.swapPreferences) setSwapPreferences(parsed.swapPreferences);
            // new fields
            if (parsed.valuationAmount !== undefined) setValuationAmount(parsed.valuationAmount);
            if (parsed.catastralValue !== undefined) setCatastralValue(parsed.catastralValue);
            if (parsed.condoRegime !== undefined) setCondoRegime(parsed.condoRegime);
            if (parsed.maintenanceFee !== undefined) setMaintenanceFee(parsed.maintenanceFee);
            if (parsed.advanceMonths !== undefined) setAdvanceMonths(parsed.advanceMonths);
            if (parsed.requiresGuarantor !== undefined) setRequiresGuarantor(parsed.requiresGuarantor);
            if (parsed.requiresLegalPolicy !== undefined) setRequiresLegalPolicy(parsed.requiresLegalPolicy);
            if (parsed.acceptsPets !== undefined) setAcceptsPets(parsed.acceptsPets);
            if (parsed.rentalFurnishingStatus) setRentalFurnishingStatus(parsed.rentalFurnishingStatus);
            else if (parsed.isFurnished !== undefined) setRentalFurnishingStatus(parsed.isFurnished ? 'FURNISHED' : 'UNFURNISHED');
            if (parsed.includesWater !== undefined) setIncludesWater(parsed.includesWater);
            else if (parsed.includesServices !== undefined) setIncludesWater(parsed.includesServices);
            if (parsed.includesElectricity !== undefined) setIncludesElectricity(parsed.includesElectricity);
            else if (parsed.includesServices !== undefined) setIncludesElectricity(parsed.includesServices);
            if (parsed.includesInternet !== undefined) setIncludesInternet(parsed.includesInternet);
            else if (parsed.includesServices !== undefined) setIncludesInternet(parsed.includesServices);
            if (parsed.includesMaintenance !== undefined) setIncludesMaintenance(parsed.includesMaintenance);
            if (parsed.rentRules) setRentRules(parsed.rentRules);
            if (parsed.rentalCommissionModel) setRentalCommissionModel(parsed.rentalCommissionModel);
            if (parsed.swapMaxCashDiff !== undefined) setSwapMaxCashDiff(parsed.swapMaxCashDiff);
            if (parsed.swapAcceptsVehicle !== undefined) setSwapAcceptsVehicle(parsed.swapAcceptsVehicle);
            if (parsed.swapAcceptsLand !== undefined) setSwapAcceptsLand(parsed.swapAcceptsLand);
            if (parsed.swapAcceptsDept !== undefined) setSwapAcceptsDept(parsed.swapAcceptsDept);
            if (parsed.swapAcceptsHouse !== undefined) setSwapAcceptsHouse(parsed.swapAcceptsHouse);
            if (parsed.swapAcceptsCash !== undefined) setSwapAcceptsCash(parsed.swapAcceptsCash);
            if (parsed.swapPriority) setSwapPriority(parsed.swapPriority);
            if (parsed.legalDebtFree !== undefined) setLegalDebtFree(parsed.legalDebtFree);
            if (parsed.legalPublicDeed !== undefined) setLegalPublicDeed(parsed.legalPublicDeed);
            if (parsed.legalTaxCurrent !== undefined) setLegalTaxCurrent(parsed.legalTaxCurrent);
            if (parsed.legalServicesPaid !== undefined) setLegalServicesPaid(parsed.legalServicesPaid);
            if (parsed.legalOwnerType) setLegalOwnerType(parsed.legalOwnerType);
            if (parsed.legalIsMortgaged !== undefined) setLegalIsMortgaged(parsed.legalIsMortgaged);
            if (parsed.legalLienType) setLegalLienType(parsed.legalLienType);
            if (parsed.legalLienObservations) setLegalLienObservations(parsed.legalLienObservations);
            if (parsed.legalRegime) setLegalRegime(parsed.legalRegime);
            if (parsed.legalLandUse) setLegalLandUse(parsed.legalLandUse);
            if (parsed.legalRestrictions) setLegalRestrictions(parsed.legalRestrictions);
            if (parsed.legalDocumentationComplete !== undefined) setLegalDocumentationComplete(parsed.legalDocumentationComplete);
            if (parsed.legalJuridicalResponsible) setLegalJuridicalResponsible(parsed.legalJuridicalResponsible);
            if (parsed.legalLastUpdate) setLegalLastUpdate(parsed.legalLastUpdate);
            if (parsed.appraisalAmount !== undefined) setAppraisalAmount(parsed.appraisalAmount);
            if (parsed.appraisalDate) setAppraisalDate(parsed.appraisalDate);
            if (parsed.appraisalExpert) setAppraisalExpert(parsed.appraisalExpert);
            if (parsed.appraisalValidity) setAppraisalValidity(parsed.appraisalValidity);
            if (parsed.appreciationLevel) setAppreciationLevel(parsed.appreciationLevel);
            if (parsed.commercialStatus) setCommercialStatus(parsed.commercialStatus);
            if (parsed.listingSourceText) setListingSourceText(parsed.listingSourceText);
            if (parsed.listingImportSummary) setListingImportSummary(parsed.listingImportSummary);
            if (parsed.listingImportProvider) setListingImportProvider(parsed.listingImportProvider);
            if (parsed.isImportPanelExpanded !== undefined) setIsImportPanelExpanded(parsed.isImportPanelExpanded);
            
            showToast(
              language === 'es' 
                ? 'Borrador recuperado automáticamente.' 
                : 'Draft automatically restored.',
              'success'
            );
          }
        } catch (e) {
          console.error('Error restoring draft:', e);
        }
      }
      setIsDraftHydrated(true);
    } else {
      setIsDraftHydrated(false);
    }
  }, [isOpen, initialData, language]);
  const { score: qualityScore, suggestions: qualitySuggestions } = useMemo(() => getListingQuality({
    title,
    shortDescription,
    location,
    country,
    selectedModes,
    images,
    selectedAmenities,
    customAmenities,
    videoPlaceholder,
    virtualTourPlaceholder,
  }), [
    country,
    customAmenities,
    images,
    location,
    selectedAmenities,
    selectedModes,
    shortDescription,
    title,
    videoPlaceholder,
    virtualTourPlaceholder,
  ]);

  const previewPriceLabel = useMemo(() => getPreviewPriceLabel({
    selectedModes,
    salePrice,
    saleCurrency,
    nightlyPrice,
    monthlyPrice,
    monthlyCurrency,
  }), [monthlyCurrency, monthlyPrice, nightlyPrice, saleCurrency, salePrice, selectedModes]);

  const toggleMode = useCallback((mode: PropertyOfferingMode) => {
    setSelectedModes((previous) =>
      previous.includes(mode)
        ? previous.filter((item) => item !== mode)
        : [...previous, mode],
    );
  }, []);

  const toggleAmenity = useCallback((amenity: string) => {
    setSelectedAmenities((previous) =>
      previous.includes(amenity)
        ? previous.filter((item) => item !== amenity)
        : [...previous, amenity],
    );
  }, []);

  const stepsConfig = useMemo(() => getWizardSteps({
    publisherRepresentativeType,
    canCaptureOwnerContact,
    hasInitialData: Boolean(initialData),
    selectedModes,
  }), [canCaptureOwnerContact, initialData, publisherRepresentativeType, selectedModes]);
  const activeSteps = useMemo(() => stepsConfig.filter((item) => item.isVisible), [stepsConfig]);
  const totalActiveSteps = activeSteps.length;
  const currentActiveIndex = activeSteps.findIndex((item) => item.id === step);
  const activeStepCopy = WIZARD_STEP_COPY[step];
  const progressPercentage = totalActiveSteps > 1
    ? Math.round((currentActiveIndex / (totalActiveSteps - 1)) * 100)
    : 100;
  const remainingStepsCount = totalActiveSteps - 1 - currentActiveIndex;
  const remainingTimeMinutes = activeSteps
    .slice(currentActiveIndex + 1)
    .reduce((sum, item) => sum + item.estTimeMinutes, 0);

  if (!isOpen) return null;

  // Auto-scroll to the first field with a validation error
  const scrollToError = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const errorEl = el.querySelector<HTMLElement>('[data-error="true"]');
    if (errorEl) {
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const geocodeManualAddress = async (queryStr: string): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !(window as any).google || !(window as any).google.maps) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (result: { lat: number; lng: number } | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => finish(null), 3000);

      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: queryStr }, (results: any, status: any) => {
          if (status === 'OK' && results && results.length > 0) {
            const loc = results[0].geometry.location;
            finish({ lat: loc.lat(), lng: loc.lng() });
          } else {
            finish(null);
          }
        });
      } catch (e) {
        console.error('[Geocoding Error]:', e);
        finish(null);
      }
    });
  };

  const invalidateResolvedLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setPlaceId(null);
    setFormattedAddress(null);
    setGeometrySource(null);
  };

  const handleAddressFieldEdit = () => {
    if (addressEntryMode === 'manual') invalidateResolvedLocation();
  };

  const applyGoogleAddress = (result: GoogleAddressResult) => {
    setPlaceId(result.placeId);
    setFormattedAddress(result.formattedAddress);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setGeometrySource('google_places');
    setCity(result.city);
    setLocation(result.city);
    setStateName(result.state);
    setCountry(result.country);
    setNeighborhood(result.neighborhood);
    setPostalCode(result.postalCode);
    setStreetName(result.streetName);
    setStreetNumber(result.streetNumber);
    setAddress([result.streetName, result.streetNumber].filter(Boolean).join(' '));
    setFieldErrors((previous) => ({ ...previous, city: '', country: '' }));
  };

  const buildLocationValues = () => {
    const cleanCity = (city || '').trim();
    const cleanState = (stateName || '').trim();
    const publicLocation = [neighborhood.trim(), cleanCity].filter(Boolean).join(', ');
    const streetLine = [streetName.trim(), streetNumber.trim()].filter(Boolean).join(' ');
    const fullAddress = [streetLine, neighborhood.trim(), cleanCity, cleanState, postalCode.trim(), country.trim()]
      .filter(Boolean)
      .join(', ');

    return { cleanCity, publicLocation, fullAddress };
  };

  const handleNext = async () => {
    setValidationError(null);
    setFieldErrors({});

    const currentLat = latitude;
    const currentLng = longitude;

    const { cleanCity, publicLocation, fullAddress } = buildLocationValues();

    if (step === 2) {
      setLocation(publicLocation);
      setAddress(fullAddress);
    }

    // Compilar datos del paso actual para validación estructurada
    const stepData: Record<string, any> = {
      title,
      description: shortDescription,
      location: step === 2 ? publicLocation : location,
      city: cleanCity,
      country,
      latitude: currentLat,
      longitude: currentLng,
      selectedModes,
      type,
      bedrooms,
      bathrooms,
      levelsCount,
      swapPreferences,
      monthlyPrice,
      nightlyPrice,
      salePrice,
      images
    };

    const stepValidation = PropertyValidator.validateStep(step, stepData);
    if (!stepValidation.success) {
      const errMap: Record<string, string> = {};
      stepValidation.errors.forEach(err => {
        errMap[err.field] = err.message;
      });
      setFieldErrors(errMap);
      setValidationError("Por favor corrige los errores del formulario para avanzar.");
      setTimeout(scrollToError, 80);
      return;
    }

    // La geocodificación es una mejora de datos, nunca un requisito para navegar.
    // Se ejecuta después de validar y en segundo plano para que una API externa
    // lenta, restringida o caída no pueda congelar el botón "Siguiente".
    if (step === 2 && (currentLat === null || currentLng === null)) {
      void (async () => {
        let resolvedLocation = fullAddress.trim()
          ? await geocodeManualAddress(fullAddress)
          : null;

        if (!resolvedLocation) {
          const fallbackQuery = [cleanCity, stateName, country].filter(Boolean).join(', ');
          resolvedLocation = fallbackQuery.trim()
            ? await geocodeManualAddress(fallbackQuery)
            : null;
        }

        if (resolvedLocation) {
          setLatitude(resolvedLocation.lat);
          setLongitude(resolvedLocation.lng);
          setGeometrySource('google_geocoding');
        }
      })();
    }

    const nextStep = activeSteps[currentActiveIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  };

  const handleBack = () => {
    setValidationError(null);
    setFieldErrors({});
    const prevStep = activeSteps[currentActiveIndex - 1];
    if (prevStep) {
      setStep(prevStep.id);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Publish] Step 1: Iniciando proceso de publicación');
    setValidationError(null);
    setSupabaseError(null);
    setFieldErrors({});

    if (!currentUser && !initialData?.hostId) {
      console.error('[Publish] ❌ No hay un usuario autenticado.');
      setValidationError("No hay un usuario autenticado.");
      return;
    }

    const includedRentalServices = [
      includesWater ? 'WATER' : null,
      includesElectricity ? 'ELECTRICITY' : null,
      includesInternet ? 'INTERNET' : null,
    ].filter((service): service is string => Boolean(service));
    const normalizedDescription = description.trim()
      || shortDescription.trim()
      || 'Información pendiente de revisión por Towers México.';
    const normalizedCountry = country.trim() || 'México';

    // Map form selections back into normalized offerings
    const offerings: PropertyOffering[] = selectedModes.map(mode => {
      const existing = initialData?.offerings?.find(o => o.mode === mode);
      const usesOneMonthRentalCommission = mode === 'MONTHLY_RENT' && rentalCommissionModel === 'ONE_MONTH_RENT';
      
      const baseOffering = {
        id: existing?.id || `offering-${mode}-${initialData?.id || 'new'}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        propertyId: initialData?.id || '',
        mode,
        status: 'DRAFT',
        visibility: existing?.visibility || 'PUBLIC',
        title,
        description: normalizedDescription,
        currency: mode === 'MONTHLY_RENT' ? monthlyCurrency : 'USD',
        billingPeriod: mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT'),
        swapValueTier: mode === 'SWAP' ? swapValueTier : null,
        availableFrom: mode === 'SWAP' ? swapAvailableStart : (existing?.availableFrom || swapAvailableStart),
        availableUntil: mode === 'SWAP' ? swapAvailableEnd : (existing?.availableUntil || swapAvailableEnd),
        isFeatured: existing?.isFeatured || false,
        featuredRank: existing?.featuredRank || 0,
        commissionTotalPct: usesOneMonthRentalCommission || commissionTotalPct === '' ? null : Number(commissionTotalPct),
        commissionSharedPct: usesOneMonthRentalCommission || commissionSharedPct === '' ? null : Number(commissionSharedPct),
        metadata: existing?.metadata || {},
      } as PropertyOffering;

      if (mode === 'SWAP') {
        const estimatedSwapValue = Number(salePrice) || null;
        return {
          ...baseOffering,
          swapEstimatedValue: estimatedSwapValue,
          desiredExchange: swapPreferences,
          swapMinValue: Number(swapMinValue) || estimatedSwapValue,
          swapMaxValue: Number(swapMaxValue) || estimatedSwapValue,
          swapCashDifferenceAllowed: true,
          swapPreferences: { text: swapPreferences },
          auraScoreOverride: existing?.auraScoreOverride ?? initialData?.auraScore ?? null
        };
      } else if (mode === 'SHORT_RENT') {
        return {
          ...baseOffering,
          priceAmount: nightlyPrice,
          depositAmount: shortDeposit,
          minNights: shortMinNights,
          securityDepositAmount: shortDeposit,
          metadata: {
            ...baseOffering.metadata,
            weeklyPrice
          }
        };
      } else if (mode === 'MONTHLY_RENT') {
        return {
          ...baseOffering,
          priceAmount: monthlyPrice,
          currency: monthlyCurrency,
          depositAmount: monthlyDeposit,
          advanceMonths,
          minMonths: monthlyMinMonths,
          availableFrom: monthlyAvailableFrom || null,
          requiresGuarantor,
          requiresLegalPolicy,
          securityDepositAmount: monthlyDeposit,
          metadata: {
            ...baseOffering.metadata,
            requiresContract: monthlyContract,
            rentalFurnishingStatus,
            includedRentalServices,
            includesMaintenance,
            acceptsPets,
            rentalCommissionModel,
            rentalCommissionMonths: rentalCommissionModel === 'ONE_MONTH_RENT' ? 1 : null,
            rentalCommissionAmount: rentalCommissionModel === 'ONE_MONTH_RENT' ? monthlyPrice : null,
          }
        };
      } else if (mode === 'SALE') {
        return {
          ...baseOffering,
          priceAmount: salePrice,
          currency: saleCurrency,
          acceptsBankCredit,
          acceptsInfonavit,
          acceptsFovissste,
          acceptsCash,
          developerFinancing,
          acceptsOffers: saleAcceptsOffers
        };
      }
      return baseOffering;
    });

    const compiledPropertyData = {
      title,
      subtitle,
      shortDescription: shortDescription.trim(),
      description: normalizedDescription,
      type: mapUiToDbType(type),
      developmentName,
      location,
      country: normalizedCountry,
      address,
      latitude,
      longitude,
      placeId,
      formattedAddress,
      city,
      state: stateName,
      geometrySource,
      neighborhood,
      postalCode,
      streetName,
      streetNumber,
      locationReference,
      showPublicAddress,
      bedrooms,
      bathrooms,
      halfBathrooms,
      parkingSpaces,
      levelsCount,
      constructionAge: constructionAge === '' ? null : Number(constructionAge),
      conservationStateId: conservationState,
      constructionTypeId: constructionType,
      surfaceTotal: surfaceTotal === '' ? null : Number(surfaceTotal),
      surfaceBuilt: surfaceBuilt === '' ? null : Number(surfaceBuilt),
      surfaceFront: surfaceFront === '' ? null : Number(surfaceFront),
      surfaceDepth: surfaceDepth === '' ? null : Number(surfaceDepth),
      surfaceGarden: Number(surfaceGarden),
      surfaceTerrace: Number(surfaceTerrace),
      surfaceRoofGarden: Number(surfaceRoofGarden),
      surfacePatio: Number(surfacePatio),
      amenities: selectedAmenities,
      legalDebtFree,
      legalPublicDeed,
      legalTaxCurrent,
      legalServicesPaid,
      legalOwnerType: legalOwnerType as any,
      legalIsMortgaged,
      legalLienType: legalLienType as any,
      legalLienObservations,
      legalRegime: legalRegime as any,
      legalLandUse: legalLandUse as any,
      legalRestrictions,
      legalDocumentationComplete,
      legalJuridicalResponsible,
      legalLastUpdate,
      appraisalAmount: appraisalAmount === '' ? null : Number(appraisalAmount),
      appraisalDate,
      appraisalExpert,
      appraisalValidity,
      appreciationLevel: appreciationLevel || undefined,
      commercialStatus: (commercialStatus || undefined) as any,
      servicesWater: false,
      servicesElectricity: false,
      servicesSewerage: false,
      servicesNatGas: false,
      servicesLpGas: false,
      servicesInternet: '',
      servicesGarbage: false,
      securityCctv: selectedAmenities.includes('Domótica'),
      securityGuardhouse: selectedAmenities.includes('Seguridad 24/7'),
      security24_7: selectedAmenities.includes('Seguridad 24/7'),
      securityBiometric: selectedAmenities.includes('Cerradura inteligente'),
      images,
      valueRating: selectedModes.includes('SWAP') ? swapValueTier : 'Premium',
      availableStart: selectedModes.includes('SWAP') ? swapAvailableStart : '',
      availableEnd: selectedModes.includes('SWAP') ? swapAvailableEnd : '',
      offerings,
      desiredExchange: swapPreferences,
      isDemo: initialData?.isDemo ?? false,
      isPublished: false,
      folderStatus: 'UNDER_REVIEW' as const,
      metaTitle: metaTitle || (title ? `${title} | Towers México` : ''),
      metaDescription: metaDescription || shortDescription,
      hostId: currentUser?.id || initialData?.hostId || '',
      media: (() => {
        const list: any[] = [];
        let order = 0;

        // 1. Add images
        images.forEach((imgUrl) => {
          list.push({
            mediaType: 'IMAGE',
            url: imgUrl,
            displayOrder: order++,
            isPrimary: order === 1,
            metadata: {}
          });
        });

        // 2. Add up to five local videos
        videoUrls.slice(0, 5).forEach((videoUrl) => {
          list.push({
            mediaType: 'VIDEO',
            url: videoUrl,
            displayOrder: order++,
            isPrimary: false,
            metadata: {}
          });
        });

        // 3. Add YouTube / Vimeo recorrido video
        if (videoPlaceholder) {
          const type = (videoPlaceholder.includes('vimeo.com') || videoPlaceholder.includes('player.vimeo.com')) 
            ? 'VIMEO' 
            : 'YOUTUBE';
          list.push({
            mediaType: type,
            url: videoPlaceholder,
            displayOrder: order++,
            isPrimary: false,
            metadata: {}
          });
        }

        // 4. Add Matterport 3D Tour
        if (virtualTourPlaceholder) {
          list.push({
            mediaType: 'MATTERPORT',
            url: virtualTourPlaceholder,
            displayOrder: order++,
            isPrimary: false,
            metadata: { provider: getVirtualTourProvider(virtualTourPlaceholder) }
          });
        }

        return list;
      })(),
      internalOwnerContact: canCaptureOwnerContact ? {
        relationship: ownerRelationship || null,
        fullName: ownerFullName.trim() || null,
        phone: ownerPhone.trim() || null,
        email: ownerEmail.trim() || null,
        contactPreference: ownerContactPreference || null,
        viewingDays: ownerViewingDays,
        viewingStartTime: ownerViewingStartTime || null,
        viewingEndTime: ownerViewingEndTime || null,
        hasKeys: ownerHasKeys === 'unknown' ? null : ownerHasKeys === 'yes',
        occupancyStatus: ownerOccupancyStatus || null,
        appointmentNoticeHours: ownerAppointmentNoticeHours === '' ? null : Number(ownerAppointmentNoticeHours),
        visitInstructions: ownerVisitInstructions.trim() || null,
        extraNotes: ownerExtraNotes.trim() || null,
      } : undefined,
      metadata: {
        publisherType,
        uiPropertyType: type,
        halfBathrooms,
        imagesMetadata,
        isExclusive,
        commissionTotalPct,
        commissionSharedPct,
        customAmenities,
        // Venta extra
        valuationAmount,
        catastralValue,
        condoRegime,
        maintenanceFee,
        // Expanded Legal & Appraisal & Commercial fields
        legalLienType,
        legalLienObservations,
        legalRegime,
        legalLandUse,
        legalRestrictions,
        legalDocumentationComplete,
        legalJuridicalResponsible,
        legalLastUpdate,
        appraisalAmount,
        appraisalDate,
        appraisalExpert,
        appraisalValidity,
        appreciationLevel,
        commercialStatus,
        // Renta extra
        advanceMonths,
        requiresGuarantor,
        requiresLegalPolicy,
        acceptsPets,
        rentalFurnishingStatus,
        isFurnished: rentalFurnishingStatus === 'FURNISHED',
        includedRentalServices,
        includesServices: includedRentalServices.length > 0,
        includesMaintenance,
        rentRules,
        rentalCommissionModel,
        rentalCommissionMonths: rentalCommissionModel === 'ONE_MONTH_RENT' ? 1 : null,
        rentalCommissionAmount: rentalCommissionModel === 'ONE_MONTH_RENT' ? monthlyPrice : null,
        // Swap extra
        swapMaxCashDiff,
        swapAcceptsVehicle,
        swapAcceptsLand,
        swapAcceptsDept,
        swapAcceptsHouse,
        swapAcceptsCash,
        swapPriority
      }
    };

    console.log('[Publish] Step 2: Payload compilado recibido del wizard:', compiledPropertyData);
    console.log('[GeoTrace] [Fase E] Antes del mapper (compiledPropertyData):', { latitude: compiledPropertyData.latitude, longitude: compiledPropertyData.longitude });

    // Validar por completo antes de enviar a Supabase
    console.log('[Publish] Step 3: Ejecutando PropertyValidator');
    const validation = PropertyValidator.validatePropertyBeforeInsert(compiledPropertyData);
    console.log('[Publish] Resultado validator:', validation.errors);

    if (!validation.success) {
      console.warn('[Publish] ❌ Validación de negocio falló. Errores:', validation.errors);
      const errMap: Record<string, string> = {};
      validation.errors.forEach(err => {
        errMap[err.field] = err.message;
      });
      setFieldErrors(errMap);
      const validationMessages = [...new Set(validation.errors.map((error) => error.message))];
      setValidationError(`No pudimos enviar la propiedad: ${validationMessages.join(' ')}`);
      setTimeout(scrollToError, 80);
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('[Publish] Step 4: Enviando payload a onSubmit (SwapContext)...');
      await onSubmit(compiledPropertyData);
      console.log('[Publish] Step 5: ¡Publicación exitosa!');
      removePropertyWizardDraft();
    } catch (err: any) {
      console.error('[Publish] ❌ Error de red/Supabase durante la publicación:', err);
      const msg = err.message || '';
      let friendlyMessage = 'No fue posible guardar la propiedad debido a un error en el servidor.';
      if (msg.includes('latitude') || msg.includes('longitude')) {
        friendlyMessage = 'No se pudo obtener la ubicación del inmueble. Por favor, selecciona un punto en el mapa.';
      } else if (msg.includes('host_id')) {
        friendlyMessage = 'No se encontró el propietario.';
      } else if (msg.includes('title')) {
        friendlyMessage = 'El título es obligatorio.';
      } else if (msg.includes('description')) {
        friendlyMessage = 'La descripción es obligatoria.';
      } else if (msg.includes('23505') || msg.includes('unique constraint')) {
        friendlyMessage = 'Ya existe una propiedad registrada con el mismo código interno.';
      }

      setSupabaseError({
        message: friendlyMessage,
        code: err.code || 'UNKNOWN_ERROR',
        details: err.details || err.message,
        hint: err.hint
      });
      setValidationError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-end justify-center overflow-hidden bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      >
        <div className="absolute inset-0" onClick={onClose} />
        
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-wizard-title"
          className={`${styles.wizardShell} relative z-10 grid h-[94dvh] max-h-[94dvh] w-full max-w-6xl grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-t-[32px] bg-[#f8f7f3] shadow-2xl sm:h-[calc(100dvh-3rem)] sm:max-h-[900px] sm:rounded-[34px] lg:grid-cols-[330px_minmax(0,1fr)]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* DELETE CONFIRMATION SCREEN OVERLAY inside the modal */}
          {localDeleteConfirm && initialData && (
            <div className="absolute inset-0 bg-white/98 z-30 p-6 flex flex-col justify-center items-center text-center animate-in fade-in duration-200">
              <AlertTriangle className="w-14 h-14 text-brand-rose mb-4 animate-bounce" />
              <h4 className="text-lg font-black text-brand-black mb-2">
                {t('dashboard.confirmDeleteTitle') || 'Confirmar eliminación'}
              </h4>
              <p className="text-xs text-brand-gray-500 leading-relaxed max-w-md mb-6">
                {t('dashboard.confirmDeleteDesc', { title: initialData.title }) || `¿Estás seguro de que deseas eliminar permanentemente ${initialData.title}?`}
              </p>
              <div className="bg-brand-rose/5 border border-brand-rose/10 rounded-2xl p-3 text-xs text-brand-rose font-semibold mb-8 max-w-md">
                {t('dashboard.deleteWarning') || 'Esta acción no se puede deshacer. Se cancelarán las negociaciones de swaps activas.'}
              </div>
              <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={() => setLocalDeleteConfirm(false)}
                  className="px-5 py-2.5 border border-brand-gray-200 text-brand-gray-600 rounded-xl text-xs font-bold hover:bg-brand-gray-50 cursor-pointer"
                >
                  {t('dashboard.cancelBtn') || 'Cancelar'}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (onDelete && initialData) {
                      onDelete(initialData.id);
                      setLocalDeleteConfirm(false);
                    }
                  }}
                  className="px-6 py-3 bg-brand-rose text-white rounded-xl text-xs font-black shadow-md hover:bg-brand-rose/90 cursor-pointer"
                >
                  {t('dashboard.confirmDeleteBtn') || 'Eliminar Permanentemente'}
                </button>
              </div>
            </div>
          )}

          {/* LEFT COLUMN: Visual Preview & Context */}
          <WizardPreviewPanel
            hasInitialData={Boolean(initialData)}
            images={images}
            selectedModes={selectedModes}
            type={type}
            title={title}
            location={location}
            neighborhood={neighborhood}
            bedrooms={bedrooms}
            bathrooms={bathrooms}
            halfBathrooms={halfBathrooms}
            parkingSpaces={parkingSpaces}
            surfaceTotal={surfaceTotal}
            selectedAmenities={selectedAmenities}
            customAmenities={customAmenities}
            previewPriceLabel={previewPriceLabel}
            publisherType={publisherType}
            qualityScore={qualityScore}
            qualitySuggestions={qualitySuggestions}
            activeSteps={activeSteps}
            step={step}
            currentActiveIndex={currentActiveIndex}
            totalActiveSteps={totalActiveSteps}
            progressPercentage={progressPercentage}
            remainingStepsCount={remainingStepsCount}
            remainingTimeMinutes={remainingTimeMinutes}
          />

          {/* RIGHT COLUMN: Form Controls */}
          <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8f7f3]">
            <header className="shrink-0 border-b border-black/5 bg-white/75 px-5 py-4 backdrop-blur sm:px-8 sm:py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-gray-400">
                    Paso {currentActiveIndex + 1} de {totalActiveSteps}
                  </p>
                  <h1
                    id="property-wizard-title"
                    className="mt-1 text-xl font-black tracking-[-0.03em] text-brand-black sm:text-2xl"
                  >
                    {activeStepCopy.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-relaxed text-brand-gray-500 sm:text-xs">
                    {activeStepCopy.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    console.log('[WIZARD CLOSE] X clicked');
                    onClose();
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white text-brand-gray-500 transition hover:text-brand-black"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 lg:hidden">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-gray-200">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[9px] font-black tabular-nums text-brand-gray-500">
                  {progressPercentage}%
                </span>
              </div>
            </header>

            {/* Scroll area wrapper — relative so overlays can position against it */}
            <div className="relative flex min-h-0 flex-1 gap-2 px-5 py-5 sm:px-8 sm:py-6">

              {/* Main scrollable form area */}
              <div
                ref={scrollAreaRef}
                data-property-wizard-form
                className={`${styles.formSurface} min-h-0 flex-1 overscroll-contain overflow-y-auto py-1 pr-1 no-scrollbar`}
              >
              <AnimatePresence mode="wait">
                {/* STEP 0: Publisher Identity Selection */}
                {step === 0 && (
                  <PublisherIdentityStep
                    key="step0"
                    publisherType={publisherType}
                    onPublisherTypeChange={setPublisherType}
                  />
                )}
                {/* STEP 1: Información Básica */}
                {step === 1 && (
                  <BasicInfoStep
                    key="step1"
                    developmentName={developmentName}
                    fieldErrors={fieldErrors}
                    handleImportListing={handleImportListing}
                    initialData={initialData}
                    isImportPanelExpanded={isImportPanelExpanded}
                    isImportingListing={isImportingListing}
                    listingImportError={listingImportError}
                    listingImportProvider={listingImportProvider}
                    listingImportSummary={listingImportSummary}
                    listingSourceText={listingSourceText}
                    scrollAreaRef={scrollAreaRef}
                    setDescription={setDescription}
                    setDevelopmentName={setDevelopmentName}
                    setIsImportPanelExpanded={setIsImportPanelExpanded}
                    setListingImportError={setListingImportError}
                    setListingSourceText={setListingSourceText}
                    setShortDescription={setShortDescription}
                    setTitle={setTitle}
                    setType={setType}
                    shortDescription={shortDescription}
                    title={title}
                    type={type}
                  />
                )}

                {/* STEP 2: Ubicación */}
                {step === 2 && (
                  <LocationStep
                    key="step2"
                    addressEntryMode={addressEntryMode}
                    applyGoogleAddress={applyGoogleAddress}
                    city={city}
                    country={country}
                    fieldErrors={fieldErrors}
                    formattedAddress={formattedAddress}
                    handleAddressFieldEdit={handleAddressFieldEdit}
                    locationReference={locationReference}
                    neighborhood={neighborhood}
                    postalCode={postalCode}
                    setAddressEntryMode={setAddressEntryMode}
                    setCity={setCity}
                    setCountry={setCountry}
                    setLocation={setLocation}
                    setLocationReference={setLocationReference}
                    setNeighborhood={setNeighborhood}
                    setPostalCode={setPostalCode}
                    setShowPublicAddress={setShowPublicAddress}
                    setStateName={setStateName}
                    setStreetName={setStreetName}
                    setStreetNumber={setStreetNumber}
                    showPublicAddress={showPublicAddress}
                    stateName={stateName}
                    streetName={streetName}
                    streetNumber={streetNumber}
                  />
                )}

                {/* STAFF-ONLY OPTIONAL STEP: owner or legal contact */}
                {step === 12 && canCaptureOwnerContact && (
                  <OwnerContactStep
                    key="step-owner-contact"
                    ownerAppointmentNoticeHours={ownerAppointmentNoticeHours}
                    ownerContactPreference={ownerContactPreference}
                    ownerEmail={ownerEmail}
                    ownerExtraNotes={ownerExtraNotes}
                    ownerFullName={ownerFullName}
                    ownerHasKeys={ownerHasKeys}
                    ownerOccupancyStatus={ownerOccupancyStatus}
                    ownerPhone={ownerPhone}
                    ownerRelationship={ownerRelationship}
                    ownerViewingDays={ownerViewingDays}
                    ownerViewingEndTime={ownerViewingEndTime}
                    ownerViewingStartTime={ownerViewingStartTime}
                    ownerVisitInstructions={ownerVisitInstructions}
                    scrollAreaRef={scrollAreaRef}
                    setOwnerAppointmentNoticeHours={setOwnerAppointmentNoticeHours}
                    setOwnerContactPreference={setOwnerContactPreference}
                    setOwnerEmail={setOwnerEmail}
                    setOwnerExtraNotes={setOwnerExtraNotes}
                    setOwnerFullName={setOwnerFullName}
                    setOwnerHasKeys={setOwnerHasKeys}
                    setOwnerOccupancyStatus={setOwnerOccupancyStatus}
                    setOwnerPhone={setOwnerPhone}
                    setOwnerRelationship={setOwnerRelationship}
                    setOwnerViewingDays={setOwnerViewingDays}
                    setOwnerViewingEndTime={setOwnerViewingEndTime}
                    setOwnerViewingStartTime={setOwnerViewingStartTime}
                    setOwnerVisitInstructions={setOwnerVisitInstructions}
                  />
                )}

                {/* STEP 3: Modalidad de Comercialización */}
                {step === 3 && (
                  <CommercializationStep
                    key="step3"
                    selectedModes={selectedModes}
                    selectedModesError={fieldErrors.selectedModes}
                    onToggleMode={toggleMode}
                  />
                )}
                {/* STEP 4: Características */}
                {step === 4 && (
                  <TechnicalSpecsStep
                    key="step4"
                    bathrooms={bathrooms}
                    bedrooms={bedrooms}
                    conservationState={conservationState}
                    constructionAge={constructionAge}
                    constructionType={constructionType}
                    fieldErrors={fieldErrors}
                    halfBathrooms={halfBathrooms}
                    levelsCount={levelsCount}
                    parkingSpaces={parkingSpaces}
                    scrollAreaRef={scrollAreaRef}
                    setBathrooms={setBathrooms}
                    setBedrooms={setBedrooms}
                    setConservationState={setConservationState}
                    setConstructionAge={setConstructionAge}
                    setConstructionType={setConstructionType}
                    setHalfBathrooms={setHalfBathrooms}
                    setLevelsCount={setLevelsCount}
                    setParkingSpaces={setParkingSpaces}
                    setSurfaceBuilt={setSurfaceBuilt}
                    setSurfaceDepth={setSurfaceDepth}
                    setSurfaceFront={setSurfaceFront}
                    setSurfaceGarden={setSurfaceGarden}
                    setSurfacePatio={setSurfacePatio}
                    setSurfaceRoofGarden={setSurfaceRoofGarden}
                    setSurfaceTerrace={setSurfaceTerrace}
                    setSurfaceTotal={setSurfaceTotal}
                    surfaceBuilt={surfaceBuilt}
                    surfaceDepth={surfaceDepth}
                    surfaceFront={surfaceFront}
                    surfaceGarden={surfaceGarden}
                    surfacePatio={surfacePatio}
                    surfaceRoofGarden={surfaceRoofGarden}
                    surfaceTerrace={surfaceTerrace}
                    surfaceTotal={surfaceTotal}
                  />
                )}

                {/* STEP 5: Amenidades */}
                {step === 5 && (
                  <AmenitiesStep
                    key="step5"
                    customAmenities={customAmenities}
                    language={language}
                    newCustomAmenity={newCustomAmenity}
                    selectedAmenities={selectedAmenities}
                    setCustomAmenities={setCustomAmenities}
                    setNewCustomAmenity={setNewCustomAmenity}
                    toggleAmenity={toggleAmenity}
                  />
                )}

                {/* STEP 6: Preferencias de Swap */}
                {step === 6 && (
                  <SwapPreferencesStep
                    key="step6"
                    fieldErrors={fieldErrors}
                    salePrice={salePrice}
                    scrollAreaRef={scrollAreaRef}
                    setSalePrice={setSalePrice}
                    setSwapAcceptsCash={setSwapAcceptsCash}
                    setSwapAcceptsDept={setSwapAcceptsDept}
                    setSwapAcceptsHouse={setSwapAcceptsHouse}
                    setSwapAcceptsLand={setSwapAcceptsLand}
                    setSwapAcceptsVehicle={setSwapAcceptsVehicle}
                    setSwapMaxCashDiff={setSwapMaxCashDiff}
                    setSwapMaxValue={setSwapMaxValue}
                    setSwapMinValue={setSwapMinValue}
                    setSwapPreferences={setSwapPreferences}
                    setSwapPriority={setSwapPriority}
                    swapAcceptsCash={swapAcceptsCash}
                    swapAcceptsDept={swapAcceptsDept}
                    swapAcceptsHouse={swapAcceptsHouse}
                    swapAcceptsLand={swapAcceptsLand}
                    swapAcceptsVehicle={swapAcceptsVehicle}
                    swapMaxCashDiff={swapMaxCashDiff}
                    swapMaxValue={swapMaxValue}
                    swapMinValue={swapMinValue}
                    swapPreferences={swapPreferences}
                    swapPriority={swapPriority}
                  />
                )}

                {/* STEP 7: Condiciones de Renta */}
                {step === 7 && (
                  <RentalTermsStep
                    key="step7"
                    acceptsPets={acceptsPets}
                    advanceMonths={advanceMonths}
                    fieldErrors={fieldErrors}
                    includesElectricity={includesElectricity}
                    includesInternet={includesInternet}
                    includesMaintenance={includesMaintenance}
                    includesWater={includesWater}
                    monthlyAvailableFrom={monthlyAvailableFrom}
                    monthlyCurrency={monthlyCurrency}
                    monthlyDeposit={monthlyDeposit}
                    monthlyMinMonths={monthlyMinMonths}
                    monthlyPrice={monthlyPrice}
                    rentalFurnishingStatus={rentalFurnishingStatus}
                    rentRules={rentRules}
                    requiresGuarantor={requiresGuarantor}
                    requiresLegalPolicy={requiresLegalPolicy}
                    setAcceptsPets={setAcceptsPets}
                    setAdvanceMonths={setAdvanceMonths}
                    setIncludesElectricity={setIncludesElectricity}
                    setIncludesInternet={setIncludesInternet}
                    setIncludesMaintenance={setIncludesMaintenance}
                    setIncludesWater={setIncludesWater}
                    setMonthlyAvailableFrom={setMonthlyAvailableFrom}
                    setMonthlyCurrency={setMonthlyCurrency}
                    setMonthlyDeposit={setMonthlyDeposit}
                    setMonthlyMinMonths={setMonthlyMinMonths}
                    setMonthlyPrice={setMonthlyPrice}
                    setRentalFurnishingStatus={setRentalFurnishingStatus}
                    setRentRules={setRentRules}
                    setRequiresGuarantor={setRequiresGuarantor}
                    setRequiresLegalPolicy={setRequiresLegalPolicy}
                  />
                )}

                {/* STEP 8: Términos de Venta */}
                {step === 8 && (
                  <SaleLegalStep
                    key="step8"
                    acceptsBankCredit={acceptsBankCredit}
                    acceptsCash={acceptsCash}
                    acceptsFovissste={acceptsFovissste}
                    acceptsInfonavit={acceptsInfonavit}
                    appraisalAmount={appraisalAmount}
                    appraisalDate={appraisalDate}
                    appraisalExpert={appraisalExpert}
                    appraisalValidity={appraisalValidity}
                    appreciationLevel={appreciationLevel}
                    commercialStatus={commercialStatus}
                    condoRegime={condoRegime}
                    developerFinancing={developerFinancing}
                    fieldErrors={fieldErrors}
                    legalDebtFree={legalDebtFree}
                    legalDocumentationComplete={legalDocumentationComplete}
                    legalIsMortgaged={legalIsMortgaged}
                    legalJuridicalResponsible={legalJuridicalResponsible}
                    legalLandUse={legalLandUse}
                    legalLastUpdate={legalLastUpdate}
                    legalLienObservations={legalLienObservations}
                    legalLienType={legalLienType}
                    legalPublicDeed={legalPublicDeed}
                    legalRegime={legalRegime}
                    legalRestrictions={legalRestrictions}
                    legalServicesPaid={legalServicesPaid}
                    legalTaxCurrent={legalTaxCurrent}
                    maintenanceFee={maintenanceFee}
                    saleCurrency={saleCurrency}
                    salePrice={salePrice}
                    scrollAreaRef={scrollAreaRef}
                    setAcceptsBankCredit={setAcceptsBankCredit}
                    setAcceptsCash={setAcceptsCash}
                    setAcceptsFovissste={setAcceptsFovissste}
                    setAcceptsInfonavit={setAcceptsInfonavit}
                    setAppraisalAmount={setAppraisalAmount}
                    setAppraisalDate={setAppraisalDate}
                    setAppraisalExpert={setAppraisalExpert}
                    setAppraisalValidity={setAppraisalValidity}
                    setAppreciationLevel={setAppreciationLevel}
                    setCommercialStatus={setCommercialStatus}
                    setCondoRegime={setCondoRegime}
                    setDeveloperFinancing={setDeveloperFinancing}
                    setLegalDebtFree={setLegalDebtFree}
                    setLegalDocumentationComplete={setLegalDocumentationComplete}
                    setLegalIsMortgaged={setLegalIsMortgaged}
                    setLegalJuridicalResponsible={setLegalJuridicalResponsible}
                    setLegalLandUse={setLegalLandUse}
                    setLegalLastUpdate={setLegalLastUpdate}
                    setLegalLienObservations={setLegalLienObservations}
                    setLegalLienType={setLegalLienType}
                    setLegalOwnerType={setLegalOwnerType}
                    setLegalPublicDeed={setLegalPublicDeed}
                    setLegalRegime={setLegalRegime}
                    setLegalRestrictions={setLegalRestrictions}
                    setLegalServicesPaid={setLegalServicesPaid}
                    setLegalTaxCurrent={setLegalTaxCurrent}
                    setMaintenanceFee={setMaintenanceFee}
                    setSaleCurrency={setSaleCurrency}
                    setSalePrice={setSalePrice}
                  />
                )}

                {/* STEP 9: Multimedia */}
                {step === 9 && (
                  <MediaStep
                    key="step9"
                    images={images}
                    onImagesChange={setImages}
                    imagesMetadata={imagesMetadata}
                    onImagesMetadataChange={setImagesMetadata}
                    videoUrls={videoUrls}
                    onVideoUrlsChange={setVideoUrls}
                    videoPlaceholder={videoPlaceholder}
                    onVideoPlaceholderChange={setVideoPlaceholder}
                    virtualTourPlaceholder={virtualTourPlaceholder}
                    onVirtualTourPlaceholderChange={setVirtualTourPlaceholder}
                    imagesError={fieldErrors.images}
                  />
                )}
                {/* STEP 10: Esquema Comercial */}
                {step === 10 && (
                  <CommercialSchemeStep
                    key="step10"
                    isExclusive={isExclusive}
                    onExclusiveChange={setIsExclusive}
                    selectedModes={selectedModes}
                    rentalCommissionModel={rentalCommissionModel}
                    onRentalCommissionModelChange={setRentalCommissionModel}
                    monthlyPrice={monthlyPrice}
                    monthlyCurrency={monthlyCurrency}
                    commissionTotalPct={commissionTotalPct}
                    onCommissionTotalPctChange={setCommissionTotalPct}
                    commissionSharedPct={commissionSharedPct}
                    onCommissionSharedPctChange={setCommissionSharedPct}
                  />
                )}
                {/* STEP 11: Vista Previa y Publicación */}
                {step === 11 && (
                  <ReviewStep
                    key="step11"
                    title={title}
                    type={type}
                    location={location}
                    bedrooms={bedrooms}
                    bathrooms={bathrooms}
                    parkingSpaces={parkingSpaces}
                    selectedModes={selectedModes}
                    hasAuthenticatedUser={Boolean(currentUser)}
                    hasInitialHost={Boolean(initialData?.hostId)}
                    latitude={latitude}
                    longitude={longitude}
                    salePrice={salePrice}
                    monthlyPrice={monthlyPrice}
                    nightlyPrice={nightlyPrice}
                    imagesCount={images.length}
                    serverError={supabaseError}
                  />
                )}
              </AnimatePresence>
              </div>{/* end scroll area */}

              <WizardScrollControls scrollAreaRef={scrollAreaRef} step={step} />

            </div>{/* end scroll wrapper */}

            {/* Inline Validation Alert */}
            {validationError && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-10 mx-5 mb-3 flex shrink-0 items-center gap-2 rounded-2xl border border-brand-rose/10 bg-brand-rose/5 p-3 text-xs font-semibold text-brand-rose sm:mx-8"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-brand-rose animate-pulse" />
                <span>{validationError}</span>
              </motion.div>
            )}

            {/* Stepper Navigation Buttons */}
            <footer className="z-10 flex shrink-0 items-center justify-between gap-2 border-t border-black/5 bg-white/80 px-5 py-4 sm:px-8">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0 || (step === 1 && (!!initialData || !!publisherRepresentativeType))}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-brand-gray-500 transition hover:bg-brand-gray-100 hover:text-brand-black ${
                  (step === 0 || (step === 1 && (!!initialData || !!publisherRepresentativeType))) ? 'opacity-0 pointer-events-none' : ''
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              {!initialData && (
                <button
                  type="button"
                  onClick={() => {
                    const shouldDiscard = window.confirm('¿Descartar este borrador? Se eliminará el avance guardado en este dispositivo.');
                    if (!shouldDiscard) return;
                    removePropertyWizardDraft();
                    onClose();
                  }}
                  className="rounded-full px-2 py-2 text-[9px] font-bold text-brand-gray-400 transition hover:bg-brand-gray-100 hover:text-brand-black sm:px-3"
                >
                  Descartar borrador
                </button>
              )}

              {step === 11 ? (
                <button
                  type="button"
                  onClick={handlePublish}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-black px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-black/90 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{initialData ? 'Guardar y enviar a revisión' : 'Enviar a revisión'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-black px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-black/90 active:scale-95"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </footer>
          </section>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
