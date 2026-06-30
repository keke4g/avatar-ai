import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Sparkles, Check, Info, Loader2,
  Home, DollarSign, Calendar, MessageSquareCode, Award, Shield, User, Building, Briefcase, Camera, Play, Eye, AlertTriangle
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

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const AMENITY_OPTIONS = [
  'Wifi',
  'Aire acondicionado',
  'Cocina equipada',
  'Estacionamiento',
  'Alberca',
  'Jardín',
  'Terraza',
  'Asador',
  'Lavadora',
  'Secadora',
  'Seguridad 24/7',
  'Pet Friendly'
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

  // STEP 2: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<UIType>('Departamento');
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

  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  // STEP 3: Specs & Features
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [halfBathrooms, setHalfBathrooms] = useState(0);
  const [maxGuests, setMaxGuests] = useState(4);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // STEP 4: Media & Gallery
  const [images, setImages] = useState<string[]>([]);
  const [imagesMetadata, setImagesMetadata] = useState<Record<string, any>>({});
  const [videoPlaceholder, setVideoPlaceholder] = useState('');
  const [virtualTourPlaceholder, setVirtualTourPlaceholder] = useState('');

  // STEP 5: Dynamic Configuration Values
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
    else if (step === 1 && selectedModes.length > 0) setStep(2);
    else if (step === 2 && title && location && country && description) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4) setStep(5);
  };

  const handleBack = () => {
    if (step === 1 && initialData) return; // Prevent going to Step 0 when editing
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
          swapPreferences: { text: swapPreferences },
          auraScoreOverride: existing?.auraScoreOverride || initialData?.auraScore || 95
        };
      } else if (mode === 'SHORT_RENT') {
        return {
          ...baseOffering,
          priceAmount: nightlyPrice,
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
          acceptsOffers: saleAcceptsOffers
        };
      }
      return baseOffering;
    });

    const compiledPropertyData = {
      title,
      description,
      type: mapUiToDbType(type),
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
      bedrooms,
      bathrooms,
      maxGuests,
      amenities: selectedAmenities,
      halfBathrooms,
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'],
      valueRating: selectedModes.includes('SWAP') ? swapValueTier : 'Premium',
      availableStart: selectedModes.includes('SWAP') ? swapAvailableStart : '2026-06-01',
      availableEnd: selectedModes.includes('SWAP') ? swapAvailableEnd : '2026-12-31',
      offerings,
      metadata: {
        publisherType,
        videoPlaceholder,
        virtualTourPlaceholder,
        uiPropertyType: type,
        halfBathrooms,
        imagesMetadata
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
                {([0, 1, 2, 3, 4, 5] as const).map(s => {
                  if (initialData && s === 0) return null; // Hide Step 0 indicator on edit
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

                {/* STEP 1: Premium Offering Card Selectors */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Award className="w-4 h-4" />
                        <span>Paso 1: Modalidad de Publicación</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">¿Cómo deseas publicar esta propiedad?</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Puedes elegir múltiples opciones comerciales para habilitar la experiencia híbrida.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-1">
                      {/* Premium SWAP Card */}
                      <button
                        type="button"
                        onClick={() => toggleMode('SWAP')}
                        className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-[108px] ${
                          selectedModes.includes('SWAP') 
                            ? 'border-brand-accent bg-brand-accent/[0.02] ring-2 ring-brand-accent/25 shadow-md' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-accent/5 flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                          </div>
                          <span className="text-xs font-bold text-brand-black">Intercambio Gratis (SWAP)</span>
                        </div>
                        <p className="text-[10px] text-brand-gray-500 leading-normal mt-1.5 flex-1">
                          Haz trueque de casa libre de renta con otros anfitriones verificado. Ahorra 100%.
                        </p>
                      </button>

                      {/* SHORT_RENT Card */}
                      <button
                        type="button"
                        onClick={() => toggleMode('SHORT_RENT')}
                        className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-[108px] ${
                          selectedModes.includes('SHORT_RENT') 
                            ? 'border-brand-accent bg-brand-accent/[0.02] ring-2 ring-brand-accent/25 shadow-md' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-accent/5 flex items-center justify-center shrink-0">
                            <Home className="w-3.5 h-3.5 text-brand-accent" />
                          </div>
                          <span className="text-xs font-bold text-brand-black">Renta Temporal (Airbnb style)</span>
                        </div>
                        <p className="text-[10px] text-brand-gray-500 leading-normal mt-1.5 flex-1">
                          Renta por noche o semana. Excelente para nómadas digitales y estancias vacacionales.
                        </p>
                      </button>

                      {/* MONTHLY_RENT Card */}
                      <button
                        type="button"
                        onClick={() => toggleMode('MONTHLY_RENT')}
                        className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-[108px] ${
                          selectedModes.includes('MONTHLY_RENT') 
                            ? 'border-brand-accent bg-brand-accent/[0.02] ring-2 ring-brand-accent/25 shadow-md' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-accent/5 flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                          </div>
                          <span className="text-xs font-bold text-brand-black">Renta Mensual Flexible</span>
                        </div>
                        <p className="text-[10px] text-brand-gray-500 leading-normal mt-1.5 flex-1">
                          Alquiler de mediano plazo (mensual) con contratos digitales rápidos y mínimos depósitos.
                        </p>
                      </button>

                      {/* SALE Card */}
                      <button
                        type="button"
                        onClick={() => toggleMode('SALE')}
                        className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-[108px] ${
                          selectedModes.includes('SALE') 
                            ? 'border-brand-accent bg-brand-accent/[0.02] ring-2 ring-brand-accent/25 shadow-md' 
                            : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-accent/5 flex items-center justify-center shrink-0">
                            <DollarSign className="w-3.5 h-3.5 text-brand-accent" />
                          </div>
                          <span className="text-xs font-bold text-brand-black">Venta</span>
                        </div>
                        <p className="text-[10px] text-brand-gray-500 leading-normal mt-1.5 flex-1">
                          Publica tu propiedad para compradores interesados y recibe solicitudes directamente.
                        </p>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Basic Information */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Info className="w-4 h-4" />
                        <span>Paso 2: Información Básica</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">Hablemos de tu alojamiento</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los datos descriptivos iniciales de tu espacio.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Title Input */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Título del anuncio</label>
                          <button
                            type="button"
                            onClick={handleImproveTitle}
                            disabled={!title.trim() || isImprovingTitle}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide uppercase transition-all duration-200 ${
                              isImprovingTitle
                                ? 'bg-brand-gray-50 border-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                                : !title.trim()
                                ? 'bg-brand-gray-50 border-brand-gray-100 text-brand-gray-300 cursor-not-allowed opacity-50'
                                : 'bg-brand-accent/5 border-brand-accent/20 hover:border-brand-accent text-brand-accent hover:bg-brand-accent/10 active:scale-95 cursor-pointer'
                            }`}
                          >
                            {isImprovingTitle ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Generando opciones...</span>
                              </>
                            ) : (
                              <span>✨ Mejorar con IA</span>
                            )}
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Penthouse con vista al bosque en las lomas..."
                          className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                        />
                        {titleOptions.length > 0 && (
                          <div className="mt-1.5 p-3.5 bg-brand-accent/[0.02] border border-brand-accent/15 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-brand-accent uppercase tracking-wider">
                                {language === 'es' ? 'Selecciona un título mejorado por IA:' : 'Select an AI-enhanced title:'}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setTitleOptions([])} 
                                className="text-[10px] text-brand-gray-500 hover:text-brand-black font-bold uppercase tracking-wider cursor-pointer"
                              >
                                {language === 'es' ? 'Omitir' : 'Skip'}
                              </button>
                            </div>
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                              {titleOptions.map((opt, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleSelectTitleOption(opt)}
                                  className="text-left text-xs p-3 bg-white border border-brand-gray-200 hover:border-brand-accent hover:bg-brand-accent/[0.01] rounded-xl transition-all font-semibold text-brand-black shadow-xs flex gap-2.5 items-center cursor-pointer hover:translate-x-0.5 duration-200"
                                >
                                  <span className="text-[10px] font-black text-brand-accent bg-brand-accent/5 border border-brand-accent/10 w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                                    {i + 1}
                                  </span>
                                  <span className="flex-1 leading-normal">{opt}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Grid for Property Type, Location */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Tipo de propiedad</label>
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value as UIType)}
                            className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                          >
                            {UI_TYPES.map(tOption => (
                              <option key={tOption} value={tOption}>{tOption}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Ciudad / Destino</label>
                          <input
                            type="text"
                            required
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="CDMX, Miami, etc."
                            className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                          />
                        </div>
                      </div>

                      {/* Country & Address Address */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">País</label>
                          <input
                            type="text"
                            required
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="México, Estados Unidos..."
                            className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Dirección Completa</label>
                          <input
                            type="text"
                            ref={autocompleteInputRef}
                            value={address}
                            onChange={(e) => handleAddressChange(e.target.value)}
                            placeholder="Calle, número, colonia, ciudad"
                            className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                          />
                          {geometrySource === 'google_places' ? (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                              ✓ Dirección validada por Google
                            </span>
                          ) : address ? (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                              ⚠ Ubicación aproximada (Manual - no se mostrará en el mapa)
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Mini Mapa de Vista Previa */}
                      {latitude !== null && longitude !== null && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">
                            Vista Previa de la Ubicación
                          </label>
                          <div 
                            id="wizard-preview-map" 
                            className="w-full h-40 rounded-2xl border border-brand-gray-200/60 overflow-hidden shadow-sm relative z-10 bg-brand-gray-100" 
                          />
                        </div>
                      )}

                      {/* Description Textarea */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Descripción del alojamiento</label>
                          <button
                            type="button"
                            onClick={handleImproveDescription}
                            disabled={!description.trim() || isImprovingDescription}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide uppercase transition-all duration-200 ${
                              isImprovingDescription
                                ? 'bg-brand-gray-50 border-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                                : !description.trim()
                                ? 'bg-brand-gray-50 border-brand-gray-100 text-brand-gray-300 cursor-not-allowed opacity-50'
                                : 'bg-brand-accent/5 border-brand-accent/20 hover:border-brand-accent text-brand-accent hover:bg-brand-accent/10 active:scale-95 cursor-pointer'
                            }`}
                          >
                            {isImprovingDescription ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Generando opciones...</span>
                              </>
                            ) : (
                              <span>✨ Mejorar con IA</span>
                            )}
                          </button>
                        </div>
                        <textarea
                          required
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe la arquitectura, el vecindario y las vistas de tu hogar..."
                          className="w-full h-16 p-3 bg-brand-gray-50 border border-brand-gray-200 rounded-xl text-xs font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed text-brand-black"
                        />
                        {descriptionOptions.length > 0 && (
                          <div className="mt-1.5 p-3.5 bg-brand-accent/[0.02] border border-brand-accent/15 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-brand-accent uppercase tracking-wider">
                                {language === 'es' ? 'Selecciona una descripción mejorada por IA:' : 'Select an AI-enhanced description:'}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setDescriptionOptions([])} 
                                className="text-[10px] text-brand-gray-500 hover:text-brand-black font-bold uppercase tracking-wider cursor-pointer"
                              >
                                {language === 'es' ? 'Omitir' : 'Skip'}
                              </button>
                            </div>
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                              {descriptionOptions.map((opt, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleSelectDescriptionOption(opt)}
                                  className="text-left text-xs p-3 bg-white border border-brand-gray-200 hover:border-brand-accent hover:bg-brand-accent/[0.01] rounded-xl transition-all font-semibold text-brand-black shadow-xs flex gap-2.5 items-start cursor-pointer hover:translate-x-0.5 duration-200"
                                >
                                  <span className="text-[10px] font-black text-brand-accent bg-brand-accent/5 border border-brand-accent/10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="flex-1 leading-relaxed">{opt}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Specs & Amenities Selection */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Shield className="w-4 h-4" />
                        <span>Paso 3: Características</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">Detalles de habitabilidad</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Ingresa los números de habitaciones, baños, camas y selecciona las amenidades.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Specs Row — always: bedrooms, bathrooms, half bathrooms */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider text-center">Habitaciones</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={bedrooms}
                            onChange={(e) => setBedrooms(parseInt(e.target.value) || 1)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider text-center">Baños Completos</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={bathrooms}
                            onChange={(e) => setBathrooms(parseInt(e.target.value) || 0)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider text-center">Medios Baños</label>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={halfBathrooms}
                            onChange={(e) => setHalfBathrooms(parseInt(e.target.value) || 0)}
                            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors text-center"
                          />
                        </div>
                      </div>

                      {/* Guests capacity — only for rental and SWAP modes */}
                      {selectedModes.some(m => m === 'SWAP' || m === 'SHORT_RENT' || m === 'MONTHLY_RENT') && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider text-center">Huéspedes Máx.</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={maxGuests}
                              onChange={(e) => setMaxGuests(parseInt(e.target.value) || 1)}
                              className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors text-center"
                            />
                          </div>
                        </div>
                      )}

                      {/* Amenities Options Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Amenidades disponibles</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                          {AMENITY_OPTIONS.map(amenity => {
                            const isSelected = selectedAmenities.includes(amenity);
                            return (
                              <button
                                key={amenity}
                                type="button"
                                onClick={() => toggleAmenity(amenity)}
                                className={`p-2.5 rounded-xl border text-[10px] font-bold text-left transition-all cursor-pointer flex items-center justify-between ${
                                  isSelected 
                                    ? 'border-brand-accent bg-brand-accent/5 text-brand-black'
                                    : 'border-brand-gray-200 bg-white text-brand-gray-500 hover:border-brand-gray-300'
                                }`}
                              >
                                <span>{amenity}</span>
                                {isSelected && <Check className="w-3 h-3 text-brand-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: Media, Photos and Tour Link */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Camera className="w-4 h-4" />
                        <span>Paso 4: Multimedia y Galería</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">Presentación visual de tu hogar</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Sube fotografías de alta resolución y añade enlaces para recorridos tridimensionales.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Image Upload Component */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider">Fotografías de la propiedad</label>
                        <ImageUploadDropzone 
                          images={images} 
                          onChange={setImages} 
                          imagesMetadata={imagesMetadata}
                          onMetadataChange={setImagesMetadata}
                        />
                      </div>

                      {/* Video Link */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          <span>Video promocional (Opcional - link de YouTube/Vimeo)</span>
                        </label>
                        <input
                          type="text"
                          value={videoPlaceholder}
                          onChange={(e) => setVideoPlaceholder(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                        />
                      </div>

                      {/* 3D Virtual Tour */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>Recorrido virtual 3D (Opcional - Matterport link)</span>
                        </label>
                        <input
                          type="text"
                          value={virtualTourPlaceholder}
                          onChange={(e) => setVirtualTourPlaceholder(e.target.value)}
                          placeholder="https://my.matterport.com/show/?m=..."
                          className="w-full p-3.5 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent transition-colors"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 5: Dynamic Configuration fields based on selected offerings */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
                        <Sparkles className="w-4 h-4" />
                        <span>Paso 5: Configuración de Ofertas</span>
                      </h4>
                      <h3 className="text-lg font-bold text-brand-black mt-1">Detalles comerciales específicos</h3>
                      <p className="text-xs text-brand-gray-500 mt-0.5">Configura las particularidades financieras para cada una de las modalidades elegidas.</p>
                    </div>

                    {selectedModes.length > 1 && (
                      <div className="flex flex-wrap gap-2 border-b border-brand-gray-100 pb-2 mb-4 shrink-0">
                        {selectedModes.map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setActiveConfigTab(mode)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              activeConfigTab === mode
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'bg-brand-gray-50 text-brand-gray-500 hover:bg-brand-gray-100'
                            }`}
                          >
                            {mode === 'SWAP' ? 'Swap' : mode === 'SHORT_RENT' ? 'Renta Corta' : mode === 'MONTHLY_RENT' ? 'Renta Mensual' : 'Venta'}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      {/* DYNAMIC BLOCK: SWAP */}
                      {selectedModes.includes('SWAP') && (activeConfigTab === 'SWAP' || selectedModes.length === 1) && (
                        <div className="border border-brand-accent/20 bg-brand-accent/[0.01] rounded-2xl p-4 flex flex-col gap-4">
                          <div className="flex items-center gap-2 border-b border-brand-accent/10 pb-2">
                            <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                            <span className="text-xs font-black uppercase text-brand-accent tracking-wider">Configuración de Intercambio (SWAP)</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Tier de valoración</label>
                              <select
                                value={swapValueTier}
                                onChange={(e) => setSwapValueTier(e.target.value as any)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold outline-none focus:border-brand-accent"
                              >
                                <option value="Premium">Premium</option>
                                <option value="Luxury">Luxury</option>
                                <option value="Exclusive">Exclusive</option>
                                <option value="Curated">Curated</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1.5 font-semibold text-brand-gray-500 text-xs">
                              <label className="text-xs font-bold text-brand-gray-500">Disponibilidad de intercambio</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="date"
                                  value={swapAvailableStart}
                                  onChange={(e) => setSwapAvailableStart(e.target.value)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-[10px]"
                                />
                                <span className="text-brand-gray-400">a</span>
                                <input
                                  type="date"
                                  value={swapAvailableEnd}
                                  onChange={(e) => setSwapAvailableEnd(e.target.value)}
                                  className="w-full p-2.5 rounded-xl border border-brand-gray-200 text-[10px]"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-brand-gray-500">Preferencias de intercambio de destino</label>
                            <input
                              type="text"
                              value={swapPreferences}
                              onChange={(e) => setSwapPreferences(e.target.value)}
                              placeholder="Ej. Casa frente al mar en Costa Rica, apartamento céntrico en París..."
                              className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-medium"
                            />
                          </div>
                        </div>
                      )}

                      {/* DYNAMIC BLOCK: SHORT_RENT */}
                      {selectedModes.includes('SHORT_RENT') && (activeConfigTab === 'SHORT_RENT' || selectedModes.length === 1) && (
                        <div className="border border-emerald-200/80 bg-emerald-50/5 rounded-2xl p-4 flex flex-col gap-4">
                          <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                            <Home className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">Configuración de Renta Temporal</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Precio por noche ($ USD)</label>
                              <input
                                type="number"
                                min="10"
                                value={nightlyPrice}
                                onChange={(e) => setNightlyPrice(parseInt(e.target.value) || 10)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Precio por semana ($ USD)</label>
                              <input
                                type="number"
                                min="50"
                                value={weeklyPrice}
                                onChange={(e) => setWeeklyPrice(parseInt(e.target.value) || 50)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Estancia mínima (Noches)</label>
                              <input
                                type="number"
                                min="1"
                                value={shortMinNights}
                                onChange={(e) => setShortMinNights(parseInt(e.target.value) || 1)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Depósito de garantía ($ USD)</label>
                              <input
                                type="number"
                                min="0"
                                value={shortDeposit}
                                onChange={(e) => setShortDeposit(parseInt(e.target.value) || 0)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* DYNAMIC BLOCK: MONTHLY_RENT */}
                      {selectedModes.includes('MONTHLY_RENT') && (activeConfigTab === 'MONTHLY_RENT' || selectedModes.length === 1) && (
                        <div className="border border-sky-200/80 bg-sky-50/5 rounded-2xl p-4 flex flex-col gap-4">
                          <div className="flex items-center gap-2 border-b border-sky-100 pb-2">
                            <Calendar className="w-3.5 h-3.5 text-sky-700" />
                            <span className="text-xs font-black uppercase text-sky-700 tracking-wider">Configuración de Renta Mensual</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Precio mensual ($ USD)</label>
                              <input
                                type="number"
                                min="100"
                                value={monthlyPrice}
                                onChange={(e) => setMonthlyPrice(parseInt(e.target.value) || 100)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Depósito de seguridad ($ USD)</label>
                              <input
                                type="number"
                                min="0"
                                value={monthlyDeposit}
                                onChange={(e) => setMonthlyDeposit(parseInt(e.target.value) || 0)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="checkbox"
                              id="monthlyContract"
                              checked={monthlyContract}
                              onChange={(e) => setMonthlyContract(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="monthlyContract" className="text-xs font-semibold text-brand-gray-600 cursor-pointer">
                              Requiere firma de contrato de arrendamiento formal.
                            </label>
                          </div>
                        </div>
                      )}

                      {/* DYNAMIC BLOCK: SALE */}
                      {selectedModes.includes('SALE') && (activeConfigTab === 'SALE' || selectedModes.length === 1) && (
                        <div className="border border-amber-200 bg-amber-50/5 rounded-2xl p-4 flex flex-col gap-4">
                          <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                            <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                            <span className="text-xs font-black uppercase text-amber-700 tracking-wider">Configuración de Venta</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Precio de venta comercial</label>
                              <input
                                type="text"
                                value={salePrice ? `$${salePrice.toLocaleString('en-US')}.00` : '$0.00'}
                                onChange={(e) => setSalePrice(parseCurrency(e.target.value))}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-brand-gray-500">Moneda del listado</label>
                              <select
                                value={saleCurrency}
                                onChange={(e) => setSaleCurrency(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-200 text-xs font-semibold"
                              >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="MXN">MXN ($)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="checkbox"
                              id="saleAcceptsOffers"
                              checked={saleAcceptsOffers}
                              onChange={(e) => setSaleAcceptsOffers(e.target.checked)}
                              className="w-4 h-4 accent-brand-accent cursor-pointer"
                            />
                            <label htmlFor="saleAcceptsOffers" className="text-xs font-semibold text-brand-gray-600 cursor-pointer">
                              Acepta ofertas y contrapropuestas de compradores validados.
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Danger Zone when editing */}
                      {initialData && onDelete && (
                        <div className="border border-brand-rose/25 bg-brand-rose/[0.02] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8">
                          <div>
                            <h4 className="text-xs font-black text-brand-rose uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{language === 'es' ? 'Zona de Peligro' : 'Danger Zone'}</span>
                            </h4>
                            <p className="text-[10px] text-brand-gray-500 font-medium mt-1 leading-normal max-w-sm">
                              {language === 'es' 
                                ? 'Elimina permanentemente esta propiedad de AuraSwap. Se cancelarán las negociaciones de swaps.' 
                                : 'Permanently remove this property from AuraSwap. Active swap proposals will be cancelled.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalDeleteConfirm(true)}
                            className="px-4 py-2 border border-brand-rose text-brand-rose hover:bg-brand-rose hover:text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                          >
                            {t('dashboard.deleteProperty') || 'Eliminar Propiedad'}
                          </button>
                        </div>
                      )}
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

              {step === 5 ? (
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
                    (step === 1 && selectedModes.length === 0) ||
                    (step === 2 && (!title || !location || !country || !description))
                  }
                  className={`px-6 py-3 bg-brand-black hover:bg-brand-black/90 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    ((step === 1 && selectedModes.length === 0) || (step === 2 && (!title || !location || !country || !description)))
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
