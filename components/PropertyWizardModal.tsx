import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles, Check, Info, Loader2,
  Home, DollarSign, Calendar, MessageSquareCode, Award, Shield, User, Building, Briefcase, Camera, Play, Eye, AlertTriangle,
  MapPin, Sliders, FileText, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Property, PropertyOffering, PropertyOfferingMode, PropertyOfferingStatus, PropertyBillingPeriod, PropertyOfferingVisibility } from '../lib/types';
import { useTranslation } from '../lib/context/LanguageContext';
import ImageUploadDropzone from './ImageUploadDropzone';
import VideoUploadDropzone from './VideoUploadDropzone';
import { getVirtualTourProvider } from '../lib/mediaEmbeds';
import { PropertyValidator } from '../lib/services/PropertyValidator';
import { useSwap } from '../lib/context/SwapContext';
import { formatCount } from '../lib/textHelpers';
import GoogleAddressAutocomplete from './maps/GoogleAddressAutocomplete';
import type { GoogleAddressResult } from '../lib/maps/types';


interface PropertyWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (propertyData: any) => void;
  initialData?: Property | null;
  onDelete?: (id: string) => void;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface WizardStepConfig {
  id: WizardStep;
  label: string;
  description: string;
  isVisible: boolean;
  estTimeMinutes: number;
}

const AMENITY_OPTIONS = [
  // Interior
  'Cocina integral',
  'Cocina equipada',
  'Cocina con isla',
  'Desayunador',
  'Sala doble altura',
  'Family Room',
  'Sala TV',
  'Biblioteca',
  'Oficina',
  'Estudio',
  'Cuarto de servicio',
  'Cuarto de lavado',
  'Vestidor',
  'Bodega',
  'Bar',
  'Cava',
  'Jacuzzi',
  'Sauna',
  // Exterior
  'Alberca',
  'Terraza',
  'Roof Garden',
  'Jardín',
  'Patio',
  'Balcón',
  'Asador',
  'Huerto',
  'Cancha',
  // Technology
  'Domótica',
  'Alexa',
  'Cerradura inteligente',
  'Paneles solares',
  'Cargador vehículo eléctrico',
  'Internet fibra óptica'
];

type UIType = 'Casa' | 'Departamento' | 'Penthouse' | 'Townhouse' | 'Villa' | 'Casa de Playa' | 'Cabaña' | 'Loft' | 'Terreno' | 'Local Comercial';
type DBType = 'Apartment' | 'Beach House' | 'Cabin' | 'Penthouse' | 'Villa' | 'Loft';

const UI_TYPES: UIType[] = [
  'Casa',
  'Departamento',
  'Penthouse',
  'Townhouse',
  'Villa',
  'Casa de Playa',
  'Cabaña',
  'Loft',
  'Terreno',
  'Local Comercial'
];

function mapUiToDbType(uiType: UIType): DBType {
  switch (uiType) {
    case 'Departamento':
    case 'Local Comercial':
      return 'Apartment';
    case 'Casa de Playa':
      return 'Beach House';
    case 'Cabaña':
    case 'Terreno':
      return 'Cabin';
    case 'Penthouse':
      return 'Penthouse';
    case 'Casa':
    case 'Townhouse':
    case 'Villa':
      return 'Villa';
    case 'Loft':
      return 'Loft';
    default:
      return 'Apartment';
  }
}

function mapDbToUiType(dbType: DBType): UIType {
  switch (dbType) {
    case 'Apartment':
      return 'Departamento';
    case 'Beach House':
      return 'Casa de Playa';
    case 'Cabin':
      return 'Cabaña';
    case 'Penthouse':
      return 'Penthouse';
    case 'Villa':
      return 'Villa';
    case 'Loft':
      return 'Loft';
    default:
      return 'Departamento';
  }
}

const parseCurrency = (inputString: string): number => {
  if (!inputString || inputString === '$') return 0;
  
  // Clean all characters except digits and decimal point
  const clean = inputString.replace(/[^0-9.]/g, '');
  if (!clean) return 0;
  
  if (!clean.includes('.')) {
    // If no decimal point, just parse the entire clean string as integer
    return parseInt(clean, 10) || 0;
  }
  
  const parts = clean.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  if (decimalPart === '00') {
    return parseInt(integerPart, 10) || 0;
  }
  
  if (decimalPart.length < 2) {
    return Math.floor((parseInt(integerPart, 10) || 0) / 10);
  }
  
  if (decimalPart.length > 2) {
    const extra = decimalPart.substring(2);
    const newIntegerStr = integerPart + extra;
    return parseInt(newIntegerStr, 10) || 0;
  }
  
  return parseInt(integerPart, 10) || 0;
};

interface CustomSelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  /** Optional ref to the scroll container — used to scroll-into-view before opening */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  scrollContainerRef,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on scroll of the form container
  useEffect(() => {
    if (!isOpen) return;
    const el = scrollContainerRef?.current;
    if (!el) return;
    const handleScroll = () => setIsOpen(false);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isOpen, scrollContainerRef]);

  const MENU_MAX_H = 208; // px — matches max-h-52
  const SPACE_THRESHOLD = 12; // px of breathing room

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) { setIsOpen(true); return; }

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - SPACE_THRESHOLD;
    const spaceAbove = rect.top - SPACE_THRESHOLD;
    const needsUp = spaceBelow < MENU_MAX_H && spaceAbove > spaceBelow;

    if (needsUp) {
      // Open upward — anchor bottom of menu to top of trigger
      setDropUp(true);
      setMenuStyle({
        position: 'fixed',
        top: 'auto',
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      // Open downward — if not enough space, scroll the container first
      setDropUp(false);
      if (spaceBelow < MENU_MAX_H && scrollContainerRef?.current) {
        const needed = MENU_MAX_H - spaceBelow;
        scrollContainerRef.current.scrollBy({ top: needed + 16, behavior: 'smooth' });
      }
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        bottom: 'auto',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setIsOpen(true);
  };

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none flex items-center justify-between text-left cursor-pointer hover:border-brand-gray-400 transition-all text-brand-black"
      >
        <span>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-brand-gray-400 transition-transform duration-200 ${isOpen ? (dropUp ? '' : 'rotate-180') : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            style={menuStyle}
            className="max-h-52 overflow-y-auto bg-white border border-brand-gray-200 rounded-xl shadow-premium no-scrollbar"
          >
            <div className="p-1 flex flex-col gap-0.5">
              {options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    option.value === value
                      ? 'bg-brand-black text-white'
                      : 'hover:bg-brand-gray-50 text-brand-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PropertyWizardModal({ isOpen, onClose, onSubmit, initialData, onDelete }: PropertyWizardModalProps) {
  const { t, language } = useTranslation();
  const { currentUser } = useSwap();
  const [step, setStep] = useState<WizardStep>(0);

  const [localDeleteConfirm, setLocalDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supabaseError, setSupabaseError] = useState<{ message: string; code?: string; details?: string; hint?: string } | null>(null);


  // Swap limits
  const [swapMinValue, setSwapMinValue] = useState<number | ''>('');
  const [swapMaxValue, setSwapMaxValue] = useState<number | ''>('');

  // ── Scroll Navigation ──────────────────────────────────────────────────────
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [scrollInfo, setScrollInfo] = useState({
    canScrollUp: false,
    canScrollDown: false,
    scrollPct: 0,
    hasOverflow: false,
  });
  const [hasReviewedAll, setHasReviewedAll] = useState(false);

  // Single persistent scroll tracker — survives step changes and dynamic content
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    let rafId: number;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const pct = maxScroll > 0 ? scrollTop / maxScroll : 1;
      const atBottom = scrollTop >= maxScroll - 12;
      setScrollInfo({
        canScrollUp: scrollTop > 8,
        canScrollDown: !atBottom && maxScroll > 8,
        scrollPct: pct,
        hasOverflow: maxScroll > 8,
      });
      if (atBottom && maxScroll > 8) setHasReviewedAll(true);
    };

    // Debounced rAF update so rapid DOM mutations don't thrash state
    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    el.addEventListener('scroll', scheduleUpdate, { passive: true });

    // ResizeObserver on the container itself — catches viewport/layout changes
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);

    // MutationObserver on the subtree — catches content added/removed inside steps
    const mo = new MutationObserver(scheduleUpdate);
    mo.observe(el, { childList: true, subtree: true, attributes: false, characterData: false });

    // Initial measurement (use rAF so Framer Motion animations have a chance to start)
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', scheduleUpdate);
      ro.disconnect();
      mo.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← runs ONCE on mount, observers stay alive for the full modal lifetime

  // On step change: scroll to top and reset "reviewed all" flag
  useEffect(() => {
    setHasReviewedAll(false);
    if (step === 11) {
      console.log('[GeoTrace] [Fase D] Entrando a Step 11. Coordenadas en estado:', { latitude, longitude });
    }
    // Small delay so Framer Motion can swap content before we measure
    const id = setTimeout(() => {
      const el = scrollAreaRef.current;
      if (el) {
        el.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        // Force a re-measurement after the animation frame
        requestAnimationFrame(() => {
          const { scrollTop, scrollHeight, clientHeight } = el;
          const maxScroll = Math.max(0, scrollHeight - clientHeight);
          const atBottom = scrollTop >= maxScroll - 12;
          setScrollInfo({
            canScrollUp: false,
            canScrollDown: !atBottom && maxScroll > 8,
            scrollPct: 0,
            hasOverflow: maxScroll > 8,
          });
        });
      }
    }, 80); // 80 ms — Framer exit+enter is 150ms total, this runs mid-animation
    return () => clearTimeout(id);
  }, [step]);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('aura-custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'aura-custom-toast';
    toast.className = `fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-floating border text-xs font-black animate-slide-up ${
      type === 'success' 
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
        : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
    }`;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-all', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // STEP 0: Publisher Type
  const [publisherType, setPublisherType] = useState<'owner' | 'broker' | 'developer' | 'property_manager'>('owner');

  // STEP 1: Offerings Selection
  const [selectedModes, setSelectedModes] = useState<PropertyOfferingMode[]>([]);
  const [activeConfigTab, setActiveConfigTab] = useState<PropertyOfferingMode>('SWAP');

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
  const [subtitle, setSubtitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<UIType>('Departamento');
  const [developmentName, setDevelopmentName] = useState('');
  const [valueRating, setValueRating] = useState<'Premium' | 'Luxury' | 'Exclusive' | 'Curated'>('Premium');

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
  
  // Location Details
  const [neighborhood, setNeighborhood] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [locationReference, setLocationReference] = useState('');
  const [showPublicAddress, setShowPublicAddress] = useState(true);

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
  const [legalDebtFree, setLegalDebtFree] = useState(true);
  const [legalPublicDeed, setLegalPublicDeed] = useState(true);
  const [legalTaxCurrent, setLegalTaxCurrent] = useState(true);
  const [legalServicesPaid, setLegalServicesPaid] = useState(true);
  const [legalOwnerType, setLegalOwnerType] = useState('Privada');
  const [legalIsMortgaged, setLegalIsMortgaged] = useState(false);

  // Expanded Legal & Appraisal & Commercial fields
  const [legalLienType, setLegalLienType] = useState<string>('Banco');
  const [legalLienObservations, setLegalLienObservations] = useState<string>('');
  const [legalRegime, setLegalRegime] = useState<string>('Propiedad Privada');
  const [legalLandUse, setLegalLandUse] = useState<string>('Residencial');
  const [legalRestrictions, setLegalRestrictions] = useState<string>('');
  const [legalDocumentationComplete, setLegalDocumentationComplete] = useState<boolean>(true);
  const [legalJuridicalResponsible, setLegalJuridicalResponsible] = useState<string>('Lic. Alejandro Ruiz');
  const [legalLastUpdate, setLegalLastUpdate] = useState<string>('');

  const [appraisalAmount, setAppraisalAmount] = useState<number | ''>('');
  const [appraisalDate, setAppraisalDate] = useState<string>('');
  const [appraisalExpert, setAppraisalExpert] = useState<string>('');
  const [appraisalValidity, setAppraisalValidity] = useState<string>('');

  const [appreciationLevel, setAppreciationLevel] = useState<'Alta' | 'Media' | 'Baja' | 'En desarrollo'>('Media');
  const [commercialStatus, setCommercialStatus] = useState<string>('Disponible');

  // Operation specific new fields - VENTA
  const [valuationAmount, setValuationAmount] = useState<number | ''>('');
  const [catastralValue, setCatastralValue] = useState<number | ''>('');
  const [condoRegime, setCondoRegime] = useState(false);
  const [maintenanceFee, setMaintenanceFee] = useState<number | ''>('');

  // Operation specific new fields - RENTA
  const [advanceMonths, setAdvanceMonths] = useState<number>(1);
  const [requiresGuarantor, setRequiresGuarantor] = useState(false);
  const [requiresLegalPolicy, setRequiresLegalPolicy] = useState(false);
  const [acceptsPets, setAcceptsPets] = useState(true);
  const [isFurnished, setIsFurnished] = useState(false);
  const [includesServices, setIncludesServices] = useState(false);
  const [includesMaintenance, setIncludesMaintenance] = useState(true);
  const [rentRules, setRentRules] = useState('');

  // Operation specific new fields - SWAP
  const [swapMaxCashDiff, setSwapMaxCashDiff] = useState<number | ''>('');
  const [swapAcceptsVehicle, setSwapAcceptsVehicle] = useState(false);
  const [swapAcceptsLand, setSwapAcceptsLand] = useState(false);
  const [swapAcceptsDept, setSwapAcceptsDept] = useState(true);
  const [swapAcceptsHouse, setSwapAcceptsHouse] = useState(true);
  const [swapAcceptsCash, setSwapAcceptsCash] = useState(true);
  const [swapPriority, setSwapPriority] = useState<'Alta' | 'Media' | 'Baja'>('Media');

  // STEP 7: Media & Gallery
  const [images, setImages] = useState<string[]>([]);
  const [imagesMetadata, setImagesMetadata] = useState<Record<string, any>>({});
  const [videoPlaceholder, setVideoPlaceholder] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [virtualTourPlaceholder, setVirtualTourPlaceholder] = useState('');

  // STEP 8: Commercial & SEO
  const [isExclusive, setIsExclusive] = useState(false);
  const [commissionTotalPct, setCommissionTotalPct] = useState<number | ''>('');
  const [commissionSharedPct, setCommissionSharedPct] = useState<number | ''>('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // STEP 3: Dynamic Pricing Settings
  // Swap settings
  const [swapValueTier, setSwapValueTier] = useState<'Premium' | 'Luxury' | 'Exclusive' | 'Curated'>('Premium');
  const [swapAvailableStart, setSwapAvailableStart] = useState('2026-06-01');
  const [swapAvailableEnd, setSwapAvailableEnd] = useState('2026-12-31');
  const [swapPreferences, setSwapPreferences] = useState('');

  // Short rent settings
  const [nightlyPrice, setNightlyPrice] = useState(150);
  const [weeklyPrice, setWeeklyPrice] = useState(900);
  const [shortMinNights, setShortMinNights] = useState(2);
  const [shortDeposit, setShortDeposit] = useState(300);

  // Monthly rent settings
  const [monthlyPrice, setMonthlyPrice] = useState(2500);
  const [monthlyDeposit, setMonthlyDeposit] = useState(2000);
  const [monthlyContract, setMonthlyContract] = useState(true);

  // Sale settings
  const [salePrice, setSalePrice] = useState(450000);
  const [saleCurrency, setSaleCurrency] = useState('USD');
  const [saleAcceptsOffers, setSaleAcceptsOffers] = useState(true);

  // AI Enhancer state
  const [isImprovingTitle, setIsImprovingTitle] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [descriptionOptions, setDescriptionOptions] = useState<string[]>([]);

  // Analytics Metric Tracker Helper
  const trackMetric = (eventName: string, payload: any = {}) => {
    console.info(`[AnalyticsEvent] ${eventName}`, payload);
    try {
      const stored = localStorage.getItem('aura_wizard_metrics');
      const list = stored ? JSON.parse(stored) : [];
      list.push({ eventName, payload, timestamp: new Date().toISOString() });
      localStorage.setItem('aura_wizard_metrics', JSON.stringify(list));
    } catch (e) {
      console.error('[Analytics] Local storage error:', e);
    }
  };

  // Helper to parse Gemini options safely (supports JSON array or line-based text)
  const parseAIOptions = (text: string, count: number): string[] => {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    try {
      const parsed = JSON.parse(cleaned.trim());
      if (Array.isArray(parsed)) {
        return parsed.map(o => String(o).trim()).filter(Boolean).slice(0, count);
      }
    } catch (e) {
      console.warn('[parseAIOptions] JSON parse failed, falling back to line regex parser', e);
    }

    const lines = text.split(/\r?\n/);
    const options: string[] = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      let cleanLine = line
        .replace(/^###?\s*(Opción|Option|Versión|Version)?\s*\d+\s*:?\s*/i, '')
        .replace(/^\d+\s*[\.\)-]\s*/, '')
        .replace(/^[\*-]\s*/, '')
        .trim();
      cleanLine = cleanLine.replace(/^["']|["']$/g, '').trim();
      if (cleanLine && cleanLine.length > 5 && !cleanLine.toLowerCase().includes('texto original') && !cleanLine.toLowerCase().includes('reglas:')) {
        options.push(cleanLine);
      }
    }
    return options.length > 0 ? options.slice(0, count) : [];
  };

  // Fallback lists if API fails
  const getTitleFallbackOptions = (original: string): string[] => {
    let base = original.trim();
    if (base.length > 0) {
      base = base.charAt(0).toUpperCase() + base.slice(1);
    }
    base = base.replace(/([!?\.])\1+/g, '$1').replace(/\s+/g, ' ');
    return [
      base,
      `Excelente oportunidad: ${base}`,
      `Residencia ideal en venta - ${base}`,
      `${base} en zona residencial tranquila`,
      `${base} con excelente plusvalía`
    ].map(o => o.slice(0, 80));
  };

  const getDescriptionFallbackOptions = (original: string): string[] => {
    let base = original.trim();
    base = base.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
    base = base.replace(/([!?\.])\1+/g, '$1').replace(/\s+/g, ' ');
    return [
      base,
      `${base} Excelente distribución y ubicación cercana a servicios principales.`,
      `${base} Un espacio único diseñado para brindar comodidad y tranquilidad.`
    ].map(v => {
      const words = v.split(/\s+/);
      return words.length > 120 ? words.slice(0, 120).join(' ') + '...' : v;
    });
  };

  const handleImproveTitle = async () => {
    if (!title.trim()) return;
    setIsImprovingTitle(true);
    setTitleOptions([]);
    trackMetric('ai_title_improve_clicked', { originalText: title });

    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: title, type: 'title' })
      });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      if (!data.reply) throw new Error('Empty API response');
      const parsed = parseAIOptions(data.reply, 5);
      if (parsed.length === 0) throw new Error('Parsing returned zero options');
      setTitleOptions(parsed);
    } catch (e) {
      console.warn('[PropertyWizardModal] Title AI enhancement failed, running local fallback:', e);
      setTitleOptions(getTitleFallbackOptions(title));
    } finally {
      setIsImprovingTitle(false);
    }
  };

  const handleImproveDescription = async () => {
    if (!description.trim()) return;
    setIsImprovingDescription(true);
    setDescriptionOptions([]);
    trackMetric('ai_description_improve_clicked', { originalText: description });

    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, type: 'description' })
      });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      if (!data.reply) throw new Error('Empty API response');
      const parsed = parseAIOptions(data.reply, 3);
      if (parsed.length === 0) throw new Error('Parsing returned zero versions');
      setDescriptionOptions(parsed);
    } catch (e) {
      console.warn('[PropertyWizardModal] Description AI enhancement failed, running local fallback:', e);
      setDescriptionOptions(getDescriptionFallbackOptions(description));
    } finally {
      setIsImprovingDescription(false);
    }
  };

  const handleSelectTitleOption = (opt: string) => {
    setTitle(opt);
    setTitleOptions([]);
    trackMetric('ai_title_option_selected', { selectedText: opt });
  };

  const handleSelectDescriptionOption = (opt: string) => {
    setDescription(opt);
    setDescriptionOptions([]);
    trackMetric('ai_description_option_selected', { selectedText: opt });
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
      setLatitude(initialData.latitude !== undefined && initialData.latitude !== null ? Number(initialData.latitude) : null);
      setLongitude(initialData.longitude !== undefined && initialData.longitude !== null ? Number(initialData.longitude) : null);
      setPlaceId(initialData.placeId || null);
      setFormattedAddress(initialData.formattedAddress || null);
      setCity(savedCity || null);
      setStateName(initialData.state || null);
      setGeometrySource(initialData.geometrySource || null);
      setBedrooms(initialData.bedrooms || 2);
      setBathrooms(initialData.bathrooms || 2);
      setHalfBathrooms(Number(initialData.metadata?.halfBathrooms) || 0);
      setMaxGuests(initialData.maxGuests || 4);
      setSelectedAmenities(initialData.amenities || []);
      setCustomAmenities(initialData.metadata?.customAmenities || []);
      setImages(initialData.images || []);
      setImagesMetadata(initialData.metadata?.imagesMetadata || {});
      
      const loadedVideoUrl = initialData.media?.find(m => m.mediaType === 'VIDEO')?.url || initialData.metadata?.videoUrl || '';
      const loadedYoutubeUrl = initialData.media?.find(m => m.mediaType === 'YOUTUBE' || m.mediaType === 'VIMEO')?.url || initialData.metadata?.videoPlaceholder || '';
      const loadedVirtualTour = initialData.media?.find(m => m.mediaType === 'MATTERPORT' || m.mediaType === 'VIRTUAL_TOUR')?.url || initialData.metadata?.virtualTourPlaceholder || '';

      setVideoUrl(loadedVideoUrl);
      setVideoPlaceholder(loadedYoutubeUrl);
      setVirtualTourPlaceholder(loadedVirtualTour);
      
      const modes = (initialData.offerings || []).map(o => o.mode);
      if (modes.length > 0) {
        setSelectedModes(modes);
        setActiveConfigTab(modes[0]);
      }

      // Populate Step 5 fields from offerings
      const swapOff = initialData.offerings?.find(o => o.mode === 'SWAP');
      if (swapOff) {
        setSwapValueTier((swapOff.swapValueTier as any) || 'Premium');
        setSwapAvailableStart(swapOff.availableFrom || '2026-06-01');
        setSwapAvailableEnd(swapOff.availableUntil || '2026-12-31');
        setSwapPreferences(typeof swapOff.swapPreferences?.text === 'string' ? swapOff.swapPreferences.text : '');
        setSwapMinValue(swapOff.swapMinValue || '');
        setSwapMaxValue(swapOff.swapMaxValue || '');
      }

      const shortOff = initialData.offerings?.find(o => o.mode === 'SHORT_RENT');
      if (shortOff) {
        setNightlyPrice(shortOff.priceAmount || 150);
        setShortMinNights(shortOff.minNights || 2);
        setShortDeposit(shortOff.securityDepositAmount || 300);
        setWeeklyPrice(Number(shortOff.metadata?.weeklyPrice) || 900);
      }

      const monthlyOff = initialData.offerings?.find(o => o.mode === 'MONTHLY_RENT');
      if (monthlyOff) {
        setMonthlyPrice(monthlyOff.priceAmount || 2500);
        setMonthlyDeposit(monthlyOff.securityDepositAmount || 2000);
        setMonthlyContract(monthlyOff.metadata?.requiresContract !== false);
      }

      const saleOff = initialData.offerings?.find(o => o.mode === 'SALE');
      if (saleOff) {
        setSalePrice(saleOff.priceAmount || 450000);
        setSaleCurrency(saleOff.currency || 'USD');
        setSaleAcceptsOffers(saleOff.acceptsOffers !== false);
      }
      
      // Venta Extra
      setValuationAmount(initialData.metadata?.valuationAmount || '');
      setCatastralValue(initialData.metadata?.catastralValue || '');
      setCondoRegime(!!initialData.metadata?.condoRegime);
      setMaintenanceFee(initialData.metadata?.maintenanceFee || '');

      // Expanded Legal & Appraisal & Commercial fields load
      setLegalLienType(initialData.legalLienType || 'Banco');
      setLegalLienObservations(initialData.legalLienObservations || '');
      setLegalRegime(initialData.legalRegime || initialData.legalOwnerType || 'Propiedad Privada');
      setLegalLandUse(initialData.legalLandUse || 'Residencial');
      setLegalRestrictions(initialData.legalRestrictions || '');
      setLegalDocumentationComplete(initialData.legalDocumentationComplete ?? true);
      setLegalJuridicalResponsible(initialData.legalJuridicalResponsible || 'Lic. Alejandro Ruiz');
      setLegalLastUpdate(initialData.legalLastUpdate || '');
      setAppraisalAmount(initialData.appraisalAmount || '');
      setAppraisalDate(initialData.appraisalDate || '');
      setAppraisalExpert(initialData.appraisalExpert || '');
      setAppraisalValidity(initialData.appraisalValidity || '');
      setAppreciationLevel(initialData.appreciationLevel || 'Media');
      setCommercialStatus(initialData.commercialStatus || 'Disponible');

      // Renta Extra
      setAdvanceMonths(initialData.metadata?.advanceMonths || 1);
      setRequiresGuarantor(!!initialData.metadata?.requiresGuarantor);
      setRequiresLegalPolicy(!!initialData.metadata?.requiresLegalPolicy);
      setAcceptsPets(initialData.metadata?.acceptsPets !== false);
      setIsFurnished(!!initialData.metadata?.isFurnished);
      setIncludesServices(!!initialData.metadata?.includesServices);
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
      setStep(1); // Skip Step 0 when editing
    } else {
      // Reset to defaults
      setStep(0);
      setPublisherType('owner');
      setSelectedModes([]);
      setActiveConfigTab('SWAP');
      setTitle('');
      setDescription('');
      
      // Venta reset
      setValuationAmount('');
      setCatastralValue('');
      setCondoRegime(false);
      setMaintenanceFee('');

      // Expanded Legal & Appraisal & Commercial fields reset
      setLegalLienType('Banco');
      setLegalLienObservations('');
      setLegalRegime('Propiedad Privada');
      setLegalLandUse('Residencial');
      setLegalRestrictions('');
      setLegalDocumentationComplete(true);
      setLegalJuridicalResponsible('Lic. Alejandro Ruiz');
      setLegalLastUpdate('');
      setAppraisalAmount('');
      setAppraisalDate('');
      setAppraisalExpert('');
      setAppraisalValidity('');
      setAppreciationLevel('Media');
      setCommercialStatus('Disponible');
      // Renta reset
      setAdvanceMonths(1);
      setRequiresGuarantor(false);
      setRequiresLegalPolicy(false);
      setAcceptsPets(true);
      setIsFurnished(false);
      setIncludesServices(false);
      setIncludesMaintenance(true);
      setRentRules('');
      // Swap reset
      setSwapMaxCashDiff('');
      setSwapAcceptsVehicle(false);
      setSwapAcceptsLand(false);
      setSwapAcceptsDept(true);
      setSwapAcceptsHouse(true);
      setSwapAcceptsCash(true);
      setSwapPriority('Media');
      setSwapMinValue('');
      setSwapMaxValue('');
      setType('Departamento');
      setLocation('');
      setCountry('');
      setAddress('');
      setLatitude(null);
      setLongitude(null);
      setPlaceId(null);
      setFormattedAddress(null);
      setCity(null);
      setStateName(null);
      setGeometrySource(null);
      setBedrooms(2);
      setBathrooms(2);
      setHalfBathrooms(0);
      setMaxGuests(4);
      setSelectedAmenities([]);
      setCustomAmenities([]);
      setImages([]);
      setImagesMetadata({});
      setVideoPlaceholder('');
      setVideoUrl('');
      setVirtualTourPlaceholder('');
    }
  }, [initialData, isOpen]);

  // Auto-save to localStorage
  useEffect(() => {
    // Only auto-save if we are in draft mode and not publishing/submitting
    if (!isOpen || !!initialData) return;
    
    const draftData = {
      publisherType,
      selectedModes,
      title,
      shortDescription,
      type,
      location,
      country,
      address,
      latitude,
      longitude,
      placeId,
      formattedAddress,
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
      maxGuests,
      selectedAmenities,
      customAmenities,
      images,
      imagesMetadata,
      videoPlaceholder,
      virtualTourPlaceholder,
      isExclusive,
      commissionTotalPct,
      commissionSharedPct,
      // prices
      salePrice,
      saleCurrency,
      saleAcceptsOffers,
      monthlyPrice,
      monthlyDeposit,
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
      isFurnished,
      includesServices,
      includesMaintenance,
      rentRules,
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
      commercialStatus
    };

    console.log('[GeoTrace] [Fase C] Guardando borrador en localStorage con coordenadas:', { latitude: draftData.latitude, longitude: draftData.longitude });
    localStorage.setItem('auraswap_draft_property', JSON.stringify(draftData));
  }, [
    isOpen,
    initialData,
    publisherType,
    selectedModes,
    title,
    shortDescription,
    type,
    location,
    country,
    address,
    latitude,
    longitude,
    placeId,
    formattedAddress,
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
    maxGuests,
    selectedAmenities,
    customAmenities,
    images,
    imagesMetadata,
    videoPlaceholder,
    virtualTourPlaceholder,
    isExclusive,
    commissionTotalPct,
    commissionSharedPct,
    salePrice,
    saleCurrency,
    saleAcceptsOffers,
    monthlyPrice,
    monthlyDeposit,
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
    isFurnished,
    includesServices,
    includesMaintenance,
    rentRules,
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
    commercialStatus
  ]);

  // Load draft check on modal mount or open
  useEffect(() => {
    if (isOpen && !initialData) {
      const savedDraft = localStorage.getItem('auraswap_draft_property');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          console.log('[GeoTrace] [Fase C] Borrador cargado desde localStorage con coordenadas:', { latitude: parsed.latitude, longitude: parsed.longitude });
          if (parsed.title || parsed.location) {
            // Auto restore draft
            if (parsed.publisherType) setPublisherType(parsed.publisherType);
            if (parsed.selectedModes) setSelectedModes(parsed.selectedModes);
            if (parsed.title) setTitle(parsed.title);
            if (parsed.shortDescription) setShortDescription(parsed.shortDescription);
            if (parsed.type) setType(parsed.type);
            if (parsed.location) setLocation(parsed.location);
            if (parsed.country) setCountry(parsed.country);
            if (parsed.address) setAddress(parsed.address);
            if (parsed.latitude) setLatitude(parsed.latitude);
            if (parsed.longitude) setLongitude(parsed.longitude);
            if (parsed.placeId) setPlaceId(parsed.placeId);
            if (parsed.formattedAddress) setFormattedAddress(parsed.formattedAddress);
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
            if (parsed.maxGuests) setMaxGuests(parsed.maxGuests);
            if (parsed.selectedAmenities) setSelectedAmenities(parsed.selectedAmenities);
            if (parsed.customAmenities) setCustomAmenities(parsed.customAmenities);
            if (parsed.images) setImages(parsed.images);
            if (parsed.imagesMetadata) setImagesMetadata(parsed.imagesMetadata);
            if (parsed.videoPlaceholder) setVideoPlaceholder(parsed.videoPlaceholder);
            if (parsed.virtualTourPlaceholder) setVirtualTourPlaceholder(parsed.virtualTourPlaceholder);
            if (parsed.isExclusive !== undefined) setIsExclusive(parsed.isExclusive);
            if (parsed.commissionTotalPct !== undefined) setCommissionTotalPct(parsed.commissionTotalPct);
            if (parsed.commissionSharedPct !== undefined) setCommissionSharedPct(parsed.commissionSharedPct);
            if (parsed.salePrice) setSalePrice(parsed.salePrice);
            if (parsed.saleCurrency) setSaleCurrency(parsed.saleCurrency);
            if (parsed.saleAcceptsOffers !== undefined) setSaleAcceptsOffers(parsed.saleAcceptsOffers);
            if (parsed.monthlyPrice) setMonthlyPrice(parsed.monthlyPrice);
            if (parsed.monthlyDeposit) setMonthlyDeposit(parsed.monthlyDeposit);
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
            if (parsed.isFurnished !== undefined) setIsFurnished(parsed.isFurnished);
            if (parsed.includesServices !== undefined) setIncludesServices(parsed.includesServices);
            if (parsed.includesMaintenance !== undefined) setIncludesMaintenance(parsed.includesMaintenance);
            if (parsed.rentRules) setRentRules(parsed.rentRules);
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
    }
  }, [isOpen, initialData, language]);
  const getListingQuality = () => {
    let score = 0;
    const suggestions: string[] = [];

    if (title && title.length >= 10) {
      score += 15;
    } else {
      suggestions.push("Agrega un título descriptivo (mín. 10 caracteres).");
    }

    if (shortDescription && shortDescription.length >= 30) {
      score += 15;
    } else {
      suggestions.push("Escribe un resumen más detallado (mín. 30 caracteres).");
    }

    if (location && country) {
      score += 15;
    } else {
      suggestions.push("Especifica la ubicación y dirección completa.");
    }

    if (selectedModes.length > 0) {
      score += 10;
    } else {
      suggestions.push("Selecciona al menos una modalidad comercial.");
    }

    if (images.length >= 5) {
      score += 20;
    } else if (images.length > 0) {
      score += 10;
      suggestions.push("Sube al menos 5 imágenes para mejorar el anuncio.");
    } else {
      suggestions.push("Sube fotografías de tu propiedad.");
    }

    if (selectedAmenities.length + customAmenities.length >= 5) {
      score += 15;
    } else if (selectedAmenities.length + customAmenities.length > 0) {
      score += 8;
      suggestions.push("Marca más amenidades del espacio.");
    } else {
      suggestions.push("Agrega amenidades para destacar tu propiedad.");
    }

    if (videoPlaceholder) {
      score += 5;
    } else {
      suggestions.push("Agrega un video del inmueble (opcional).");
    }

    if (virtualTourPlaceholder) {
      score += 5;
    } else {
      suggestions.push("Agrega un recorrido virtual 3D (opcional).");
    }

    return { score, suggestions };
  };

  const { score: qualityScore, suggestions: qualitySuggestions } = getListingQuality();

  const getPreviewPriceLabel = () => {
    if (selectedModes.includes('SALE')) {
      return `$${Number(salePrice || 0).toLocaleString()} ${saleCurrency}`;
    }
    if (selectedModes.includes('SHORT_RENT')) {
      return `$${nightlyPrice} USD / noche`;
    }
    if (selectedModes.includes('MONTHLY_RENT')) {
      return `$${monthlyPrice} USD / mes`;
    }
    if (selectedModes.includes('SWAP')) {
      return `Intercambio / Swap`;
    }
    return '$---';
  };

  if (!isOpen) return null;

  const toggleMode = (mode: PropertyOfferingMode) => {
    setSelectedModes(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode)
        : [...prev, mode]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const stepsConfig: WizardStepConfig[] = [
    { id: 0, label: 'Identidad', description: 'Perfil de publicación', isVisible: true, estTimeMinutes: 0.5 },
    { id: 1, label: 'Información Básica', description: 'Título y resumen', isVisible: true, estTimeMinutes: 1 },
    { id: 2, label: 'Ubicación', description: 'Ubicación de la propiedad', isVisible: true, estTimeMinutes: 1 },
    { id: 3, label: 'Operación', description: 'Canales de comercialización', isVisible: true, estTimeMinutes: 0.5 },
    { id: 4, label: 'Características', description: 'Distribución y superficies', isVisible: true, estTimeMinutes: 1 },
    { id: 5, label: 'Amenidades', description: 'Equipamiento y servicios', isVisible: true, estTimeMinutes: 1 },
    { id: 6, label: 'Preferencias Swap', description: 'Configuración de intercambio', isVisible: selectedModes.includes('SWAP'), estTimeMinutes: 1.5 },
    { id: 7, label: 'Condiciones de Renta', description: 'Precios y plazos de renta', isVisible: selectedModes.includes('RENT' as any) || selectedModes.includes('SHORT_RENT') || selectedModes.includes('MONTHLY_RENT'), estTimeMinutes: 1.5 },
    { id: 8, label: 'Términos de Venta', description: 'Precios y legal de venta', isVisible: selectedModes.includes('SALE'), estTimeMinutes: 1.5 },
    { id: 9, label: 'Multimedia', description: 'Galería de fotos y video', isVisible: true, estTimeMinutes: 1 },
    { id: 10, label: 'Esquema Comercial', description: 'Exclusividad y comisiones', isVisible: true, estTimeMinutes: 1 },
    { id: 11, label: 'Vista Previa', description: 'Revisión final', isVisible: true, estTimeMinutes: 1 }
  ];

  const activeSteps = stepsConfig.filter(s => s.isVisible);
  const totalActiveSteps = activeSteps.length;
  const currentActiveIndex = activeSteps.findIndex(s => s.id === step);
  const progressPercentage = totalActiveSteps > 1 ? Math.round((currentActiveIndex / (totalActiveSteps - 1)) * 100) : 100;
  const remainingStepsCount = totalActiveSteps - 1 - currentActiveIndex;
  const remainingTimeMinutes = activeSteps
    .slice(currentActiveIndex + 1)
    .reduce((sum, s) => sum + s.estTimeMinutes, 0);

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

  const applyGoogleAddress = (result: GoogleAddressResult) => {
    setPlaceId(result.placeId);
    setFormattedAddress(result.formattedAddress);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setGeometrySource('google_places');
    if (result.city) {
      setCity(result.city);
      setLocation(result.city);
    }
    if (result.state) setStateName(result.state);
    if (result.country) setCountry(result.country);
    if (result.neighborhood) setNeighborhood(result.neighborhood);
    if (result.postalCode) setPostalCode(result.postalCode);
    if (result.streetName) setStreetName(result.streetName);
    if (result.streetNumber) setStreetNumber(result.streetNumber);
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

    let currentLat = latitude;
    let currentLng = longitude;

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

    // Map form selections back into normalized offerings
    const offerings: PropertyOffering[] = selectedModes.map(mode => {
      const existing = initialData?.offerings?.find(o => o.mode === mode);
      
      const baseOffering = {
        id: existing?.id || `offering-${mode}-${initialData?.id || 'new'}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        propertyId: initialData?.id || '',
        mode,
        status: existing?.status || (initialData?.isPublished === false ? 'PAUSED' : 'ACTIVE'),
        visibility: existing?.visibility || 'PUBLIC',
        title,
        description,
        currency: 'USD',
        billingPeriod: mode === 'SALE' ? 'TOTAL' : (mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT'),
        swapValueTier: mode === 'SWAP' ? swapValueTier : null,
        availableFrom: mode === 'SWAP' ? swapAvailableStart : (existing?.availableFrom || swapAvailableStart),
        availableUntil: mode === 'SWAP' ? swapAvailableEnd : (existing?.availableUntil || swapAvailableEnd),
        isFeatured: existing?.isFeatured || false,
        featuredRank: existing?.featuredRank || 0,
        metadata: existing?.metadata || {},
      } as PropertyOffering;

      if (mode === 'SWAP') {
        return {
          ...baseOffering,
          swapEstimatedValue: Number(salePrice) || 0,
          desiredExchange: swapPreferences,
          swapMinValue: Number(salePrice) * 0.8,
          swapMaxValue: Number(salePrice) * 1.2,
          swapCashDifferenceAllowed: true,
          swapPreferences: { text: swapPreferences },
          auraScoreOverride: existing?.auraScoreOverride || initialData?.auraScore || 95
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
          depositAmount: monthlyDeposit,
          requiresGuarantor: true,
          requiresLegalPolicy: true,
          securityDepositAmount: monthlyDeposit,
          metadata: {
            ...baseOffering.metadata,
            requiresContract: monthlyContract
          }
        };
      } else if (mode === 'SALE') {
        return {
          ...baseOffering,
          priceAmount: salePrice,
          currency: saleCurrency,
          acceptsBankCredit: true,
          acceptsInfonavit: true,
          acceptsFovissste: true,
          acceptsOffers: saleAcceptsOffers
        };
      }
      return baseOffering;
    });

    const compiledPropertyData = {
      title,
      subtitle,
      shortDescription,
      description,
      type: mapUiToDbType(type),
      developmentName,
      location,
      country,
      address,
      latitude: latitude ?? 0.0,
      longitude: longitude ?? 0.0,
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
      appreciationLevel,
      commercialStatus: commercialStatus as any,
      servicesWater: true,
      servicesElectricity: true,
      servicesSewerage: true,
      servicesNatGas: false,
      servicesLpGas: true,
      servicesInternet: 'Fiber Optic',
      servicesGarbage: true,
      securityCctv: selectedAmenities.includes('Domótica'),
      securityGuardhouse: selectedAmenities.includes('Seguridad 24/7'),
      security24_7: selectedAmenities.includes('Seguridad 24/7'),
      securityBiometric: selectedAmenities.includes('Cerradura inteligente'),
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'],
      valueRating: selectedModes.includes('SWAP') ? swapValueTier : 'Premium',
      availableStart: selectedModes.includes('SWAP') ? swapAvailableStart : '2026-06-01',
      availableEnd: selectedModes.includes('SWAP') ? swapAvailableEnd : '2026-12-31',
      offerings,
      desiredExchange: swapPreferences,
      isDemo: initialData?.isDemo ?? false,
      folderStatus: 'DRAFT' as any,
      metaTitle: metaTitle || (title ? `${title} | AuraSwap` : ''),
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

        // 2. Add local video if exists
        if (videoUrl) {
          list.push({
            mediaType: 'VIDEO',
            url: videoUrl,
            displayOrder: order++,
            isPrimary: false,
            metadata: {}
          });
        }

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
        isFurnished,
        includesServices,
        includesMaintenance,
        rentRules,
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
      setValidationError("La propiedad aún no puede publicarse. Revisa los errores marcados abajo.");
      setTimeout(scrollToError, 80);
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('[Publish] Step 4: Enviando payload a onSubmit (SwapContext)...');
      await onSubmit(compiledPropertyData);
      console.log('[Publish] Step 5: ¡Publicación exitosa!');
      localStorage.removeItem('auraswap_draft_property');
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="absolute inset-0 bg-brand-black/45 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-full max-w-5xl bg-white rounded-3xl p-6 md:p-8 shadow-floating border border-brand-gray-200/60 overflow-hidden flex flex-col md:grid md:grid-cols-12 gap-8 md:h-[90vh] md:max-h-[860px] md:min-h-[580px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Close button */}
          <button 
            onClick={() => {
              console.log('[WIZARD CLOSE] X clicked');
              console.log('[WIZARD CLOSE] calling onClose');
              onClose();
            }}
            className="absolute top-4 right-4 text-brand-gray-400 hover:text-brand-black hover:bg-brand-gray-50 p-2 rounded-xl transition-all cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>

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

          {/* LEFT COLUMN: Visual Preview & Context (5 cols) */}
          <div className="hidden md:flex md:col-span-5 flex-col justify-between border-r border-brand-gray-100 pr-8 py-4 select-none md:h-full md:min-h-0">
            <div className="flex flex-col gap-6 md:min-h-0 md:flex-1 justify-start">
              <div>
                <h3 className="text-xl font-black text-brand-black leading-tight">
                  {initialData ? 'Actualizar Propiedad' : 'Publicar Nuevo Alojamiento'}
                </h3>
                <p className="text-xs text-brand-gray-500 mt-1.5 leading-relaxed font-medium">
                  Configura tu hogar y activa múltiples canales comerciales al instante sin fricción.
                </p>
              </div>

              {/* Real-time Listing Card Preview */}
              <div className="border border-brand-gray-200/80 rounded-2xl overflow-hidden bg-brand-gray-50/50 shadow-sm relative group flex flex-col">
                <div className="aspect-[16/7.5] w-full bg-brand-gray-100 relative overflow-hidden flex items-center justify-center text-brand-gray-400 shrink-0">
                  {images[0] ? (
                    <img 
                      src={images[0]} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-center p-4">
                      <span className="text-[10px] font-black text-brand-gray-400 uppercase tracking-wider">PREVISUALIZACIÓN DEL ANUNCIO</span>
                    </div>
                  )}
                  {/* Badges indicators overlay */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    {selectedModes.map(mode => (
                      <span key={mode} className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/95 text-brand-black shadow-xs">
                        {mode === 'SWAP' ? 'Swap' : mode === 'SALE' ? 'Venta' : mode === 'SHORT_RENT' ? 'Renta Corta' : 'Renta Mensual'}
                      </span>
                    ))}
                  </div>
                  {/* Quality/Aura Badge overlay */}
                  <div className="absolute top-3 right-3">
                    <span className="text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-brand-black text-white shadow-xs">
                      Aura Score 95
                    </span>
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3 flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] font-black text-brand-accent uppercase tracking-wider">{type}</span>
                      {selectedModes.includes('SWAP') && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Aura Match 98%</span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-brand-black truncate">{title || 'Título provisional'}</h4>
                    <p className="text-xs text-brand-gray-500 truncate mt-1">
                      {location ? `${neighborhood ? neighborhood + ', ' : ''}${location}` : 'Ubicación / Ciudad'}
                    </p>

                    <div className="flex items-center flex-wrap gap-2 text-[10px] text-brand-gray-500 font-bold mt-2 bg-brand-gray-150/40 p-2 rounded-lg">
                      <span>{formatCount(bedrooms || 0, 'recámara', 'recámaras', 'feminine')}</span>
                      <span>•</span>
                      <span>{formatCount(bathrooms + halfBathrooms * 0.5, 'baño', 'baños', 'masculine')}</span>
                      {parkingSpaces > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatCount(parkingSpaces, 'estacionamiento', 'estacionamientos', 'masculine')}</span>
                        </>
                      )}
                      {surfaceTotal && (
                        <>
                          <span>•</span>
                          <span>{surfaceTotal} m²</span>
                        </>
                      )}
                    </div>

                    {(() => {
                      const firstAmenities = [...selectedAmenities, ...customAmenities].slice(0, 3);
                      if (firstAmenities.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {firstAmenities.map(amenity => (
                            <span key={amenity} className="text-[9px] font-bold text-brand-gray-600 bg-brand-gray-100 px-2 py-0.5 rounded-full border border-brand-gray-200/40">
                              {amenity}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="mt-3.5 text-base font-black text-brand-black">
                      {getPreviewPriceLabel()}
                    </div>
                  </div>

                  <div className="border-t border-brand-gray-200/60 mt-4 pt-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-gray-500">Publicado por</span>
                    <span className="text-[10px] font-black uppercase text-brand-black px-2.5 py-1 rounded bg-brand-gray-100 border">
                      {publisherType === 'owner' ? 'Propietario' : publisherType === 'broker' ? 'Agente' : publisherType === 'developer' ? 'Desarrollador' : 'Gestor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quality Score widget in preview pane */}
              <div className="p-4 rounded-2xl bg-brand-accent/[0.02] border border-brand-accent/15 flex flex-col gap-2 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-brand-gray-500">Calidad del Anuncio</span>
                  <span className="text-xs font-black text-brand-accent">{qualityScore}%</span>
                </div>
                <div className="w-full bg-brand-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-accent h-full transition-all duration-300" style={{ width: `${qualityScore}%` }} />
                </div>
                {qualitySuggestions.length > 0 && (
                  <p className="text-[9px] text-brand-gray-500 leading-relaxed font-bold mt-1">
                    💡 Sugerencia: {qualitySuggestions[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="flex flex-col gap-2 shrink-0 mt-4 border-t border-brand-gray-100 pt-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-brand-gray-400">
                <span className="truncate max-w-[150px]">Paso: {stepsConfig[step]?.label}</span>
                <span>Paso {currentActiveIndex + 1} de {totalActiveSteps}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeSteps.map((s, idx) => {
                  const isActive = step === s.id;
                  const isCompleted = currentActiveIndex > idx;
                  return (
                    <div 
                      key={s.id} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isActive 
                          ? 'w-8 bg-brand-accent' 
                          : isCompleted 
                            ? 'w-4 bg-brand-black' 
                            : 'w-2 bg-brand-gray-200'
                      }`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[10px] text-brand-gray-500 font-bold mt-0.5">
                <span>{progressPercentage}% completado</span>
                <span>
                  {remainingStepsCount > 0 
                    ? `~${Math.ceil(remainingTimeMinutes)} min rest.` 
                    : 'Último paso'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Form Controls (7 cols) */}
          <div className="flex-1 md:col-span-7 flex flex-col overflow-hidden justify-between h-full md:min-h-0">

            {/* Scroll area wrapper — relative so overlays can position against it */}
            <div className="relative flex flex-1 min-h-0 gap-2">

              {/* Main scrollable form area */}
              <div
                ref={scrollAreaRef}
                className="overflow-y-auto pr-1 flex-1 py-1 no-scrollbar min-h-0"
              >
              <AnimatePresence mode="wait">
                {/* STEP 0: Publisher Identity Selection */}
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <User className="w-4 h-4" />
                        <span>Paso 0: Identidad y Perfil</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">¿Quién publica esta propiedad?</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Define tu rol para adaptar la distribución legal y las herramientas de contacto.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Cards selection */}
                      <button
                        type="button"
                        onClick={() => setPublisherType('owner')}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                          publisherType === 'owner' 
                            ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-brand-accent" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-brand-black block">Soy Propietario</span>
                          <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                            Publicación directa peer-to-peer. Habilita verificación KYC y chat inmediato para swaps sin intermediarios.
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPublisherType('broker')}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                          publisherType === 'broker' 
                            ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                          <Building className="w-5 h-5 text-brand-accent" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-brand-black block">Soy Agente Inmobiliario / Broker</span>
                          <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                            Habilita múltiples anuncios bajo una sola cuenta corporativa, comisiones inmobiliarias y ruteo directo a CRM.
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPublisherType('developer')}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                          publisherType === 'developer' 
                            ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-brand-accent" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-brand-black block">Soy Desarrollador Inmobiliario</span>
                          <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                            Promociona proyectos en fase de preventa o construcción. Botón directo para agendar visitas al showroom.
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPublisherType('property_manager')}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                          publisherType === 'property_manager' 
                            ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                          <Home className="w-5 h-5 text-brand-accent" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-brand-black block">Soy Administrador de Propiedades / Airbnb</span>
                          <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                            Administro propiedades de terceros para renta vacacional, renta tradicional o administración patrimonial.
                          </span>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 1: Información Básica */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Info className="w-4 h-4" />
                        <span>Paso 1: Información Básica</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los datos descriptivos generales del alojamiento. El resumen completo de IA se generará automáticamente.</p>
                    </div>

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
                        <label className="text-xs font-bold text-brand-gray-500">Resumen / Descripción de la propiedad <span className="text-red-500">*</span></label>
                        <textarea
                          rows={4}
                          required
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
                )}

                {/* STEP 2: Ubicación */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <MapPin className="w-4 h-4" />
                        <span>Paso 2: Ubicación Geográfica</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa la localización exacta e indica qué mostrar públicamente.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <GoogleAddressAutocomplete
                        onSelect={applyGoogleAddress}
                        selectedAddress={formattedAddress}
                      />

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
                              onChange={(e) => { const value = e.target.value; setCity(value); setLocation(value); invalidateResolvedLocation(); }}
                              placeholder="Ej. Culiacán"
                              className={`w-full rounded-xl border bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-accent/10 ${fieldErrors.city ? 'border-brand-rose' : 'border-brand-gray-200 focus:border-brand-accent'}`}
                            />
                            {fieldErrors.city && <p className="text-[10px] font-bold text-brand-rose">⚠ {fieldErrors.city}</p>}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="property-state" className="text-xs font-bold text-brand-gray-600">Estado / Provincia</label>
                            <input id="property-state" type="text" autoComplete="address-level1" value={stateName || ''}
                              onChange={(e) => { setStateName(e.target.value); invalidateResolvedLocation(); }} placeholder="Ej. Sinaloa"
                              className="w-full rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/10" />
                          </div>
                          <div className="flex flex-col gap-1.5" data-error={fieldErrors.country ? 'true' : 'false'}>
                            <label htmlFor="property-country" className="text-xs font-bold text-brand-gray-600">País <span className="text-brand-rose">*</span></label>
                            <input id="property-country" type="text" required autoComplete="country-name" value={country}
                              onChange={(e) => { setCountry(e.target.value); invalidateResolvedLocation(); }} placeholder="Ej. México"
                              className={`w-full rounded-xl border bg-brand-gray-50 p-3 text-xs font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-accent/10 ${fieldErrors.country ? 'border-brand-rose' : 'border-brand-gray-200 focus:border-brand-accent'}`} />
                            {fieldErrors.country && <p className="text-[10px] font-bold text-brand-rose">⚠ {fieldErrors.country}</p>}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="property-neighborhood" className="text-xs font-bold text-brand-gray-600">Colonia / Fraccionamiento</label>
                            <input id="property-neighborhood" type="text" autoComplete="address-level3" value={neighborhood}
                              onChange={(e) => { setNeighborhood(e.target.value); invalidateResolvedLocation(); }} placeholder="Ej. Tres Ríos"
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
                              onChange={(e) => { setStreetName(e.target.value); invalidateResolvedLocation(); }} placeholder="Ej. Av. Álvaro Obregón"
                              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-1">
                            <label htmlFor="property-number" className="text-xs font-bold text-brand-gray-600">Número</label>
                            <input id="property-number" type="text" value={streetNumber}
                              onChange={(e) => { setStreetNumber(e.target.value); invalidateResolvedLocation(); }} placeholder="123"
                              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <label htmlFor="property-postal" className="text-xs font-bold text-brand-gray-600">Código postal</label>
                            <input id="property-postal" type="text" inputMode="numeric" autoComplete="postal-code" value={postalCode}
                              onChange={(e) => { setPostalCode(e.target.value); invalidateResolvedLocation(); }} placeholder="80000"
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
                )}

                {/* STEP 3: Modalidad de Comercialización */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <DollarSign className="w-4 h-4" />
                        <span>Paso 3: Canales de Comercialización</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona los canales en los que deseas publicar tu propiedad. Puedes activar varios a la vez.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {(['SWAP', 'MONTHLY_RENT', 'SALE'] as const).map(mode => {
                        const isActive = selectedModes.includes(mode);
                        const titleMap = {
                          SWAP: 'Swap / Intercambio',
                          MONTHLY_RENT: 'Renta (Vacacional o Mensual)',
                          SALE: 'Venta Directa'
                        };
                        const descMap = {
                          SWAP: 'Intercambia temporal o permanentemente con otros miembros. Ideal para viajar sin pagar hospedaje o permutar propiedades.',
                          MONTHLY_RENT: 'Publica tarifas por noche (renta vacacional) o mensualidades fijas (renta tradicional).',
                          SALE: 'Promociona la venta de la propiedad física con soporte para créditos hipotecarios y escrituras.'
                        };

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => toggleMode(mode)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                              isActive 
                                ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                                : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-md bg-brand-gray-100 flex items-center justify-center shrink-0 border mt-0.5">
                              {isActive && <Check className="w-3.5 h-3.5 text-brand-accent font-black" />}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-brand-black block">{titleMap[mode]}</span>
                              <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                                {descMap[mode]}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      {fieldErrors.selectedModes && (
                        <p className="text-[10px] text-brand-rose mt-1.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                          <span>⚠</span> <span>{fieldErrors.selectedModes}</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: Características */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Sliders className="w-4 h-4" />
                        <span>Paso 4: Ficha Técnica y Superficies</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa las características constructivas y medidas en metros cuadrados.</p>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                      <div className="grid grid-cols-3 gap-3">
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

                      <div className="grid grid-cols-3 gap-3">
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

                      <div className="grid grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-gray-100">
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

                      <div className="grid grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-4 gap-2 pt-1">
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
                )}

                {/* STEP 5: Amenidades */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Award className="w-4 h-4" />
                        <span>Paso 5: Amenidades del Inmueble</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona el equipamiento y amenidades activas en el espacio. Si no encuentras alguna, escríbela en &quot;Otra amenidad&quot;.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1 no-scrollbar border-b border-brand-gray-100 pb-2">
                      {AMENITY_OPTIONS.map(amenity => {
                        const isChecked = selectedAmenities.includes(amenity);
                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => toggleAmenity(amenity)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs font-bold flex items-center justify-between ${
                              isChecked 
                                ? 'bg-brand-black border-brand-black text-white shadow-premium' 
                                : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                            }`}
                          >
                            <span>{amenity}</span>
                            {isChecked && <Check className="w-4 h-4 text-brand-accent" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Amenities row */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <label className="text-xs font-bold text-brand-gray-500">¿Falta alguna amenidad? Escríbela aquí <span className="text-brand-gray-400 font-normal">(Opcional)</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCustomAmenity}
                          onChange={(e) => setNewCustomAmenity(e.target.value)}
                          placeholder="Ej. Cargador Tesla, Muelle privado, Bodega refrigerada"
                          className="flex-1 p-2.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newCustomAmenity.trim()) {
                                const cleaned = newCustomAmenity.trim();
                                if (!customAmenities.includes(cleaned) && !selectedAmenities.includes(cleaned)) {
                                  setCustomAmenities(prev => [...prev, cleaned]);
                                }
                                setNewCustomAmenity('');
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newCustomAmenity.trim()) {
                              const cleaned = newCustomAmenity.trim();
                              if (!customAmenities.includes(cleaned) && !selectedAmenities.includes(cleaned)) {
                                setCustomAmenities(prev => [...prev, cleaned]);
                              }
                              setNewCustomAmenity('');
                            }
                          }}
                          className="px-4 py-2.5 bg-brand-black text-white text-xs font-black rounded-xl hover:bg-brand-gray-800 transition-all cursor-pointer shrink-0"
                        >
                          Agregar
                        </button>
                      </div>

                      {/* Display custom amenities */}
                      {customAmenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-16 overflow-y-auto no-scrollbar">
                          {customAmenities.map(amenity => (
                            <span 
                              key={amenity} 
                              className="text-[10px] font-bold text-brand-black bg-brand-accent/10 border border-brand-accent/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                            >
                              <span>{amenity}</span>
                              <button
                                type="button"
                                onClick={() => setCustomAmenities(prev => prev.filter(a => a !== amenity))}
                                className="text-brand-rose font-black hover:text-brand-rose/85 cursor-pointer text-xs"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* STEP 6: Preferencias de Swap */}
                {step === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4 text-brand-black"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Sparkles className="w-4 h-4" />
                        <span>Paso 6: Configuración de Swap / Intercambio</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Define qué tipo de propiedad buscas y las condiciones de permuta.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">¿Qué buscas recibir? <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={swapPreferences}
                          onChange={(e) => setSwapPreferences(e.target.value)}
                          placeholder="Ej. Casa o Depto frente al mar en Mazatlán o Sinaloa"
                          className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent ${
                            fieldErrors.swapPreferences ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
                          }`}
                        />
                        {fieldErrors.swapPreferences && (
                          <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                            <span>⚠</span> <span>{fieldErrors.swapPreferences}</span>
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Valor Mínimo Deseado</label>
                          <input
                            type="number"
                            value={swapMinValue || ''}
                            onChange={(e) => setSwapMinValue(Number(e.target.value) || 0)}
                            placeholder="Ej. 3000000"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Valor Máximo Deseado</label>
                          <input
                            type="number"
                            value={swapMaxValue || ''}
                            onChange={(e) => setSwapMaxValue(Number(e.target.value) || 0)}
                            placeholder="Ej. 6000000"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Diferencia Económica Máxima</label>
                          <input
                            type="number"
                            value={swapMaxCashDiff}
                            onChange={(e) => setSwapMaxCashDiff(Number(e.target.value) || '')}
                            placeholder="Monto en efectivo que puedes aportar o recibir"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Prioridad del Intercambio</label>
                          <CustomSelect
                            value={swapPriority}
                            onChange={(val) => setSwapPriority(val as any)}
                            options={[
                              { value: 'Alta', label: 'Alta (Urgente)' },
                              { value: 'Media', label: 'Media (Estándar)' },
                              { value: 'Baja', label: 'Baja (Informativo)' }
                            ]}
                            scrollContainerRef={scrollAreaRef}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">¿Qué estás dispuesto a aceptar?</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="swapAcceptsDept"
                              checked={swapAcceptsDept}
                              onChange={(e) => setSwapAcceptsDept(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="swapAcceptsDept" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Departamento</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="swapAcceptsHouse"
                              checked={swapAcceptsHouse}
                              onChange={(e) => setSwapAcceptsHouse(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="swapAcceptsHouse" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Casa</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="swapAcceptsLand"
                              checked={swapAcceptsLand}
                              onChange={(e) => setSwapAcceptsLand(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="swapAcceptsLand" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Terreno</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="swapAcceptsVehicle"
                              checked={swapAcceptsVehicle}
                              onChange={(e) => setSwapAcceptsVehicle(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="swapAcceptsVehicle" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Vehículo / Auto</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white col-span-2">
                            <input
                              type="checkbox"
                              id="swapAcceptsCash"
                              checked={swapAcceptsCash}
                              onChange={(e) => setSwapAcceptsCash(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="swapAcceptsCash" className="text-xs font-bold text-brand-black cursor-pointer">Acepto Efectivo como compensación</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 7: Condiciones de Renta */}
                {step === 7 && (
                  <motion.div
                    key="step7"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4 text-brand-black"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Calendar className="w-4 h-4" />
                        <span>Paso 7: Condiciones y Tarifas de Renta</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los precios de renta, depósito y condiciones de arrendamiento.</p>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                      {/* Price fields depending on short / monthly modes */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Renta Mensual ($ USD) <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            value={monthlyPrice}
                            onChange={(e) => setMonthlyPrice(Number(e.target.value) || 0)}
                            placeholder="Monto al mes"
                            className={`w-full p-3 rounded-xl bg-brand-gray-50 border text-xs font-semibold outline-none focus:border-brand-accent ${
                              fieldErrors.rentPrice ? 'border-brand-rose focus:border-brand-rose' : 'border-brand-gray-200'
                            }`}
                          />
                          {fieldErrors.rentPrice && (
                            <p className="text-[10px] text-brand-rose mt-0.5 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                              <span>⚠</span> <span>{fieldErrors.rentPrice}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Depósito Requerido ($ USD)</label>
                          <input
                            type="number"
                            value={monthlyDeposit}
                            onChange={(e) => setMonthlyDeposit(Number(e.target.value) || 0)}
                            placeholder="Depósito de garantía"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Meses Adelantados</label>
                          <input
                            type="number"
                            min="0"
                            value={advanceMonths}
                            onChange={(e) => setAdvanceMonths(Number(e.target.value) || 0)}
                            placeholder="Ej. 1"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Plazo Mínimo (Meses)</label>
                          <input
                            type="number"
                            min="1"
                            value={shortMinNights}
                            onChange={(e) => setShortMinNights(Number(e.target.value) || 1)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Disponible A Partir De</label>
                          <input
                            type="date"
                            value={swapAvailableStart}
                            onChange={(e) => setSwapAvailableStart(e.target.value)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Mantenimiento Incluido</label>
                          <div className="flex items-center gap-2.5 p-3.5 rounded-xl border bg-white h-[42px]">
                            <input
                              type="checkbox"
                              id="includesMaintenance"
                              checked={includesMaintenance}
                              onChange={(e) => setIncludesMaintenance(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="includesMaintenance" className="text-xs font-bold text-brand-black cursor-pointer">Sí, incluido</label>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="requiresGuarantor"
                            checked={requiresGuarantor}
                            onChange={(e) => setRequiresGuarantor(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="requiresGuarantor" className="text-xs font-bold text-brand-black cursor-pointer">Aval Requerido</label>
                        </div>
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="requiresLegalPolicy"
                            checked={requiresLegalPolicy}
                            onChange={(e) => setRequiresLegalPolicy(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="requiresLegalPolicy" className="text-xs font-bold text-brand-black cursor-pointer">Póliza Jurídica</label>
                        </div>
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="acceptsPets"
                            checked={acceptsPets}
                            onChange={(e) => setAcceptsPets(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="acceptsPets" className="text-xs font-bold text-brand-black cursor-pointer">Acepta Mascotas</label>
                        </div>
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="isFurnished"
                            checked={isFurnished}
                            onChange={(e) => setIsFurnished(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="isFurnished" className="text-xs font-bold text-brand-black cursor-pointer">Amueblado</label>
                        </div>
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white col-span-2">
                          <input
                            type="checkbox"
                            id="includesServices"
                            checked={includesServices}
                            onChange={(e) => setIncludesServices(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="includesServices" className="text-xs font-bold text-brand-black cursor-pointer">Servicios Incluidos (Agua/Luz/Internet)</label>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Reglas del Inmueble</label>
                        <textarea
                          rows={2}
                          value={rentRules}
                          onChange={(e) => setRentRules(e.target.value)}
                          placeholder="Ej. No fiestas, fumar solo en terraza, horario de ruido..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent resize-none text-brand-black"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 8: Términos de Venta */}
                {step === 8 && (
                  <motion.div
                    key="step8"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4 text-brand-black"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <FileText className="w-4 h-4" />
                        <span>Paso 8: Términos y Legal de Venta</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Configura el precio de venta, avalúo y las condiciones legales del expediente.</p>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
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
                            value={legalDebtFree ? 'Libre' : 'ConGravamen'}
                            onChange={(val) => setLegalDebtFree(val === 'Libre')}
                            options={[
                              { value: 'Libre', label: 'Libre de Gravamen' },
                              { value: 'ConGravamen', label: 'Con Gravamen Activo' }
                            ]}
                            scrollContainerRef={scrollAreaRef}
                          />
                        </div>
                        {!legalDebtFree && (
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

                      {!legalDebtFree && (
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
                        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Declaraciones y Expediente</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="legalPublicDeed"
                              checked={legalPublicDeed}
                              onChange={(e) => setLegalPublicDeed(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="legalPublicDeed" className="text-xs font-bold text-brand-black cursor-pointer">Escritura Pública</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="legalTaxCurrent"
                              checked={legalTaxCurrent}
                              onChange={(e) => setLegalTaxCurrent(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="legalTaxCurrent" className="text-xs font-bold text-brand-black cursor-pointer">Predial al Corriente</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="legalIsMortgaged"
                              checked={legalIsMortgaged}
                              onChange={(e) => setLegalIsMortgaged(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="legalIsMortgaged" className="text-xs font-bold text-brand-black cursor-pointer">Tiene Hipoteca Activa</label>
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                            <input
                              type="checkbox"
                              id="legalDocumentationComplete"
                              checked={legalDocumentationComplete}
                              onChange={(e) => setLegalDocumentationComplete(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="legalDocumentationComplete" className="text-xs font-bold text-brand-black cursor-pointer">Expediente Completo</label>
                          </div>
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
                )}

                {/* STEP 9: Multimedia */}
                {step === 9 && (
                  <motion.div
                    key="step9"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Image className="w-4 h-4" />
                        <span>Paso 9: Galería y Multimedia</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Agrega las fotos oficiales y enlaces a recorridos virtuales 3D.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Imágenes <span className="text-red-500">*</span></span>
                        <ImageUploadDropzone
                          images={images}
                          onChange={setImages}
                          imagesMetadata={imagesMetadata}
                          onMetadataChange={setImagesMetadata}
                        />
                        {fieldErrors.images && (
                          <p className="text-[10px] text-brand-rose mt-1 font-bold flex items-center gap-1 animate-in fade-in duration-200">
                            <span>⚠</span> <span>{fieldErrors.images}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Video Local (MP4, MOV, WEBM)</span>
                        <VideoUploadDropzone
                          videoUrl={videoUrl}
                          onChange={setVideoUrl}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Enlace a Video Recorrido</label>
                        <input
                          type="text"
                          value={videoPlaceholder}
                          onChange={(e) => setVideoPlaceholder(e.target.value)}
                          placeholder="Ej. https://youtube.com/watch?v=..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Recorrido Virtual 3D (Matterport o YouTube)</label>
                        <input
                          type="url"
                          value={virtualTourPlaceholder}
                          onChange={(e) => setVirtualTourPlaceholder(e.target.value)}
                          placeholder="https://my.matterport.com/show/?m=... o https://youtu.be/..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                        <p className="text-[10px] leading-relaxed text-brand-gray-400">Acepta Matterport y videos 360° o recorridos publicados en YouTube.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 10: Esquema Comercial */}
                {step === 10 && (
                  <motion.div
                    key="step10"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4 text-brand-black"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Briefcase className="w-4 h-4" />
                        <span>Paso 10: Esquema Comercial</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Configura las comisiones compartidas de la red y la exclusividad del inmueble.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl border bg-white">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            id="isExclusive"
                            checked={isExclusive}
                            onChange={(e) => setIsExclusive(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="isExclusive" className="text-xs font-bold text-brand-black cursor-pointer">
                            Ficha en Exclusiva
                          </label>
                        </div>
                        <p className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">
                          Al marcar esto, confirmas que posees los derechos exclusivos de promoción y comercialización del inmueble. Las propiedades en exclusiva reciben hasta un 40% más de visibilidad en el feed y búsquedas de AuraSwap.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Comisión Total (%)</label>
                          <input
                            type="number"
                            value={commissionTotalPct}
                            onChange={(e) => setCommissionTotalPct(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ej. 5"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                          <p className="text-[9px] text-brand-gray-400 leading-normal">
                            Comisión total pactada con el cliente propietario para la operación.
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Comisión Compartida (%)</label>
                          <input
                            type="number"
                            value={commissionSharedPct}
                            onChange={(e) => setCommissionSharedPct(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ej. 2.5"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent text-brand-black"
                          />
                          <p className="text-[9px] text-brand-gray-400 leading-normal">
                            Comisión que compartes con el broker co-operador que traiga el cliente final.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-brand-gray-50/50 border border-dashed rounded-2xl flex flex-col gap-1 mt-2">
                        <span className="text-[10px] font-black text-brand-black uppercase tracking-wider">Optimización SEO Inteligente</span>
                        <p className="text-[10px] text-brand-gray-500 leading-normal">
                          Para tu comodidad, las etiquetas Meta Title, Meta Description y OpenGraph se generarán automáticamente en segundo plano utilizando inteligencia artificial a partir de los datos cargados en el paso 1.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 11: Vista Previa y Publicación */}
                {step === 11 && (
                  <motion.div
                    key="step11"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4 text-brand-black"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Sparkles className="w-4 h-4" />
                        <span>Paso 11: Vista Previa y Calidad</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Valida el resumen técnico y el checklist de calidad antes de guardar el anuncio.</p>
                    </div>

                    <div className="border border-brand-gray-200 rounded-2xl p-4 bg-brand-gray-50/50 flex flex-col gap-3">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-xs font-black text-brand-black truncate">{title || 'Sin Título'}</span>
                        <span className="text-[10px] font-black uppercase text-brand-accent bg-brand-accent/5 px-2.5 py-1 rounded">
                          {type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs leading-normal">
                        <div>
                          <p className="text-brand-gray-400 font-bold">Ubicación</p>
                          <p className="font-semibold text-brand-black">{location || 'No especificada'}</p>
                        </div>
                        <div>
                          <p className="text-brand-gray-400 font-bold">Habitabilidad</p>
                          <p className="font-semibold text-brand-black">
                            {formatCount(bedrooms || 0, 'recámara', 'recámaras', 'feminine')} • {formatCount(bathrooms || 0, 'baño', 'baños', 'masculine')} • {formatCount(parkingSpaces || 0, 'estacionamiento', 'estacionamientos', 'masculine')}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs leading-normal pt-2 border-t">
                        <p className="text-brand-gray-400 font-bold">Modalidades seleccionadas</p>
                        <div className="flex gap-2.5 mt-1">
                          {selectedModes.map(m => (
                            <span key={m} className="px-2 py-0.5 rounded bg-brand-black text-white text-[9px] font-bold">
                              {m === 'SALE' ? 'Venta' : (m === 'MONTHLY_RENT' || m === 'SHORT_RENT') ? 'Renta' : 'Swap'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pre-publication Checklist */}
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Checklist de Calidad del Anuncio</span>
                      <div className="flex flex-col gap-2.5 p-3.5 bg-brand-gray-50 rounded-2xl border">
                        
                        {/* Usuario autenticado */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Usuario autenticado (hostId)</span>
                          {currentUser || initialData?.hostId ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Sin sesión activa</span>
                          )}
                        </div>

                        {/* Título */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Título del anuncio</span>
                          {title && title.trim().length >= 10 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Mín. 10 caracteres</span>
                          )}
                        </div>

                        {/* Descripción */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Descripción básica</span>
                          {shortDescription && shortDescription.trim().length >= 30 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Mín. 30 caracteres</span>
                          )}
                        </div>

                        {/* Ubicación georreferenciada */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Ubicación georreferenciada</span>
                          {latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude)) ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Coordenadas ausentes (Paso 2)</span>
                          )}
                        </div>

                        {/* Canales de operación */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Canales de operación</span>
                          {selectedModes.length > 0 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo ({selectedModes.join(', ')})</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Selecciona al menos uno (Paso 3)</span>
                          )}
                        </div>

                        {/* Precios y condiciones */}
                        {selectedModes.map(mode => {
                          let isVal = false;
                          let label = '';
                          let errLabel = '';
                          if (mode === 'SALE') {
                            isVal = Number(salePrice) > 0;
                            label = 'Precio de Venta';
                            errLabel = 'Especifica precio > 0';
                          } else if (mode === 'MONTHLY_RENT') {
                            isVal = Number(monthlyPrice) > 0;
                            label = 'Precio de Renta Mensual';
                            errLabel = 'Especifica precio > 0';
                          } else if (mode === 'SHORT_RENT') {
                            isVal = Number(nightlyPrice) > 0;
                            label = 'Precio de Renta Temporal';
                            errLabel = 'Especifica precio > 0';
                          } else if (mode === 'SWAP') {
                            isVal = !!(swapPreferences && swapPreferences.trim());
                            label = 'Preferencias de Intercambio';
                            errLabel = 'Escribe tus preferencias';
                          }

                          return (
                            <div key={mode} className="flex items-center justify-between text-xs font-semibold pl-3 border-l-2 border-brand-gray-200">
                              <span className="text-brand-gray-500">{label}</span>
                              {isVal ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo</span>
                              ) : (
                                <span className="text-rose-600 font-bold flex items-center gap-1">❌ {errLabel}</span>
                              )}
                            </div>
                          );
                        })}

                        {/* Imágenes */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-brand-gray-600">Imágenes cargadas ({images.length})</span>
                          {images.length > 0 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Listo {images.length >= 5 ? '' : '(Recomendado 5+)'}</span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">❌ Sube al menos 1 imagen</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Supabase / Server Error display */}
                    {supabaseError && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 font-semibold flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-rose-900">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 animate-pulse" />
                          <span>Error en el servidor de base de datos</span>
                        </div>
                        <p className="leading-relaxed font-bold">{supabaseError.message}</p>
                        <div className="bg-white/60 p-2.5 rounded-lg border text-[10px] leading-normal font-mono flex flex-col gap-1 mt-1 text-rose-950">
                          <div><span className="font-bold">Código:</span> {supabaseError.code}</div>
                          <div><span className="font-bold">Detalle:</span> {supabaseError.details}</div>
                          {supabaseError.hint && <div><span className="font-bold">Ayuda:</span> {supabaseError.hint}</div>}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>{/* end scroll area */}

              {/* ── Desktop Scroll Sidebar ─────────────────────────────── */}
              <AnimatePresence>
                {scrollInfo.hasOverflow && (
                  <motion.div
                    key="scroll-sidebar"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="hidden md:flex flex-col items-center gap-1.5 py-1 shrink-0 w-7"
                  >
                    {/* Scroll Up button */}
                    <button
                      type="button"
                      onClick={() =>
                        scrollAreaRef.current?.scrollBy({ top: -160, behavior: 'smooth' })
                      }
                      disabled={!scrollInfo.canScrollUp}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${
                        scrollInfo.canScrollUp
                          ? 'border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer'
                          : 'border-brand-gray-100 text-brand-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>

                    {/* Progress bar track */}
                    <div className="flex-1 w-1.5 rounded-full bg-brand-gray-100 relative overflow-hidden min-h-0">
                      {/* Track fill */}
                      <motion.div
                        className="absolute top-0 left-0 w-full rounded-full bg-brand-accent/40"
                        animate={{ height: `${Math.round(scrollInfo.scrollPct * 100)}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                      />
                      {/* Thumb */}
                      <motion.div
                        className="absolute left-0 w-full h-3 rounded-full bg-brand-accent shadow-sm"
                        animate={{ top: `calc(${Math.round(scrollInfo.scrollPct * 100)}% - 6px)` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                      />
                    </div>

                    {/* Scroll Down button */}
                    <button
                      type="button"
                      onClick={() =>
                        scrollAreaRef.current?.scrollBy({ top: 160, behavior: 'smooth' })
                      }
                      disabled={!scrollInfo.canScrollDown}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${
                        scrollInfo.canScrollDown
                          ? 'border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer'
                          : 'border-brand-gray-100 text-brand-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Bottom Fade + Animated Arrow (absolute, inside scroll wrapper) ── */}
              <AnimatePresence>
                {scrollInfo.canScrollDown && (
                  <motion.div
                    key="scroll-fade"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="pointer-events-none absolute bottom-0 left-0 right-7 h-20 flex flex-col items-center justify-end pb-1"
                    style={{
                      background:
                        'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 60%, rgba(255,255,255,1) 100%)',
                    }}
                  >
                    <span className="text-[10px] font-bold text-brand-gray-400 tracking-wide flex flex-col items-center gap-0.5">
                      <motion.span
                        animate={{ y: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                      >
                        <ChevronDown className="w-4 h-4 text-brand-accent" />
                      </motion.span>
                      Más campos
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Mobile Floating Scroll Button ─────────────────────── */}
              <AnimatePresence>
                {scrollInfo.canScrollDown && (
                  <motion.button
                    key="mobile-scroll-btn"
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    onClick={() =>
                      scrollAreaRef.current?.scrollBy({ top: 160, behavior: 'smooth' })
                    }
                    className="md:hidden absolute bottom-2 right-2 z-20 flex items-center gap-1 px-3 py-1.5 bg-brand-black/85 backdrop-blur text-white rounded-full text-[10px] font-bold shadow-lg cursor-pointer"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Más campos
                  </motion.button>
                )}
              </AnimatePresence>

            </div>{/* end scroll wrapper */}

            {/* Inline Validation Alert */}
            {validationError && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-rose/5 border border-brand-rose/10 rounded-2xl p-3 text-xs text-brand-rose font-semibold mt-4 flex items-center gap-2 shrink-0 z-10"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-brand-rose animate-pulse" />
                <span>{validationError}</span>
              </motion.div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="border-t border-brand-gray-100 pt-4 mt-6 shrink-0 flex items-center justify-between bg-white z-10">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0 || (step === 1 && !!initialData)}
                className={`px-5 py-3 border border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50 hover:text-brand-black rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  (step === 0 || (step === 1 && !!initialData)) ? 'opacity-0 pointer-events-none' : ''
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              {step === 11 ? (
                <button
                  type="button"
                  onClick={handlePublish}
                  className="px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{initialData ? 'Guardar Cambios' : 'Publicar Anuncio'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 bg-brand-black hover:bg-brand-black/90 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
