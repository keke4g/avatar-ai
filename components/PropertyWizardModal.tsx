import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Sparkles, Check, Info, Loader2,
  Home, DollarSign, Calendar, MessageSquareCode, Award, Shield, User, Building, Briefcase, Camera, Play, Eye, AlertTriangle,
  MapPin, Sliders, FileText, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Property, PropertyOffering, PropertyOfferingMode, PropertyOfferingStatus, PropertyBillingPeriod, PropertyOfferingVisibility } from '../lib/types';
import { useTranslation } from '../lib/context/LanguageContext';
import ImageUploadDropzone from './ImageUploadDropzone';

interface PropertyWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (propertyData: any) => void;
  initialData?: Property | null;
  onDelete?: (id: string) => void;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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

export default function PropertyWizardModal({ isOpen, onClose, onSubmit, initialData, onDelete }: PropertyWizardModalProps) {
  const { t, language } = useTranslation();
  const [step, setStep] = useState<WizardStep>(0);
  const [localDeleteConfirm, setLocalDeleteConfirm] = useState(false);

  // STEP 0: Publisher Type
  const [publisherType, setPublisherType] = useState<'owner' | 'broker' | 'developer'>('owner');

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
      const currentMode = step === 5 ? activeConfigTab : (selectedModes.length > 0 ? selectedModes[0] : null);
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

  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

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

  // STEP 6: Legal Info
  const [legalDebtFree, setLegalDebtFree] = useState(true);
  const [legalPublicDeed, setLegalPublicDeed] = useState(true);
  const [legalTaxCurrent, setLegalTaxCurrent] = useState(true);
  const [legalServicesPaid, setLegalServicesPaid] = useState(true);
  const [legalOwnerType, setLegalOwnerType] = useState('Privada');
  const [legalIsMortgaged, setLegalIsMortgaged] = useState(false);

  // STEP 7: Media & Gallery
  const [images, setImages] = useState<string[]>([]);
  const [imagesMetadata, setImagesMetadata] = useState<Record<string, any>>({});
  const [videoPlaceholder, setVideoPlaceholder] = useState('');
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
      setLocation(initialData.location || '');
      setCountry(initialData.country || '');
      setAddress(initialData.address || '');
      setLatitude(initialData.latitude !== undefined && initialData.latitude !== null ? Number(initialData.latitude) : null);
      setLongitude(initialData.longitude !== undefined && initialData.longitude !== null ? Number(initialData.longitude) : null);
      setPlaceId(initialData.placeId || null);
      setFormattedAddress(initialData.formattedAddress || null);
      setCity(initialData.city || null);
      setStateName(initialData.state || null);
      setGeometrySource(initialData.geometrySource || null);
      setBedrooms(initialData.bedrooms || 2);
      setBathrooms(initialData.bathrooms || 2);
      setHalfBathrooms(Number(initialData.metadata?.halfBathrooms) || 0);
      setMaxGuests(initialData.maxGuests || 4);
      setSelectedAmenities(initialData.amenities || []);
      setImages(initialData.images || []);
      setImagesMetadata(initialData.metadata?.imagesMetadata || {});
      
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
      setImages([]);
      setImagesMetadata({});
    }
  }, [initialData, isOpen]);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    if (val !== formattedAddress) {
      setLatitude(null);
      setLongitude(null);
      setPlaceId(null);
      setGeometrySource('manual');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wizardMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wizardMarkerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet globally for the wizard if not loaded
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (step !== 2 || !isOpen) return;

    const loadLeaflet = async () => {
      if (!document.getElementById('leaflet-css-cdn')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.id = 'leaflet-css-cdn';
        document.head.appendChild(link);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).L) {
        setLeafletLoaded(true);
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.id = 'leaflet-js-cdn';
        script.onload = () => {
          setLeafletLoaded(true);
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Leaflet'));
        document.head.appendChild(script);
      });
    };

    loadLeaflet().catch(err => console.error('[Wizard Leaflet Load Error]:', err));
  }, [step, isOpen]);

  // Update/render the wizard mini map when lat/lng change
  useEffect(() => {
    if (!leafletLoaded || step !== 2 || !isOpen) return;
    if (latitude === null || longitude === null) {
      if (wizardMapRef.current) {
        wizardMapRef.current.remove();
        wizardMapRef.current = null;
        wizardMarkerRef.current = null;
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('wizard-preview-map');
    if (!container) return;

    try {
      if (!wizardMapRef.current) {
        const map = L.map('wizard-preview-map', {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: false
        }).setView([latitude, longitude], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(map);

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker-selected',
          html: `<div class="bg-brand-black text-white px-2 py-0.5 rounded-full border border-brand-black font-black text-[9px] shadow-premium">📍</div>`
        });

        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

        wizardMapRef.current = map;
        wizardMarkerRef.current = marker;
      } else {
        const map = wizardMapRef.current;
        const marker = wizardMarkerRef.current;
        map.setView([latitude, longitude], 13);
        if (marker) {
          marker.setLatLng([latitude, longitude]);
        }
      }

      // Leaflet requires invalidateSize when container is shown dynamically
      setTimeout(() => {
        if (wizardMapRef.current) {
          wizardMapRef.current.invalidateSize();
        }
      }, 150);
    } catch (e) {
      console.error('[Wizard Map Init Error]:', e);
    }
  }, [leafletLoaded, latitude, longitude, step, isOpen]);

  // Clean up wizard map on unmount/step change
  useEffect(() => {
    return () => {
      if (wizardMapRef.current) {
        try {
          wizardMapRef.current.remove();
        } catch {
        }
        wizardMapRef.current = null;
        wizardMarkerRef.current = null;
      }
    };
  }, [step, isOpen]);

  useEffect(() => {
    if (step !== 2 || !isOpen) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let autocompleteInstance: any = null;

    const initAutocomplete = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g || !g.maps || !g.maps.places) {
        setTimeout(initAutocomplete, 200);
        return;
      }

      const input = autocompleteInputRef.current;
      if (!input) return;

      if (autocompleteRef.current) return;

      try {
        autocompleteInstance = new g.maps.places.Autocomplete(input, {
          types: ['address'],
          fields: ['address_components', 'geometry', 'formatted_address', 'place_id']
        });

        autocompleteRef.current = autocompleteInstance;

        autocompleteInstance.addListener('place_changed', () => {
          const place = autocompleteInstance.getPlace();
          if (!place || !place.geometry || !place.geometry.location) {
            console.warn('Place chosen has no geometry / location details');
            return;
          }

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const pId = place.place_id;
          const fAddress = place.formatted_address;

          let cityVal = '';
          let stateVal = '';
          let countryVal = '';

          if (place.address_components) {
            for (const component of place.address_components) {
              const types = component.types;
              if (types.includes('locality')) {
                cityVal = component.long_name;
              } else if (types.includes('administrative_area_level_1')) {
                stateVal = component.long_name;
              } else if (types.includes('country')) {
                countryVal = component.long_name;
              }
            }
          }

          setLatitude(lat);
          setLongitude(lng);
          setPlaceId(pId || null);
          setFormattedAddress(fAddress || null);
          setCity(cityVal || null);
          setStateName(stateVal || null);
          setGeometrySource('google_places');

          if (fAddress) setAddress(fAddress);
          if (cityVal) setLocation(cityVal);
          if (countryVal) setCountry(countryVal);
        });
      } catch (e) {
        console.error('[Autocomplete Init Error]:', e);
      }
    };

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
    if (apiKey) {
      const scriptId = 'google-maps-places-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          initAutocomplete();
        };
        document.head.appendChild(script);
      } else {
        initAutocomplete();
      }
    }

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (autocompleteRef.current && g && g.maps && g.maps.event) {
        try {
          g.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch {}
        autocompleteRef.current = null;
      }
    };
  }, [step, isOpen]);

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

  const handleNext = () => {
    if (step === 0) setStep(1);
    else if (step === 1 && title && description) setStep(2);
    else if (step === 2 && location && country) setStep(3);
    else if (step === 3 && selectedModes.length > 0) setStep(4);
    else if (step === 4) setStep(5);
    else if (step === 5) setStep(6);
    else if (step === 6) setStep(7);
    else if (step === 7) setStep(8);
    else if (step === 8) setStep(9);
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => (prev - 1) as WizardStep);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();

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
      legalOwnerType,
      legalIsMortgaged,
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
      folderStatus: 'DRAFT',
      metaTitle,
      metaDescription,
      metadata: {
        publisherType,
        videoPlaceholder,
        virtualTourPlaceholder,
        uiPropertyType: type,
        halfBathrooms,
        imagesMetadata,
        isExclusive,
        commissionTotalPct,
        commissionSharedPct
      }
    };

    onSubmit(compiledPropertyData);
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
          className="relative z-10 w-full max-w-5xl bg-white rounded-3xl p-6 md:p-8 shadow-floating border border-brand-gray-200/60 overflow-hidden flex flex-col md:grid md:grid-cols-12 gap-8 md:h-[82vh] md:max-h-[720px] md:min-h-[580px]"
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
                    <p className="text-xs text-brand-gray-500 truncate mt-1">{location ? `${location}, ${country}` : 'Ubicación'}</p>
                  </div>

                  <div className="border-t border-brand-gray-200/60 mt-4 pt-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-gray-500">Publicado por</span>
                    <span className="text-[10px] font-black uppercase text-brand-black px-2.5 py-1 rounded bg-brand-gray-100 border">
                      {publisherType === 'owner' ? 'Propietario' : publisherType === 'broker' ? 'Agente' : 'Desarrollador'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="flex flex-col gap-2.5 shrink-0 mt-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-gray-400">Progreso del Registro</span>
              <div className="flex items-center gap-1.5">
                {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map(s => {
                  const isActive = step === s;
                  const isCompleted = step > s;
                  return (
                    <div 
                      key={s} 
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
            </div>
          </div>

          {/* RIGHT COLUMN: Form Controls (7 cols) */}
          <div className="flex-1 md:col-span-7 flex flex-col overflow-hidden justify-between h-full md:min-h-0">
            <div className="overflow-y-auto pr-1 flex-1 py-1 no-scrollbar min-h-0">
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
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los datos descriptivos generales del alojamiento.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Título del anuncio</label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ej. Moderna Villa con alberca en Marina Mazatlán"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Subtítulo</label>
                        <input
                          type="text"
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          placeholder="Ej. Ideal para familias y nómadas digitales"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Nombre del Desarrollo / Residencial</label>
                        <input
                          type="text"
                          value={developmentName}
                          onChange={(e) => setDevelopmentName(e.target.value)}
                          placeholder="Ej. Marina Gardens, La Primavera"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Descripción Corta</label>
                        <input
                          type="text"
                          value={shortDescription}
                          onChange={(e) => setShortDescription(e.target.value)}
                          placeholder="Resumen ejecutivo del espacio (máx. 160 caracteres)"
                          maxLength={160}
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Descripción Completa</label>
                        <textarea
                          rows={4}
                          required
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Detalla la distribución del espacio, recámaras, accesos y cercanía..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Tipo de Propiedad</label>
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value as UIType)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          >
                            <option value="Departamento">Departamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Penthouse">Penthouse</option>
                            <option value="Villa">Villa</option>
                            <option value="Loft">Loft</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Categorización Premium</label>
                          <select
                            value={valueRating}
                            onChange={(e) => setValueRating(e.target.value as any)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          >
                            <option value="Premium">Premium</option>
                            <option value="Luxury">Luxury</option>
                            <option value="Exclusive">Exclusive</option>
                            <option value="Curated">Curated</option>
                          </select>
                        </div>
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

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Búsqueda rápida o Ciudad</label>
                        <input
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Ej. Culiacán, Sinaloa"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">País</label>
                          <input
                            type="text"
                            required
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="Ej. Mexico"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Colonia / Fraccionamiento</label>
                          <input
                            type="text"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            placeholder="Ej. Tres Ríos"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5 col-span-2">
                          <label className="text-xs font-bold text-brand-gray-500">Calle y Número</label>
                          <input
                            type="text"
                            value={streetName}
                            onChange={(e) => setStreetName(e.target.value)}
                            placeholder="Calle, Número exterior/interior"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">C.P.</label>
                          <input
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            placeholder="Código Postal"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Referencias de Ubicación</label>
                        <input
                          type="text"
                          value={locationReference}
                          onChange={(e) => setLocationReference(e.target.value)}
                          placeholder="Ej. Frente a parque municipal"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="showPublicAddress"
                          checked={showPublicAddress}
                          onChange={(e) => setShowPublicAddress(e.target.checked)}
                          className="w-4 h-4 accent-brand-accent cursor-pointer"
                        />
                        <label htmlFor="showPublicAddress" className="text-xs font-semibold text-brand-gray-600 cursor-pointer">
                          Mostrar dirección completa públicamente (sino se mostrará aproximada).
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Modalidad y Precios */}
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
                        <span>Paso 3: Operación y Comercialización</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona y configura las modalidades activas de este inmueble.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Checkbox selectors */}
                      <div className="grid grid-cols-4 gap-2">
                        {(['SALE', 'RENT', 'SWAP'] as const).map(mode => {
                          const isActive = selectedModes.includes(mode as any);
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => toggleMode(mode as any)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                                isActive 
                                  ? 'bg-brand-black border-brand-black text-white shadow-premium' 
                                  : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                              }`}
                            >
                              {mode === 'SALE' ? 'Venta' : mode === 'RENT' ? 'Renta' : 'Swap'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Config Form based on selected checkmarks */}
                      <div className="flex flex-col gap-3.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                        {/* SALE config details */}
                        {selectedModes.includes('SALE' as any) && (
                          <div className="border border-brand-accent/20 bg-brand-accent/[0.01] rounded-2xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] font-black uppercase text-brand-accent">Comercialización de Venta</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-brand-gray-500">Precio de Venta</label>
                                <input
                                  type="number"
                                  value={salePrice}
                                  onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-brand-gray-500">Moneda</label>
                                <select
                                  value={saleCurrency}
                                  onChange={(e) => setSaleCurrency(e.target.value)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                                >
                                  <option value="MXN">MXN ($)</option>
                                  <option value="USD">USD ($)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* RENT config details */}
                        {selectedModes.includes('RENT' as any) && (
                          <div className="border border-brand-accent/20 bg-brand-accent/[0.01] rounded-2xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] font-black uppercase text-brand-accent">Comercialización de Renta</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-brand-gray-500">Precio Mensual</label>
                                <input
                                  type="number"
                                  value={monthlyPrice}
                                  onChange={(e) => setMonthlyPrice(Number(e.target.value) || 0)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-brand-gray-500">Depósito Requerido</label>
                                <input
                                  type="number"
                                  value={monthlyDeposit}
                                  onChange={(e) => setMonthlyDeposit(Number(e.target.value) || 0)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SWAP config details */}
                        {selectedModes.includes('SWAP' as any) && (
                          <div className="border border-brand-accent/20 bg-brand-accent/[0.01] rounded-2xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] font-black uppercase text-brand-accent">Comercialización de Swap / Permuta</span>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-brand-gray-500">Propiedad Buscada / Intercambio deseado</label>
                              <input
                                type="text"
                                value={swapPreferences}
                                onChange={(e) => setSwapPreferences(e.target.value)}
                                placeholder="Ej. Busco departamento vacacional frente al mar en Mazatlán"
                                className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
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
                            min="1"
                            value={bedrooms}
                            onChange={(e) => setBedrooms(Number(e.target.value) || 1)}
                            className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-brand-gray-500">Baños Completos</label>
                          <input
                            type="number"
                            min="1"
                            value={bathrooms}
                            onChange={(e) => setBathrooms(Number(e.target.value) || 1)}
                            className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                          />
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
                          <label className="text-[10px] font-bold text-brand-gray-500">Niveles totales</label>
                          <input
                            type="number"
                            min="1"
                            value={levelsCount}
                            onChange={(e) => setLevelsCount(Number(e.target.value) || 1)}
                            className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                          />
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
                          <select
                            value={constructionType}
                            onChange={(e) => setConstructionType(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                          >
                            <option value="Modern">Moderna</option>
                            <option value="Contemporary">Contemporánea</option>
                            <option value="Classic">Clásica</option>
                            <option value="Minimalist">Minimalista</option>
                            <option value="Rustic">Rústica</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-brand-gray-500">Estado de Conservación</label>
                          <select
                            value={conservationState}
                            onChange={(e) => setConservationState(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-xs font-semibold"
                          >
                            <option value="Excellent">Excelente</option>
                            <option value="Good">Bueno</option>
                            <option value="Fair">Regular</option>
                            <option value="Remodelado">Remodelado</option>
                            <option value="Para remodelar">Requiere remodelación</option>
                          </select>
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
                      <p className="text-xs text-brand-gray-500 mt-0.5">Selecciona el equipamiento y amenidades activas en el espacio.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
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
                  </motion.div>
                )}

                {/* STEP 6: Información Legal */}
                {step === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <FileText className="w-4 h-4" />
                        <span>Paso 6: Información Legal</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Indica las condiciones jurídicas del expediente de la propiedad.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="legalDebtFree"
                            checked={legalDebtFree}
                            onChange={(e) => setLegalDebtFree(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="legalDebtFree" className="text-xs font-bold text-brand-black cursor-pointer">
                            Libre de Gravamen
                          </label>
                        </div>

                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="legalPublicDeed"
                            checked={legalPublicDeed}
                            onChange={(e) => setLegalPublicDeed(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="legalPublicDeed" className="text-xs font-bold text-brand-black cursor-pointer">
                            Escritura Pública
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="legalTaxCurrent"
                            checked={legalTaxCurrent}
                            onChange={(e) => setLegalTaxCurrent(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="legalTaxCurrent" className="text-xs font-bold text-brand-black cursor-pointer">
                            Predial al Corriente
                          </label>
                        </div>

                        <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
                          <input
                            type="checkbox"
                            id="legalIsMortgaged"
                            checked={legalIsMortgaged}
                            onChange={(e) => setLegalIsMortgaged(e.target.checked)}
                            className="w-4 h-4 accent-brand-accent cursor-pointer"
                          />
                          <label htmlFor="legalIsMortgaged" className="text-xs font-bold text-brand-black cursor-pointer">
                            ¿Tiene Hipoteca activa?
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-xs font-bold text-brand-gray-500">Régimen de Propiedad</label>
                        <select
                          value={legalOwnerType}
                          onChange={(e) => setLegalOwnerType(e.target.value)}
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        >
                          <option value="Privada">Propiedad Privada (Escriturada)</option>
                          <option value="Ejidal">Ejidal / Posesión</option>
                          <option value="Fideicomiso">Fideicomiso Bancario</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 7: Multimedia */}
                {step === 7 && (
                  <motion.div
                    key="step7"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Image className="w-4 h-4" />
                        <span>Paso 7: Galería y Multimedia</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Agrega las fotos oficiales y enlaces a recorridos virtuales 3D.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Imágenes</span>
                        <ImageUploadDropzone
                          images={images}
                          onChange={setImages}
                          imagesMetadata={imagesMetadata}
                          onMetadataChange={setImagesMetadata}
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
                        <label className="text-xs font-bold text-brand-gray-500">Recorrido Virtual 3D (Matterport)</label>
                        <input
                          type="text"
                          value={virtualTourPlaceholder}
                          onChange={(e) => setVirtualTourPlaceholder(e.target.value)}
                          placeholder="Ej. https://my.matterport.com/show/?m=..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 8: Información Comercial & SEO */}
                {step === 8 && (
                  <motion.div
                    key="step8"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Briefcase className="w-4 h-4" />
                        <span>Paso 8: Comercial & SEO</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Configura exclusivas, comisiones de red y meta etiquetas para buscadores.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-white">
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

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Comisión Total (%)</label>
                          <input
                            type="number"
                            value={commissionTotalPct}
                            onChange={(e) => setCommissionTotalPct(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ej. 5%"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500">Comisión Compartida (%)</label>
                          <input
                            type="number"
                            value={commissionSharedPct}
                            onChange={(e) => setCommissionSharedPct(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ej. 2.5%"
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Meta Title SEO</label>
                        <input
                          type="text"
                          value={metaTitle}
                          onChange={(e) => setMetaTitle(e.target.value)}
                          placeholder="Ej. Mansión en Renta Culiacán Tres Ríos"
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500">Meta Description SEO</label>
                        <input
                          type="text"
                          value={metaDescription}
                          onChange={(e) => setMetaDescription(e.target.value)}
                          placeholder="Descripción breve para motores de búsqueda..."
                          className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 9: Vista Previa y Publicación */}
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
                        <Sparkles className="w-4 h-4" />
                        <span>Paso 9: Vista Previa</span>
                      </h4>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Valida el resumen técnico del anuncio antes de guardarlo en base de datos.</p>
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
                          <p className="font-semibold text-brand-black">{bedrooms} Rec • {bathrooms} Baños • {parkingSpaces} Est</p>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

              {step === 9 ? (
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
                  disabled={
                    (step === 1 && (!title || !description)) ||
                    (step === 2 && (!location || !country)) ||
                    (step === 3 && selectedModes.length === 0)
                  }
                  className={`px-6 py-3 bg-brand-black hover:bg-brand-black/90 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    ((step === 1 && (!title || !description)) ||
                     (step === 2 && (!location || !country)) ||
                     (step === 3 && selectedModes.length === 0))
                      ? 'opacity-40 cursor-not-allowed shadow-none'
                      : ''
                  }`}
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
