"use client";

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { formatCount, formatBathrooms } from '../../../lib/textHelpers';
import { useSwap } from '../../../lib/context/SwapContext';
import { useTranslation } from '../../../lib/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { 
  Star, ShieldCheck, Heart, Share, Calendar, MapPin, Sparkles, AlertCircle,
  BedDouble, Bath, Users, ArrowRight, ChevronLeft, ChevronRight,
  Wifi, Waves, Coffee, Monitor, Wind, Key, Flame, Compass, MessageSquareCode,
  ZoomIn, ZoomOut, Maximize, Download, ExternalLink, Play, FileText, Info, ShieldAlert, Award, TrendingUp, BarChart2, FileCheck, RefreshCw,
  Car, Building, Home, PhoneCall, Mail, UserRound, MessageCircle, Clock3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { LeadType, Property, PropertyOffering, PropertyOfferingMode } from '../../../lib/types';
import { MOCK_USERS } from '../../../lib/mockData';
import { getActiveOfferings, getOfferingsByMode } from '../../../lib/propertyOfferings';
import { useLiveContext } from '../../../lib/context/LiveContext';
import { PropertyEligibilityEngine } from '../../../lib/services/PropertyEligibilityEngine';
import { LegalDossierSection } from '../../../components/property/sections/LegalDossierSection';
import { FinancingCompatibility } from '../../../components/property/sections/FinancingCompatibility';
import { EternaMarketAnalysis } from '../../../components/property/sections/EternaMarketAnalysis';

interface PropertyDetailsClientProps {
  id: string;
}

// Map of amenity names to icons
const AMENITY_ICONS: Record<string, any> = {
  'Wifi': Wifi,
  'Workstation': Monitor,
  'Air Conditioning': Wind,
  'Washing Machine': Key,
  'Bicycles': Compass,
  'Balcony': Coffee,
  'Fireplace': Flame,
  'Outdoor Deck': Coffee,
  'Coffee Station': Coffee,
  'Mountain View': Compass,
  'Hiking Trails': Compass,
  'High-Speed Starlink': Wifi,
  'Infinity Pool': Waves,
  'Private Beach': Waves,
  'Chef Kitchen': Coffee,
  'Home Theater': Monitor,
  'Ocean Views': Waves,
  'Paddleboards': Waves,
  'Tesla Charger': Key,
  'Espresso Bar': Coffee,
  'Vintage Record Player': Monitor,
  'Library': Key,
  'French Balcony': Coffee,
  'Dyson Airwrap': Wind,
  'Rooftop Garden': Coffee,
  'Dedicated Workspace': Monitor,
  'Chef Stove': Coffee,
  'Espresso Maker': Coffee,
  'Art Collection': Key,
  'Semi-Outdoor Shower': Waves,
  'Scooters Included': Compass,
  'Yoga Deck': Compass,
  'Rice Terrace Views': Compass,
  'Fully Staffed': Users,
  'Professional Grade Range': Coffee,
  'Backyard Deck': Coffee,
  'Infrared Sauna': Waves,
  'Piano': Monitor,
  'Office Workspace': Monitor,
  'Sonos System': Monitor
};

const OFFERING_BADGE_ORDER: PropertyOfferingMode[] = ['SWAP', 'SHORT_RENT', 'MONTHLY_RENT', 'SALE'];

const OFFERING_BADGE_META: Record<PropertyOfferingMode, { label: string; className: string }> = {
  SWAP: {
    label: 'Intercambio',
    className: 'border-brand-accent/25 bg-brand-accent/5 text-brand-accent',
  },
  SHORT_RENT: {
    label: 'Renta temporal',
    className: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-700',
  },
  MONTHLY_RENT: {
    label: 'Renta mensual',
    className: 'border-sky-200/80 bg-sky-50/70 text-sky-700',
  },
  SALE: {
    label: 'Venta',
    className: 'border-amber-200/80 bg-amber-50/70 text-amber-700',
  },
};

interface SpecFieldConfig {
  key: keyof Property;
  labelEs: string;
  labelEn: string;
  format?: (value: any, lang: 'es' | 'en') => string;
}

const SPEC_FIELDS: SpecFieldConfig[] = [
  { key: 'developmentName', labelEs: 'Desarrollo', labelEn: 'Development' },
  { key: 'subdivisionName', labelEs: 'Fraccionamiento', labelEn: 'Subdivision' },
  { key: 'privateNeighborhood', labelEs: 'Privada', labelEn: 'Gated Community', format: (v, lang) => typeof v === 'boolean' ? (v ? (lang === 'es' ? 'Sí' : 'Yes') : (lang === 'es' ? 'No' : 'No')) : String(v) },
  { key: 'phaseStage', labelEs: 'Etapa/Fase', labelEn: 'Phase/Stage' },
  { key: 'lotNumber', labelEs: 'Número de lote', labelEn: 'Lot Number' },
  { key: 'blockNumber', labelEs: 'Manzana', labelEn: 'Block' },
  { key: 'condominiumRegime', labelEs: 'Régimen de condominio', labelEn: 'Condominium Regime', format: (v, lang) => v ? (lang === 'es' ? 'Sí' : 'Yes') : (lang === 'es' ? 'No' : 'No') },
  { key: 'maintenanceFeeAmount', labelEs: 'Mantenimiento mensual', labelEn: 'Monthly Maintenance', format: (v) => `$${v} USD` },
  { key: 'neighborhood', labelEs: 'Colonia / Barrio', labelEn: 'Neighborhood' },
  { key: 'postalCode', labelEs: 'Código Postal', labelEn: 'Postal Code' },
  { key: 'streetName', labelEs: 'Calle', labelEn: 'Street' },
  { key: 'streetNumber', labelEs: 'Número exterior', labelEn: 'Street Number' },
  { key: 'locationReference', labelEs: 'Referencia de ubicación', labelEn: 'Location Reference' },
  { key: 'levelsCount', labelEs: 'Niveles', labelEn: 'Levels' },
  { key: 'constructionAge', labelEs: 'Antigüedad', labelEn: 'Age', format: (v, lang) => v === 0 ? (lang === 'es' ? 'Nueva' : 'Brand New') : `${v} ${lang === 'es' ? 'años' : 'years'}` },
  { key: 'conservationStateId', labelEs: 'Estado de conservación', labelEn: 'Conservation State' },
  { key: 'constructionTypeId', labelEs: 'Tipo de construcción', labelEn: 'Construction Type' },
  { key: 'surfaceTotal', labelEs: 'Superficie de terreno', labelEn: 'Total Land Area', format: (v) => `${v} m²` },
  { key: 'surfaceBuilt', labelEs: 'Superficie de construcción', labelEn: 'Built Area', format: (v) => `${v} m²` },
  { key: 'surfaceFront', labelEs: 'Frente', labelEn: 'Frontage', format: (v) => `${v} m` },
  { key: 'surfaceDepth', labelEs: 'Fondo', labelEn: 'Depth', format: (v) => `${v} m` },
  { key: 'surfaceGarden', labelEs: 'Superficie de jardín', labelEn: 'Garden Area', format: (v) => `${v} m²` },
  { key: 'surfaceTerrace', labelEs: 'Superficie de terraza', labelEn: 'Terrace Area', format: (v) => `${v} m²` },
  { key: 'surfaceRoofGarden', labelEs: 'Superficie de Roof Garden', labelEn: 'Roof Garden Area', format: (v) => `${v} m²` },
  { key: 'surfacePatio', labelEs: 'Superficie de patio', labelEn: 'Patio Area', format: (v) => `${v} m²` },
  { key: 'viewTypeId', labelEs: 'Vista', labelEn: 'View' },
  { key: 'orientationId', labelEs: 'Orientación', labelEn: 'Orientation' },
  { key: 'internalCode', labelEs: 'Clave Interna', labelEn: 'Internal Code' }
];

const SERVICES_FIELDS: SpecFieldConfig[] = [
  { key: 'servicesWater', labelEs: 'Agua potable', labelEn: 'Drinking Water', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesElectricity', labelEs: 'Electricidad', labelEn: 'Electricity', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesSewerage', labelEs: 'Drenaje / Alcantarillado', labelEn: 'Sewerage', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesNatGas', labelEs: 'Gas Natural', labelEn: 'Natural Gas', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesLpGas', labelEs: 'Gas LP', labelEn: 'LP Gas', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activo' : 'Available/Active') : '' },
  { key: 'servicesInternet', labelEs: 'Conexión a Internet', labelEn: 'Internet Access' },
  { key: 'servicesGarbage', labelEs: 'Recolección de basura', labelEn: 'Garbage Collection', format: (v, lang) => v ? (lang === 'es' ? 'Disponible/Activa' : 'Available/Active') : '' }
];

const SECURITY_FIELDS: SpecFieldConfig[] = [
  { key: 'securityCctv', labelEs: 'Sistema de CCTV / Cámaras', labelEn: 'CCTV Camera System', format: (v, lang) => v ? (lang === 'es' ? 'Instalado/Activo' : 'Installed/Active') : '' },
  { key: 'securityGuardhouse', labelEs: 'Caseta de vigilancia', labelEn: 'Security Guardhouse', format: (v, lang) => v ? (lang === 'es' ? 'Disponible' : 'Available') : '' },
  { key: 'security24_7', labelEs: 'Seguridad 24/7', labelEn: '24/7 Security Service', format: (v, lang) => v ? (lang === 'es' ? 'Activa' : 'Active') : '' },
  { key: 'securityBiometric', labelEs: 'Acceso biométrico / digital', labelEn: 'Biometric/Digital Access', format: (v, lang) => v ? (lang === 'es' ? 'Instalado' : 'Installed') : '' }
];

export default function PropertyDetailsClient({ id }: PropertyDetailsClientProps) {
  const router = useRouter();
  const { properties, myProperties, requestSwap, favorites, toggleFavorite, currentUser, swaps, reviews, users, createLead, loading } = useSwap();
  const { t, language } = useTranslation();
  const { setActiveProperty, clearActiveProperty } = useLiveContext();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const property = properties.find((p) => p.id === id);

  const allAmenities = useMemo(() => {
    if (!property) return [];
    return [
      ...(property.amenities || []),
      ...(property.metadata?.customAmenities || [])
    ];
  }, [property]);

  const mediaItems = useMemo(() => {
    const items: { type: 'image' | 'video'; url: string }[] = [];
    if (!property) return items;

    // Load from property.media if available, otherwise fallback to property.images
    if (property.media && property.media.length > 0) {
      property.media.forEach(m => {
        if (m.mediaType === 'IMAGE') {
          items.push({ type: 'image', url: m.url });
        } else if (m.mediaType === 'VIDEO') {
          items.push({ type: 'video', url: m.url });
        }
      });
    } else {
      if (property.images && property.images.length > 0) {
        property.images.forEach(url => {
          items.push({ type: 'image', url });
        });
      }
    }

    return items;
  }, [property]);

  const renderMediaItem = (item: { type: 'image' | 'video' | 'youtube'; url: string }, className?: string) => {
    if (item.type === 'youtube') {
      let videoId = '';
      if (item.url.includes('youtube.com')) {
        const parts = item.url.split('v=');
        if (parts.length > 1) videoId = parts[1].split('&')[0];
      } else if (item.url.includes('youtu.be')) {
        const parts = item.url.split('/');
        videoId = parts[parts.length - 1].split('?')[0];
      }
      const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : item.url;

      return (
        <iframe
          src={embedUrl}
          className={`${className} border-0`}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      );
    }

    if (item.type === 'video') {
      return (
        <video
          src={item.url}
          controls
          className={className}
        />
      );
    }

    return (
      <img
        src={item.url}
        alt={property?.title || ''}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailsMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailsMarkerRef = useRef<any>(null);
  const [detailsLeafletLoaded, setDetailsLeafletLoaded] = useState(false);

  // Premium Lightbox Gallery States
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error enabling fullscreen: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  // Financing Calculator States
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [financingTermYears, setFinancingTermYears] = useState(20);

  // Multimedia Tab States
  const [activeMediaTab, setActiveMediaTab] = useState<string>('');
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  // Keyboard and helper functions for Premium Gallery
  const handlePrevImage = () => {
    if (mediaItems.length === 0) return;
    setIsZoomed(false);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setGalleryIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (mediaItems.length === 0) return;
    setIsZoomed(false);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setGalleryIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (!isGalleryOpen || mediaItems.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGalleryOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGalleryOpen, galleryIndex, mediaItems]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isGalleryOpen) return;
    const newScale = zoomScale + (e.deltaY < 0 ? 0.25 : -0.25);
    const clampedScale = Math.max(1, Math.min(4, newScale));
    setZoomScale(clampedScale);
    setIsZoomed(clampedScale > 1);
    if (clampedScale === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleDoubleClick = () => {
    if (isZoomed) {
      setIsZoomed(false);
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setIsZoomed(true);
      setZoomScale(2.5);
    }
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!property || property.latitude === null || property.longitude === null) return;

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
        setDetailsLeafletLoaded(true);
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.id = 'leaflet-js-cdn';
        script.onload = () => {
          setDetailsLeafletLoaded(true);
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Leaflet'));
        document.head.appendChild(script);
      });
    };

    loadLeaflet().catch(err => console.error('[Details Leaflet Load Error]:', err));
  }, [property]);

  useEffect(() => {
    if (!detailsLeafletLoaded || !property || property.latitude === null || property.longitude === null) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('property-details-map');
    if (!container) return;

    try {
      if (!detailsMapRef.current) {
        const map = L.map('property-details-map', {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: false
        }).setView([property.latitude, property.longitude], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(map);

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker-selected',
          html: `<div class="w-3 h-3 bg-brand-black rounded-full border-2 border-white shadow-premium"></div>`
        });

        const marker = L.marker([property.latitude, property.longitude], { icon: customIcon }).addTo(map);

        detailsMapRef.current = map;
        detailsMarkerRef.current = marker;
      } else {
        const map = detailsMapRef.current;
        const marker = detailsMarkerRef.current;
        map.setView([property.latitude, property.longitude], 14);
        if (marker) {
          marker.setLatLng([property.latitude, property.longitude]);
        }
      }

      setTimeout(() => {
        if (detailsMapRef.current) {
          detailsMapRef.current.invalidateSize();
        }
      }, 150);
    } catch (e) {
      console.error('[Details Map Init Error]:', e);
    }

    return () => {
      if (detailsMapRef.current) {
        try {
          detailsMapRef.current.remove();
        } catch {}
        detailsMapRef.current = null;
        detailsMarkerRef.current = null;
      }
    };
  }, [detailsLeafletLoaded, property]);

  useEffect(() => {
    if (property) {
      setActiveProperty(property);
    }
    return () => {
      clearActiveProperty();
    };
  }, [property, setActiveProperty, clearActiveProperty]);

  const activeOfferingModes = useMemo(() => {
    if (!property) return [];
    const activeModes = new Set(getActiveOfferings(property).map((offering) => offering.mode));
    return OFFERING_BADGE_ORDER.filter((mode) => activeModes.has(mode));
  }, [property]);

  const hasSwapOffering = activeOfferingModes.includes('SWAP');
  const hasRentOffering = activeOfferingModes.includes('SHORT_RENT') || activeOfferingModes.includes('MONTHLY_RENT');
  const hasSaleOffering = activeOfferingModes.includes('SALE');

  const activeRentOffering = useMemo(() => {
    if (!property) return null;
    return getOfferingsByMode(property, 'SHORT_RENT', { activeOnly: true })[0] ||
      getOfferingsByMode(property, 'MONTHLY_RENT', { activeOnly: true })[0] ||
      null;
  }, [property]);

  const activeSaleOffering = useMemo(() => {
    if (!property) return null;
    return getOfferingsByMode(property, 'SALE', { activeOnly: true })[0] || null;
  }, [property]);

  const hostReviews = useMemo(() => {
    if (!reviews || !property) return [];
    return reviews.filter(r => r.reviewedUserId === property.hostId);
  }, [reviews, property?.hostId]);

  const hostCompletedSwapsCount = useMemo(() => {
    if (!swaps || !property) return 0;
    return swaps.filter(s => 
      s.status === 'COMPLETED' && 
      (s.senderId === property.hostId || s.receiverId === property.hostId)
    ).length;
  }, [swaps, property?.hostId]);

  const dynamicRating = useMemo(() => {
    if (!property) return 5;
    if (hostReviews.length === 0) return property.hostRating;
    return (hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length);
  }, [hostReviews, property]);

  const dynamicReviewsCount = useMemo(() => {
    if (!property) return 0;
    return hostReviews.length > 0 ? hostReviews.length : property.hostReviewsCount;
  }, [hostReviews, property]);

  const combinedReviews = useMemo(() => {
    if (!property) return [];
    const mock = (property.reviews || []).map(r => ({
      id: r.id,
      authorName: r.authorName,
      authorAvatar: r.authorAvatar,
      rating: r.rating,
      date: r.date,
      comment: r.comment,
      isVerified: false
    }));

    const verified = hostReviews.map(r => {
      const reviewer = users.find(u => u.id === r.reviewerId) || MOCK_USERS.find(u => u.id === r.reviewerId);
      return {
        id: r.id,
        authorName: reviewer?.name || (language === 'es' ? 'Otro anfitrión' : 'Other host'),
        authorAvatar: reviewer?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        rating: r.rating,
        date: new Date(r.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        comment: r.comment,
        isVerified: true
      };
    });

    return [...verified, ...mock];
  }, [hostReviews, property, users, language]);

  // Dynamic image error tracker for multi-photo grids
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setFailedImages(prev => ({ ...prev, [index]: true }));
  };

  const getImageUrl = (index: number) => {
    if (!property) return '';
    const fallbackUrls = [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80'
    ];
    if (failedImages[index] || !property.images || !property.images[index]) {
      return fallbackUrls[index % fallbackUrls.length];
    }
    return property.images[index];
  };

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<PropertyOfferingMode | null>(null);
  const [isEvaluablesExpanded, setIsEvaluablesExpanded] = useState(false);
  const [isNoCompatiblesExpanded, setIsNoCompatiblesExpanded] = useState(false);

  // Set default selected mode when activeOfferings load
  useEffect(() => {
    if (activeOfferingModes.length > 0) {
      if (activeOfferingModes.includes('SWAP')) {
        setSelectedMode('SWAP');
      } else {
        setSelectedMode(activeOfferingModes[0]);
      }
    }
  }, [activeOfferingModes]);
  const [leadSuccessOpen, setLeadSuccessOpen] = useState(false);
  const [selectedLeadOffering, setSelectedLeadOffering] = useState<PropertyOffering | null>(null);
  const [leadContactPreference, setLeadContactPreference] = useState<'message' | 'call'>('message');
  const [leadMessage, setLeadMessage] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [selectedMyPropId, setSelectedMyPropId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const numNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [startDate, endDate]);
  const [swapMessage, setSwapMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  // Calendar active month view state (defaults to September 2026 for initial view matches)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    return new Date(2026, 8, 1); // 0-indexed month: 8 is September
  });

  const calendarYear = currentCalendarDate.getFullYear();
  const calendarMonth = currentCalendarDate.getMonth(); // 0 to 11

  const isSelfProperty = useMemo(() => {
    return property && currentUser && property.hostId === currentUser.id;
  }, [property, currentUser]);

  useEffect(() => {
    const handleEternaContact = (event: Event) => {
      const detail = (event as CustomEvent<{
        propertyId?: string;
        channel?: 'message' | 'call';
        message?: string;
      }>).detail;

      if (!property || detail?.propertyId !== property.id) return;

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
  }, [activeRentOffering, activeSaleOffering, hasSwapOffering, language, property]);

  // Booked ranges calculations
  const bookedRanges = useMemo(() => {
    if (!property || !swaps) return [];
    return swaps
      .filter(s => 
        (s.senderPropertyId === property.id || s.receiverPropertyId === property.id) &&
        ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
      )
      .map(s => ({ start: s.startDate, end: s.endDate }));
  }, [property, swaps]);

  const hasOverlap = useMemo(() => {
    if (!startDate || !endDate) return false;
    
    // 1. Check overlap on target property
    const targetOverlap = bookedRanges.some(b => 
      (startDate >= b.start && startDate <= b.end) ||
      (endDate >= b.start && endDate <= b.end) ||
      (startDate <= b.start && endDate >= b.end)
    );
    if (targetOverlap) return true;

    // 2. Check overlap on user's selected property
    if (selectedMyPropId) {
      const myBooked = swaps
        .filter(s => 
          (s.senderPropertyId === selectedMyPropId || s.receiverPropertyId === selectedMyPropId) &&
          ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status)
        )
        .map(s => ({ start: s.startDate, end: s.endDate }));
      
      const myOverlap = myBooked.some(b => 
        (startDate >= b.start && startDate <= b.end) ||
        (endDate >= b.start && endDate <= b.end) ||
        (startDate <= b.start && endDate >= b.end)
      );
      return myOverlap;
    }

    return false;
  }, [startDate, endDate, bookedRanges, selectedMyPropId, swaps]);

  // Day generator for standard 6-row month grid (42 slots)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const days: Array<{ date: Date; type: 'prev' | 'current' | 'next'; key: string }> = [];

    // Fill previous month days (to start grid on Sunday)
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayVal = daysInPrevMonth - i;
      const prevDate = new Date(calendarYear, calendarMonth - 1, dayVal);
      days.push({
        date: prevDate,
        type: 'prev',
        key: `prev-${dayVal}`,
      });
    }

    // Fill current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const currDate = new Date(calendarYear, calendarMonth, day);
      days.push({
        date: currDate,
        type: 'current',
        key: `curr-${day}`,
      });
    }

    // Fill next month days to complete 6-row grid (42 elements)
    const remainingSlots = 42 - days.length;
    for (let day = 1; day <= remainingSlots; day++) {
      const nextDate = new Date(calendarYear, calendarMonth + 1, day);
      days.push({
        date: nextDate,
        type: 'next',
        key: `next-${day}`,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (clickedDate: Date) => {
    const clickedStr = clickedDate.toISOString().split('T')[0];

    // If clicked date is occupied or out of available bounds, do nothing
    const isOccupied = bookedRanges.some(b => clickedStr >= b.start && clickedStr <= b.end);
    const isWithinBounds = property ? (clickedStr >= property.availableStart && clickedStr <= property.availableEnd) : false;
    if (isOccupied || !isWithinBounds) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedStr);
      setEndDate('');
    } else {
      if (clickedStr < startDate) {
        setStartDate(clickedStr);
        setEndDate('');
      } else {
        // Enforce no blocked days in between
        let temp = new Date(startDate);
        const limit = new Date(clickedDate);
        let hasBlockedInBetween = false;

        while (temp <= limit) {
          const tempStr = temp.toISOString().split('T')[0];
          const occupied = bookedRanges.some(b => tempStr >= b.start && tempStr <= b.end);
          const within = property ? (tempStr >= property.availableStart && tempStr <= property.availableEnd) : false;
          if (occupied || !within) {
            hasBlockedInBetween = true;
            break;
          }
          temp.setDate(temp.getDate() + 1);
        }

        if (hasBlockedInBetween) {
          setStartDate(clickedStr);
          setEndDate('');
        } else {
          setEndDate(clickedStr);
        }
      }
    }
  };

  // Instant Validation status
  const rangeStatus = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 'invalid';

    let occupiedCount = 0;
    let outOfBoundsCount = 0;
    let totalDays = 0;

    let current = new Date(start);
    while (current <= end) {
      totalDays++;
      const currentStr = current.toISOString().split('T')[0];
      const isOccupied = bookedRanges.some(b => currentStr >= b.start && currentStr <= b.end);
      const isWithinBounds = property ? (currentStr >= property.availableStart && currentStr <= property.availableEnd) : false;

      if (isOccupied) occupiedCount++;
      if (!isWithinBounds) outOfBoundsCount++;
      
      current.setDate(current.getDate() + 1);
    }

    if (occupiedCount === 0 && outOfBoundsCount === 0) {
      return 'available';
    } else if (occupiedCount > 0 && occupiedCount < totalDays) {
      return 'partial';
    } else {
      return 'unavailable';
    }
  }, [startDate, endDate, bookedRanges, property]);

  // Pre-select user's first property in the swap request form
  React.useEffect(() => {
    if (myProperties.length > 0) {
      setSelectedMyPropId(myProperties[0].id);
    }
  }, [myProperties]);

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
          The property you are looking for does not exist in our verified network or has been un-published by its host.
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
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 }
      });
    }, 1000);
  };

  const openLeadModal = (offering: PropertyOffering | null) => {
    if (!offering) return;
    setSelectedLeadOffering(offering);
    setLeadContactPreference('message');
    setLeadMessage('');
    setLeadError('');
    setLeadModalOpen(true);
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

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24">
      
      {/* 1. Sub-Header: Title & Sharing Controls */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="bg-brand-accent/10 text-brand-accent text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-md">
            {t('details.swapTier', { tier: t(`valueRatings.${property.valueRating}`).startsWith('valueRatings.') ? property.valueRating : t(`valueRatings.${property.valueRating}`) })}
          </span>
          <span className="bg-brand-black text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md">
            {t('details.matchScore', { score: property.auraScore })}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-black">
            {t(`properties.${property.id}.title`).startsWith('properties.') ? property.title : t(`properties.${property.id}.title`)}
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-brand-gray-500 font-medium mt-1">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-brand-black text-brand-black" />
            <span className="text-brand-black font-semibold">{dynamicRating.toFixed(1)}</span>
            <span className="text-brand-gray-300">•</span>
            <span className="underline">{dynamicReviewsCount} {t('details.reviews')}</span>
          </div>
          <span className="hidden sm:inline text-brand-gray-300">•</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-gray-400" />
            <span>{property.location}, {property.country}</span>
          </div>
        </div>

        {activeOfferingModes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400">
              Disponible como
            </span>
            {activeOfferingModes.map((mode) => {
              const meta = OFFERING_BADGE_META[mode];
              return (
                <span
                  key={mode}
                  className={`inline-flex h-7 items-center rounded-full border px-3 text-[10px] font-extrabold leading-none tracking-wide shadow-sm ${meta.className}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Premium Image Grid (Apple/Airbnb Inspired) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl overflow-hidden shadow-premium mb-10 cursor-pointer">
        {/* Left main large image */}
        <div 
          onClick={() => { setGalleryIndex(0); setIsGalleryOpen(true); }}
          className="md:col-span-2 aspect-[4/3] md:aspect-square relative overflow-hidden bg-brand-gray-100 group"
        >
          {mediaItems[0] ? (
            renderMediaItem(mediaItems[0], "w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out")
          ) : (
            <div className="w-full h-full bg-brand-gray-100 flex items-center justify-center">
              <Compass className="w-12 h-12 text-brand-gray-300 animate-pulse" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-white/95 text-brand-black text-xs font-black px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{language === 'es' ? 'Ver galería' : 'View gallery'}</span>
            </span>
          </div>
          {mediaItems[0]?.type === 'video' && (
            <div className="absolute top-4 right-4 bg-brand-black/60 text-white p-2 rounded-full z-10 flex items-center justify-center">
              <Play className="w-4 h-4 fill-white text-white" />
            </div>
          )}
        </div>
        
        {/* Right sub-images grid */}
        <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => {
            const index = idx + 1;
            const item = mediaItems[index];
            if (!item) {
              return (
                <div key={`fallback-${index}`} className="aspect-square bg-brand-gray-100 flex items-center justify-center border border-brand-gray-200/50">
                  <Compass className="w-8 h-8 text-brand-gray-300 animate-pulse" />
                </div>
              );
            }
            return (
              <div 
                key={index} 
                onClick={() => { setGalleryIndex(index); setIsGalleryOpen(true); }}
                className="aspect-square relative overflow-hidden bg-brand-gray-100 group"
              >
                {renderMediaItem(item, "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out")}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="bg-white/95 text-brand-black text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
                    {language === 'es' ? 'Ver más' : 'View more'}
                  </span>
                </div>
                {item.type === 'video' && (
                  <div className="absolute top-2 right-2 bg-brand-black/60 text-white p-1.5 rounded-full z-10 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Main Split-Pane Content */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        
        {/* Left Column: Specifications & Descriptions */}
        <div className="flex-1 flex flex-col gap-8 w-full">
          
          {/* Price display at the top of Left Column */}
          {(() => {
            let priceText = '';
            let labelText = '';
            if (selectedMode === 'SALE' && activeSaleOffering) {
              priceText = `${activeSaleOffering.currency || 'USD'} $${(activeSaleOffering.priceAmount || 0).toLocaleString()}`;
              labelText = language === 'es' ? 'Precio de Venta' : 'Sale Price';
            } else if ((selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') && activeRentOffering) {
              priceText = `${activeRentOffering.currency || 'USD'} $${(activeRentOffering.priceAmount || 0).toLocaleString()} / ${language === 'es' ? 'mes' : 'month'}`;
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

          {/* Core specs highlights */}
          <div className="flex flex-wrap gap-x-8 gap-y-4 border-b border-brand-gray-200/80 pb-6">
            {/* Guests: Hide for SALE */}
            {selectedMode !== 'SALE' && property.maxGuests !== undefined && property.maxGuests !== null && property.maxGuests > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Users className="w-4 h-4 text-brand-gray-500" />
                  <span>{t('details.guests')}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {language === 'es' ? `Capacidad para ${formatCount(property.maxGuests, 'persona', 'personas', 'feminine')}` : `${property.maxGuests} guest${property.maxGuests !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {/* Bedrooms (Always show if > 0) */}
            {property.bedrooms !== undefined && property.bedrooms !== null && property.bedrooms > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <BedDouble className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Habitaciones' : 'Bedrooms'}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {language === 'es' ? formatCount(property.bedrooms, 'habitación', 'habitaciones', 'feminine') : `${property.bedrooms} bedroom${property.bedrooms !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {/* Bathrooms / Half Bathrooms (Always show if full > 0 or half > 0) */}
            {((property.bathrooms !== undefined && property.bathrooms !== null && property.bathrooms > 0) || 
              (property.halfBathrooms !== undefined && property.halfBathrooms !== null && property.halfBathrooms > 0)) && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Bath className="w-4 h-4 text-brand-gray-500" />
                  <span>{t('details.bathrooms')}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {formatBathrooms(property.bathrooms || 0, property.halfBathrooms || 0, language === 'es' ? 'es' : 'en')}
                </span>
              </div>
            )}

            {/* Estacionamientos (Always show if > 0) */}
            {property.parkingSpaces !== undefined && property.parkingSpaces !== null && property.parkingSpaces > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Car className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Estacionamiento' : 'Parking'}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {language === 'es' ? formatCount(property.parkingSpaces, 'cajón', 'cajones', 'masculine') : `${property.parkingSpaces} space${property.parkingSpaces !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {/* levelsCount (Show for SALE if > 0) */}
            {selectedMode === 'SALE' && property.levelsCount !== undefined && property.levelsCount !== null && property.levelsCount > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Building className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Niveles' : 'Levels'}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {language === 'es' ? formatCount(property.levelsCount, 'nivel', 'niveles', 'masculine') : `${property.levelsCount} level${property.levelsCount !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {/* Construction Area (Show for SALE if > 0) */}
            {selectedMode === 'SALE' && property.surfaceBuilt !== undefined && property.surfaceBuilt !== null && property.surfaceBuilt > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Building className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Construcción' : 'Built Area'}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {property.surfaceBuilt} m²
                </span>
              </div>
            )}

            {/* Land Area (Show for SALE if > 0) */}
            {selectedMode === 'SALE' && property.surfaceTotal !== undefined && property.surfaceTotal !== null && property.surfaceTotal > 0 && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <Home className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Terreno' : 'Lot Size'}</span>
                </div>
                <span className="text-xs text-brand-gray-500">
                  {property.surfaceTotal} m²
                </span>
              </div>
            )}

            {/* Swap Specifics (Show for SWAP if present) */}
            {selectedMode === 'SWAP' && property.valueRating && (
              <div className="flex flex-col gap-1 items-start min-w-[100px]">
                <div className="flex items-center gap-1.5 text-brand-black font-semibold text-sm">
                  <RefreshCw className="w-4 h-4 text-brand-gray-500" />
                  <span>{language === 'es' ? 'Categoría' : 'Swap Tier'}</span>
                </div>
                <span className="text-xs text-brand-gray-500 text-brand-accent font-bold">
                  {property.valueRating} Swap
                </span>
              </div>
            )}
          </div>

          {/* 1. Descripción */}
          <div className="border-b border-brand-gray-200/80 pb-6">
            <h3 className="text-base font-bold text-brand-black mb-3">{t('details.aboutSpace')}</h3>
            <p className="text-sm text-brand-gray-500 leading-relaxed whitespace-pre-line font-medium">
              {t(`properties.${property.id}.description`).startsWith('properties.') ? property.description : t(`properties.${property.id}.description`)}
            </p>
          </div>

          {/* 3. Avalúo e Indicadores de Plusvalía */}
          {(property.appraisalAmount || property.appreciationLevel) && (
            <div className="border-b border-brand-gray-200/80 pb-6 flex flex-col gap-4">
              <h3 className="text-base font-bold text-brand-black flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-accent" />
                <span>{language === 'es' ? 'Valuación y Plusvalía' : 'Valuation & Appreciation'}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {property.appraisalAmount && (
                  <div className="p-4 rounded-2xl border border-brand-gray-200 bg-white flex flex-col gap-1 shadow-xs">
                    <span className="text-[10px] font-black uppercase text-brand-gray-400 tracking-wider">
                      {language === 'es' ? 'Certificación de Avalúo' : 'Appraisal Certificate'}
                    </span>
                    <span className="text-xl font-black text-brand-black">
                      ${property.appraisalAmount.toLocaleString()} MXN
                    </span>
                    <span className="text-[10px] text-brand-gray-500 font-semibold mt-1">
                      Valuador: {property.appraisalExpert || 'N/A'}
                    </span>
                    <span className="text-[10px] text-brand-gray-400 font-semibold">
                      | Fecha: {property.appraisalDate || 'N/A'} • Vigencia: {property.appraisalValidity || 'N/A'}
                    </span>
                  </div>
                )}

                {property.appreciationLevel && (() => {
                  const details = PropertyEligibilityEngine.getInvestmentDetails(property);
                  return (
                    <div className={`p-4 rounded-2xl border ${details.color} flex flex-col gap-1 shadow-xs`}>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                        {language === 'es' ? 'Plusvalía Estimada (Zona)' : 'Estimated Appreciation'}
                      </span>
                      <span className="text-base font-extrabold flex items-center gap-1.5 mt-0.5">
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        <span>{details.label}</span>
                      </span>
                      <span className="text-[10px] font-semibold mt-1 opacity-90">
                        {language === 'es' ? `Crecimiento promedio: ${details.rate}` : `Average growth: ${details.rate}`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}



          {/* 5. Amenidades */}
          {allAmenities.length > 0 && (
            <div className="border-b border-brand-gray-200/80 pb-6">
              <h3 className="text-base font-bold text-brand-black mb-4">{t('details.whatOffers')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allAmenities.map((amenity) => {
                  const Icon = AMENITY_ICONS[amenity] || Compass;
                  const translatedAmenity = t(`amenities.${amenity}`);
                  const displayAmenity = translatedAmenity.startsWith('amenities.') ? amenity : translatedAmenity;
                  return (
                    <div key={amenity} className="flex items-center gap-3 text-sm text-brand-gray-500 font-semibold">
                      <Icon className="w-4 h-4 text-brand-black shrink-0" />
                      <span>{displayAmenity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Ficha Técnica */}
          {(() => {
            const visibleSpecs = SPEC_FIELDS.map(cfg => {
              const value = property[cfg.key];
              if (value === undefined || value === null || value === '' || value === false) return null;
              const label = language === 'es' ? cfg.labelEs : cfg.labelEn;
              const displayVal = cfg.format ? cfg.format(value, language === 'es' ? 'es' : 'en') : String(value);
              return { key: cfg.key, label, value: displayVal };
            }).filter(Boolean) as { key: string; label: string; value: string }[];

            if (visibleSpecs.length === 0) return null;

            return (
              <div className="border-b border-brand-gray-200/80 pb-6">
                <h3 className="text-base font-bold text-brand-black mb-3">
                  {language === 'es' ? 'Ficha Técnica de Construcción' : 'Construction Specifications'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm text-brand-gray-500 font-semibold">
                  {visibleSpecs.map(spec => (
                    <div key={spec.key} className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span className="text-brand-gray-400">{spec.label}</span>
                      <span className="text-brand-black">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Servicios y Suministros */}
          {(() => {
            const visibleServices = SERVICES_FIELDS.map(cfg => {
              const value = property[cfg.key];
              if (value === undefined || value === null || value === '' || value === false) return null;
              const label = language === 'es' ? cfg.labelEs : cfg.labelEn;
              const displayVal = cfg.format ? cfg.format(value, language === 'es' ? 'es' : 'en') : String(value);
              return { key: cfg.key, label, value: displayVal };
            }).filter(Boolean) as { key: string; label: string; value: string }[];

            if (visibleServices.length === 0) return null;

            return (
              <div className="border-b border-brand-gray-200/80 pb-6">
                <h3 className="text-base font-bold text-brand-black mb-3">
                  {language === 'es' ? 'Servicios y Suministros' : 'Services & Utilities'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm text-brand-gray-500 font-semibold">
                  {visibleServices.map(srv => (
                    <div key={srv.key} className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span className="text-brand-gray-400">{srv.label}</span>
                      <span className="text-brand-black">{srv.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Seguridad y Vigilancia */}
          {(() => {
            const visibleSecurity = SECURITY_FIELDS.map(cfg => {
              const value = property[cfg.key];
              if (value === undefined || value === null || value === '' || value === false) return null;
              const label = language === 'es' ? cfg.labelEs : cfg.labelEn;
              const displayVal = cfg.format ? cfg.format(value, language === 'es' ? 'es' : 'en') : String(value);
              return { key: cfg.key, label, value: displayVal };
            }).filter(Boolean) as { key: string; label: string; value: string }[];

            if (visibleSecurity.length === 0) return null;

            return (
              <div className="border-b border-brand-gray-200/80 pb-6">
                <h3 className="text-base font-bold text-brand-black mb-3">
                  {language === 'es' ? 'Seguridad y Vigilancia' : 'Security & Safety'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm text-brand-gray-500 font-semibold">
                  {visibleSecurity.map(sec => (
                    <div key={sec.key} className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span className="text-brand-gray-400">{sec.label}</span>
                      <span className="text-brand-black">{sec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 7. Multimedia Avanzada (Pestañas) - Consolidated Property Media rendering */}
          {(() => {
            const mediaList = property.media || [];
            const videos = mediaList.filter(m => ['VIDEO', 'YOUTUBE', 'VIMEO', 'DRONE'].includes(m.mediaType));
            const virtualTours = mediaList.filter(m => ['MATTERPORT', 'VIRTUAL_TOUR'].includes(m.mediaType));
            const floorplans = mediaList.filter(m => m.mediaType === 'FLOORPLAN');
            const documents = mediaList.filter(m => m.mediaType === 'DOCUMENT');
            
            const hasMultimedia = videos.length > 0 || virtualTours.length > 0 || floorplans.length > 0 || documents.length > 0;
            if (!hasMultimedia) return null;

            // Determine active tab if not set or invalid
            const availableTabs = [
              videos.length > 0 && 'video',
              virtualTours.length > 0 && 'virtual',
              floorplans.length > 0 && 'floorplan',
              documents.length > 0 && 'document'
            ].filter(Boolean) as string[];

            const currentTab = availableTabs.includes(activeMediaTab) ? activeMediaTab : (availableTabs[0] || '');

            const getYoutubeEmbedUrl = (url: string) => {
              let videoId = '';
              if (url.includes('youtube.com')) {
                const parts = url.split('v=');
                if (parts.length > 1) videoId = parts[1].split('&')[0];
              } else if (url.includes('youtu.be')) {
                const parts = url.split('/');
                videoId = parts[parts.length - 1].split('?')[0];
              }
              return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0` : url;
            };

            const getVimeoEmbedUrl = (url: string) => {
              const parts = url.split('/');
              const videoId = parts[parts.length - 1].split('?')[0];
              return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
            };

            return (
              <div className="border-b border-brand-gray-200/80 pb-6 flex flex-col gap-4">
                <h3 className="text-base font-bold text-brand-black flex items-center gap-2">
                  <Compass className="w-5 h-5 text-brand-accent" />
                  <span>{language === 'es' ? 'Multimedia y Recorridos' : 'Multimedia & Tours'}</span>
                </h3>

                {/* Tab Header */}
                <div className="flex border-b border-brand-gray-100 bg-brand-gray-100 p-1 rounded-2xl overflow-x-auto gap-1">
                  {videos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMediaTab('video');
                        setActiveVideoIndex(0);
                      }}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap px-4 ${currentTab === 'video' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
                    >
                      📹 {language === 'es' ? 'Videos' : 'Videos'} ({videos.length})
                    </button>
                  )}
                  {virtualTours.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveMediaTab('virtual')}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap px-4 ${currentTab === 'virtual' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
                    >
                      🕶️ {language === 'es' ? 'Tour 3D / VR' : '3D / VR Tour'} ({virtualTours.length})
                    </button>
                  )}
                  {floorplans.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveMediaTab('floorplan')}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap px-4 ${currentTab === 'floorplan' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
                    >
                      📐 {language === 'es' ? 'Planos' : 'Floor Plans'} ({floorplans.length})
                    </button>
                  )}
                  {documents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveMediaTab('document')}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap px-4 ${currentTab === 'document' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
                    >
                      📄 {language === 'es' ? 'Documentación' : 'Documents'} ({documents.length})
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                <div className="relative rounded-3xl overflow-hidden bg-brand-gray-100 aspect-video flex flex-col items-center justify-center border border-brand-gray-200/50 shadow-inner w-full">
                  {currentTab === 'video' && videos.length > 0 && (() => {
                    const activeVideo = videos[activeVideoIndex] || videos[0];
                    return (
                      <div className="w-full h-full flex flex-col relative bg-brand-black">
                        {/* Video Player Box */}
                        <div className="flex-1 w-full h-full relative min-h-0">
                          {activeVideo.mediaType === 'VIDEO' ? (
                            <video 
                              src={activeVideo.url} 
                              className="w-full h-full object-contain" 
                              controls 
                              playsInline
                            />
                          ) : activeVideo.mediaType === 'VIMEO' ? (
                            <iframe 
                              src={getVimeoEmbedUrl(activeVideo.url)}
                              className="w-full h-full border-0"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            />
                          ) : (
                            <iframe 
                              src={getYoutubeEmbedUrl(activeVideo.url)}
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            />
                          )}
                        </div>

                        {/* Extra Videos Thumbnails Carousel */}
                        {videos.length > 1 && (
                          <div className="bg-brand-black/90 p-3 flex gap-2 overflow-x-auto shrink-0 border-t border-brand-gray-900 w-full">
                            {videos.map((vid, idx) => (
                              <button
                                key={vid.id || idx}
                                onClick={() => setActiveVideoIndex(idx)}
                                className={`relative w-24 aspect-video rounded-lg overflow-hidden border-2 shrink-0 transition-all ${idx === activeVideoIndex ? 'border-brand-accent scale-95 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              >
                                <img 
                                  src={vid.thumbnailUrl || 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=150&q=80'} 
                                  className="w-full h-full object-cover" 
                                  alt={vid.title || "Video thumbnail"}
                                />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <span className="text-[10px] text-white font-bold bg-brand-black/70 px-1.5 py-0.5 rounded">
                                    {vid.mediaType}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {currentTab === 'virtual' && virtualTours.length > 0 && (() => {
                    const activeTour = virtualTours[0];
                    return (
                      <div className="w-full h-full relative">
                        <iframe 
                          src={activeTour.url}
                          className="w-full h-full border-0"
                          allow="xr-spatial-tracking; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    );
                  })()}

                  {currentTab === 'floorplan' && floorplans.length > 0 && (() => {
                    const activePlan = floorplans[0];
                    return (
                      <div className="w-full h-full relative group bg-white flex items-center justify-center p-4">
                        <img 
                          src={activePlan.url} 
                          className="max-w-full max-h-full object-contain rounded-2xl" 
                          alt={activePlan.title || "Plano"}
                        />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <a 
                            href={activePlan.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-brand-black/80 hover:bg-brand-black text-white px-4 py-2.5 rounded-full text-xs font-black shadow-lg backdrop-blur-sm transition-all flex items-center gap-1.5"
                          >
                            <Maximize className="w-4 h-4" />
                            <span>{language === 'es' ? 'Ver original' : 'View original'}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  {currentTab === 'document' && documents.length > 0 && (
                    <div className="w-full h-full overflow-y-auto p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                      {documents.map((doc, idx) => (
                        <div 
                          key={doc.id || idx}
                          className="bg-brand-gray-50 border border-brand-gray-200/60 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group h-fit"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold shrink-0">
                              📄
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-brand-black truncate group-hover:text-brand-accent transition-colors">
                                {doc.title || `Documento #${idx + 1}`}
                              </h4>
                              <p className="text-[10px] text-brand-gray-400 font-semibold">
                                {doc.fileSize ? `${Math.round(doc.fileSize / 1024 / 1024 * 100) / 100} MB` : 'PDF'}
                              </p>
                            </div>
                          </div>
                          <a 
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white hover:bg-brand-accent hover:text-white border border-brand-gray-200 text-brand-black p-2.5 rounded-full transition-all shrink-0 shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 8. Ubicación y Mapa */}
          {property.latitude !== null && property.longitude !== null && (
            <div className="border-b border-brand-gray-200/80 pb-6 flex flex-col gap-4">
              <h3 className="text-base font-bold text-brand-black">{language === 'es' ? 'Ubicación y Entorno' : 'Location & Neighborhood'}</h3>
              {property.formattedAddress && (
                <p className="text-xs text-brand-gray-500 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-gray-400 shrink-0" />
                  <span>{property.formattedAddress}</span>
                </p>
              )}
              
              <div 
                id="property-details-map" 
                className="w-full h-64 rounded-3xl border border-brand-gray-200/60 overflow-hidden shadow-sm relative z-0 bg-[#e4e4e7]"
              />

              <div className="flex flex-wrap gap-2 mt-1">
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 rounded-xl text-xs font-bold text-brand-black flex items-center gap-1.5 transition-colors shadow-xs active:scale-95 duration-200"
                >
                  <Compass className="w-3.5 h-3.5 text-brand-black shrink-0" />
                  <span>{language === 'es' ? 'Cómo llegar' : 'Get Directions'}</span>
                </a>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 rounded-xl text-xs font-bold text-brand-black flex items-center gap-1.5 transition-colors shadow-xs active:scale-95 duration-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-brand-black shrink-0" />
                  <span>{language === 'es' ? 'Ver en Google Maps' : 'View on Google Maps'}</span>
                </a>
                <a 
                  href={`https://waze.com/ul?ll=${property.latitude},${property.longitude}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-brand-gray-50 hover:bg-brand-gray-100 border border-brand-gray-200 rounded-xl text-xs font-bold text-brand-black flex items-center gap-1.5 transition-colors shadow-xs active:scale-95 duration-200"
                >
                  <Compass className="w-3.5 h-3.5 text-brand-black shrink-0" />
                  <span>{language === 'es' ? 'Abrir en Waze' : 'Open in Waze'}</span>
                </a>
              </div>
            </div>
          )}

          {/* Responsable Comercial Card (Premium design) */}
          {(() => {
            const broker = property.brokerProfile || {
              photo: property.hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
              name: property.hostName || 'Agente Responsable',
              company: 'AuraSwap Elite Estates',
              position: 'Asesor Inmobiliario Senior',
              responseTime: 'Menos de 15 minutos',
              phone: '+52 667 392 4829',
              whatsapp: '526673924829',
              email: 'contacto@auraswap.com'
            };

            const getResponsibleLabel = (prop: Property, lang: string) => {
              const pubType = prop.metadata?.publisherType;
              if (pubType === 'developer' || prop.companyId) {
                return lang === 'es' ? 'Inmobiliaria Responsable' : 'Responsible Developer';
              }
              if (pubType === 'agent') {
                return lang === 'es' ? 'Asesor Comercial' : 'Commercial Advisor';
              }
              if (prop.primaryOperation === 'SALE') {
                return lang === 'es' ? 'Propietario / Asesor' : 'Owner / Advisor';
              } else if (prop.primaryOperation === 'RENT') {
                return lang === 'es' ? 'Responsable de Propiedad' : 'Property Manager';
              } else {
                return lang === 'es' ? 'Propietario' : 'Property Owner';
              }
            };

            const label = getResponsibleLabel(property, language);
            const whatsappMessage = language === 'es'
              ? `Hola ${broker.name}, me interesa la propiedad "${property.title}" (${property.id}). ¿Podrías darme más información?`
              : `Hello ${broker.name}, I am interested in "${property.title}" (${property.id}). Could you share more information?`;
            const mailSubject = language === 'es'
              ? `Interés en propiedad AuraSwap: ${property.title}`
              : `AuraSwap property inquiry: ${property.title}`;

            return (
              <section className="relative overflow-hidden border-y border-brand-gray-200/80 bg-gradient-to-br from-brand-gray-50/80 via-white to-brand-accent/[0.035] px-5 py-7 sm:px-7 sm:py-8">
                <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-accent/[0.055] blur-3xl pointer-events-none" />

                <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
                  <div className="contents">
                    <div className="flex items-center justify-between gap-4 border-b border-brand-gray-200/70 pb-4 lg:col-span-2">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-accent">
                          {language === 'es' ? 'Contacto de esta propiedad' : 'Property contact'}
                        </span>
                        <h3 className="mt-1 text-base font-extrabold text-brand-black">
                          {language === 'es' ? 'Habla directamente con el responsable' : 'Speak directly with the representative'}
                        </h3>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {language === 'es' ? 'Disponible' : 'Available'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="relative shrink-0">
                        <div className="rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.10)] ring-1 ring-brand-gray-200">
                          <img
                            src={broker.photo}
                            alt={broker.name}
                            className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
                          />
                        </div>
                        {property.hostVerified && (
                          <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-brand-accent text-white shadow-sm" title={language === 'es' ? 'Identidad verificada' : 'Verified identity'}>
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-brand-accent/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-brand-accent">
                          {label}
                        </span>
                        <h4 className="mt-2 truncate text-2xl font-black leading-none text-brand-black">{broker.name}</h4>
                        <p className="mt-2 text-xs font-bold leading-relaxed text-brand-gray-650">
                          {broker.position}
                          <span className="mx-1.5 text-brand-gray-300">·</span>
                          <span className="text-brand-gray-500">{broker.company}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gray-200 bg-white/90 px-2.5 py-1.5 text-[9px] font-extrabold text-brand-gray-600 shadow-xs">
                            <Clock3 className="h-3 w-3 text-brand-accent" />
                            {language === 'es' ? 'Responde en' : 'Replies in'} {broker.responseTime.toLowerCase()}
                          </span>
                          {property.hostVerified && (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold text-brand-gray-500">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              {language === 'es' ? 'Perfil verificado' : 'Verified profile'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-brand-gray-200/80 bg-white/90 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                  {broker.whatsapp && (
                    <a
                      href={`https://wa.me/${broker.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${language === 'es' ? 'Escribir por WhatsApp a' : 'Message on WhatsApp'} ${broker.name}`}
                      className="group flex h-12 w-full items-center justify-between rounded-2xl bg-brand-black px-4 text-xs font-extrabold text-white transition-all duration-200 hover:bg-brand-gray-800 active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </span>
                        {language === 'es' ? 'Escribir por WhatsApp' : 'Message on WhatsApp'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  )}

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {broker.phone && (
                        <a
                          href={`tel:${broker.phone}`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-gray-200 bg-brand-gray-50/70 text-[9px] font-extrabold text-brand-gray-700 transition-colors hover:border-brand-gray-300 hover:bg-brand-gray-100"
                        >
                          <PhoneCall className="h-4 w-4 text-brand-black" />
                          {language === 'es' ? 'Llamar' : 'Call'}
                        </a>
                      )}
                      {broker.email && (
                        <a
                          href={`mailto:${broker.email}?subject=${encodeURIComponent(mailSubject)}`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-gray-200 bg-brand-gray-50/70 text-[9px] font-extrabold text-brand-gray-700 transition-colors hover:border-brand-gray-300 hover:bg-brand-gray-100"
                        >
                          <Mail className="h-4 w-4 text-brand-black" />
                          {language === 'es' ? 'Correo' : 'Email'}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${property.hostId || 'current-user'}`)}
                        className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-gray-200 bg-brand-gray-50/70 text-[9px] font-extrabold text-brand-gray-700 transition-colors hover:border-brand-gray-300 hover:bg-brand-gray-100 cursor-pointer"
                      >
                        <UserRound className="h-4 w-4 text-brand-black" />
                        {language === 'es' ? 'Ver perfil' : 'View profile'}
                      </button>
                    </div>

                    <p className="mt-3 px-1 text-center text-[9px] font-semibold leading-relaxed text-brand-gray-400">
                      {language === 'es'
                        ? 'Contacto directo y protegido dentro del expediente de AuraSwap.'
                        : 'Direct, protected contact within the AuraSwap listing.'}
                    </p>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* 2. Expediente Jurídico */}
          <LegalDossierSection property={property} language={language} />

          {/* Métodos de Pago / Financiamiento Card (Dynamic based on selectedMode) */}
          {selectedMode === 'SALE' && (
            <FinancingCompatibility property={property} language={language} />
          )}

          {((selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') || selectedMode === 'SWAP') && (
            <div className="border-b border-brand-gray-200/80 pb-6 flex flex-col gap-4 animate-in fade-in duration-300">
              {/* RENT mode: Conditions of lease */}
              {(selectedMode === 'MONTHLY_RENT' || selectedMode === 'SHORT_RENT') && activeRentOffering && (
                <>
                  <h3 className="text-base font-bold text-brand-black flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-brand-accent" />
                    <span>{language === 'es' ? 'Condiciones de Contratación' : 'Lease Terms & Conditions'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-550 font-bold">{language === 'es' ? 'Depósito requerido:' : 'Security deposit:'}</span>
                      <span className="text-brand-accent font-extrabold">{property.metadata?.depositMonths ? `${property.metadata.depositMonths} ${language === 'es' ? 'mes(es)' : 'month(s)'}` : (language === 'es' ? '1 mes' : '1 month')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Mes adelantado:' : 'Advance month:'}</span>
                      <span className="text-brand-black font-extrabold">{language === 'es' ? 'Requerido' : 'Required'}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Aval / Fiador:' : 'Guarantor:'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        property.metadata?.guarantorRequired !== false 
                          ? 'bg-amber-50 text-amber-700 border border-amber-250' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-250'
                      }`}>
                        {property.metadata?.guarantorRequired !== false ? (language === 'es' ? 'Requerido' : 'Required') : (language === 'es' ? 'No indispensable' : 'Not required')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Póliza jurídica:' : 'Legal lease policy:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.legalPolicyRequired !== false ? (language === 'es' ? 'Requerida (50/50)' : 'Required (50/50)') : (language === 'es' ? 'No requerida' : 'No policy')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Obligado solidario:' : 'Joint co-signer:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.jointCosignerRequired ? (language === 'es' ? 'Requerido' : 'Required') : (language === 'es' ? 'Opcional' : 'Optional')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Contrato mínimo:' : 'Minimum lease:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.minContractMonths || 12} {language === 'es' ? 'meses' : 'months'}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Mascotas:' : 'Pets allowed:'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        property.metadata?.petsAllowed 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                          : 'bg-rose-50 text-rose-700 border-rose-250'
                      }`}>
                        {property.metadata?.petsAllowed ? (language === 'es' ? 'Permitidas' : 'Allowed') : (language === 'es' ? 'No permitidas' : 'No pets')}
                      </span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Servicios incluidos:' : 'Utilities included:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.utilitiesIncluded ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Mantenimiento:' : 'Maintenance fee:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.maintenanceFeeIncluded ? (language === 'es' ? 'Incluido' : 'Included') : (language === 'es' ? 'Por separado' : 'Separate')}</span>
                    </div>
                  </div>
                </>
              )}

              {/* SWAP mode: Forms of exchange accepted */}
              {selectedMode === 'SWAP' && (
                <>
                  <h3 className="text-base font-bold text-brand-black flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-brand-accent" />
                    <span>{language === 'es' ? 'Formas de Intercambio Aceptadas' : 'Accepted Swap Framework'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Intercambio directo:' : 'Direct swap:'}</span>
                      <span className="text-emerald-700 font-extrabold">{language === 'es' ? 'Aceptado' : 'Accepted'}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Intercambio + diferencia:' : 'Swap + cash:'}</span>
                      <span className="text-emerald-700 font-extrabold">{language === 'es' ? 'Aceptado' : 'Accepted'}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Solo propiedades:' : 'Properties only:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.swapPropertiesOnly ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Vehículos + diferencia:' : 'Vehicles + cash:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.swapVehiclesAllowed ? (language === 'es' ? 'Aceptados' : 'Allowed') : (language === 'es' ? 'No aceptados' : 'No vehicles')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Terrenos:' : 'Land lots:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.swapLandAllowed ? (language === 'es' ? 'Aceptados' : 'Allowed') : (language === 'es' ? 'No aceptados' : 'No land')}</span>
                    </div>
                    <div className="p-3 bg-brand-gray-50 border border-brand-gray-300 rounded-xl text-xs font-black text-brand-black flex items-center justify-between">
                      <span className="text-brand-gray-555 font-bold">{language === 'es' ? 'Departamentos:' : 'Apartments:'}</span>
                      <span className="text-brand-black font-extrabold">{language === 'es' ? 'Aceptados' : 'Allowed'}</span>
                    </div>
                  </div>

                  <div className="border-t border-brand-gray-150 pt-3 mt-1" />
                  <h4 className="text-xs font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-brand-gray-400" />
                    <span>{language === 'es' ? 'Busca recibir a cambio:' : 'Seeks to receive in return:'}</span>
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {['Casa', 'Departamento', 'Terreno', 'Local', 'Vehículo', 'Efectivo'].map((item) => {
                      const isLookingFor = (property.metadata?.swapPreferencesTags || ['Casa', 'Departamento', 'Efectivo']).includes(item);
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
            </div>
          )}


          {/* 10. Análisis Inmobiliario con IA (Eterna) */}
          <EternaMarketAnalysis property={property} language={language} />

          {/* Guest Reviews Section */}
          <div>
            <h3 className="text-base font-bold text-brand-black mb-4">
              {t('details.guestReviews', { count: dynamicReviewsCount })}
            </h3>
            {combinedReviews && combinedReviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {combinedReviews.map((rev) => (
                  <div key={rev.id} className="p-5 bg-white border border-brand-gray-200/60 rounded-2xl shadow-premium hover:shadow-floating transition-all duration-300 flex flex-col justify-between gap-3 relative overflow-hidden">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={rev.authorAvatar}
                          alt={rev.authorName}
                          className="w-10 h-10 rounded-full object-cover border border-white shadow-sm ring-2 ring-brand-gray-100"
                          loading="lazy"
                          decoding="async"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-brand-black flex items-center gap-1.5">
                            {rev.authorName}
                          </h4>
                          <p className="text-[10px] text-brand-gray-400 font-semibold">{rev.date}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-brand-gray-600 leading-relaxed font-semibold italic">
                        &ldquo;{rev.isVerified ? rev.comment : (t(`properties.${property.id}.reviews.${rev.id}`).startsWith('properties.') ? rev.comment : t(`properties.${property.id}.reviews.${rev.id}`))}&rdquo;
                      </p>
                    </div>

                    {rev.isVerified && (
                      <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/40 w-fit self-end mt-2">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{language === 'es' ? 'Verificado' : 'Verified'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-brand-gray-50/50 border border-brand-gray-100 rounded-2xl text-xs text-brand-gray-400 font-semibold">
                {t('details.noReviews')}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Hybrid Booking / Swap / Purchase widget */}
        <div className="w-full lg:w-96 lg:sticky lg:top-28 shrink-0">
          <div className="w-full bg-white rounded-3xl border border-brand-gray-200/60 p-6 shadow-floating overflow-hidden">
            
            {/* Segmented Mode Control if 2 or more offerings are active */}
            {activeOfferingModes.length >= 2 && (
              <div className="flex bg-brand-gray-100 p-1 rounded-2xl mb-5 border border-brand-gray-200/40 relative">
                {activeOfferingModes.map((mode) => {
                  const isActive = selectedMode === mode;
                  let label = '';
                  if (mode === 'SWAP') label = 'Swap 🔄';
                  else if (mode === 'SHORT_RENT') label = language === 'es' ? 'Temp 🏡' : 'Short 🏡';
                  else if (mode === 'MONTHLY_RENT') label = language === 'es' ? 'Mes 📅' : 'Monthly 📅';
                  else if (mode === 'SALE') label = language === 'es' ? 'Venta 💰' : 'Sale 💰';

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
                {/* Highlight recommended Swap tag if multiple modes are available */}
                {activeOfferingModes.length >= 2 && (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-brand-accent/10 border border-emerald-500/20 rounded-2xl p-3 flex items-start gap-2 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">AuraSwap Recomendado</h4>
                      <p className="text-[9px] text-brand-gray-600 leading-normal mt-0.5 font-semibold">
                        Ahorra costes y viaja sin pagar renta. Intercambia directamente tu hogar con este anfitrión.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">{t('details.directSwap')}</span>
                    <p className="text-[10px] text-brand-gray-500 font-bold uppercase tracking-wider mt-0.5">{t('details.rentFreeExchange')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-brand-accent bg-brand-accent/5 px-2.5 py-1 rounded-full">
                      {t('details.matchScore', { score: property.auraScore }).split(' ')[0]} Match
                    </span>
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
                      {language === 'es' 
                        ? `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][calendarMonth]} ${calendarYear}`
                        : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][calendarMonth]} ${calendarYear}`}
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
                          property.metadata?.swapAcceptsHouse !== false ? (language === 'es' ? 'Casa' : 'House') : null,
                          property.metadata?.swapAcceptsDept !== false ? (language === 'es' ? 'Depto' : 'Condo') : null,
                          property.metadata?.swapAcceptsLand ? (language === 'es' ? 'Terreno' : 'Land') : null,
                          property.metadata?.swapAcceptsVehicle ? (language === 'es' ? 'Vehículo' : 'Vehicle') : null
                        ].filter(Boolean).join(', ') || (language === 'es' ? 'Cualquiera' : 'Any')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                      <span>{language === 'es' ? 'Efectivo como diferencia:' : 'Cash difference:'}</span>
                      <span className="text-brand-black font-extrabold">{property.metadata?.swapAcceptsCash !== false ? (language === 'es' ? 'Sí, aceptado' : 'Yes') : (language === 'es' ? 'No aceptado' : 'No')}</span>
                    </div>
                    {property.metadata?.swapMaxCashDiff && (
                      <div className="flex justify-between border-b border-brand-gray-100 pb-1.5">
                        <span>{language === 'es' ? 'Diferencia máxima:' : 'Max difference:'}</span>
                        <span className="text-brand-black font-extrabold">${Number(property.metadata?.swapMaxCashDiff).toLocaleString()} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{language === 'es' ? 'Ciudades aceptadas:' : 'Preferred cities:'}</span>
                      <span className="text-brand-black font-extrabold">{property.desiredExchange || (language === 'es' ? 'Culiacán, Mazatlán, CDMX' : 'Any city')}</span>
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
                ) : (
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
                )}

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
                <div className="flex items-baseline justify-between border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">${activeRentOffering.priceAmount || 150}</span>
                    <span className="text-xs text-brand-gray-500 font-semibold"> / {language === 'es' ? 'noche' : 'night'}</span>
                  </div>
                  <div className="text-right flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-brand-black">{dynamicRating.toFixed(2)}</span>
                    <span className="text-[10px] text-brand-gray-400 font-semibold">({dynamicReviewsCount})</span>
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
                      {language === 'es' 
                        ? `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][calendarMonth]} ${calendarYear}`
                        : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][calendarMonth]} ${calendarYear}`}
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
                  <div className="flex justify-between">
                    <span>{language === 'es' ? 'Estancia mínima:' : 'Minimum stay:'}</span>
                    <span className="text-brand-black font-bold">{activeRentOffering.minNights || 2} {language === 'es' ? 'noches' : 'nights'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === 'es' ? 'Depósito reembolsable:' : 'Refundable deposit:'}</span>
                    <span className="text-brand-black font-bold">${activeRentOffering.securityDepositAmount || 300} USD</span>
                  </div>
                </div>

                {/* Calculation Summary */}
                {startDate && endDate && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-brand-gray-100 text-xs">
                    <div className="flex justify-between text-brand-gray-500">
                      <span>${activeRentOffering.priceAmount || 150} x {numNights} {language === 'es' ? 'noches' : 'nights'}</span>
                      <span className="font-semibold text-brand-black">${(activeRentOffering.priceAmount || 150) * numNights} USD</span>
                    </div>
                    {activeRentOffering.metadata?.weeklyPrice && numNights >= 7 && (
                      <div className="flex justify-between text-emerald-600 font-semibold text-[10px]">
                        <span>{language === 'es' ? '¡Descuento semanal aplicado!' : 'Weekly discount applied!'}</span>
                        <span>-${Math.floor(((activeRentOffering.priceAmount || 150) * numNights) - (Number(activeRentOffering.metadata.weeklyPrice) * (numNights / 7)))} USD</span>
                      </div>
                    )}
                    <div className="flex justify-between text-brand-gray-500">
                      <span>{language === 'es' ? 'Depósito de garantía' : 'Security deposit'}</span>
                      <span className="font-semibold text-brand-black">${activeRentOffering.securityDepositAmount || 300} USD</span>
                    </div>
                    <div className="flex justify-between text-brand-gray-500">
                      <span>{language === 'es' ? 'Tarifa de limpieza / Servicio' : 'Cleaning / Service Fee'}</span>
                      <span className="font-semibold text-brand-black">$50 USD</span>
                    </div>
                    <div className="border-t border-brand-gray-100 my-1" />
                    <div className="flex items-center justify-between font-bold text-brand-black text-sm">
                      <span>{language === 'es' ? 'Total estimado' : 'Estimated Total'}</span>
                      <span>${((activeRentOffering.priceAmount || 150) * numNights) + (activeRentOffering.securityDepositAmount || 300) + 50} USD</span>
                    </div>
                  </div>
                )}

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : (
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
                )}
              </div>
            )}

            {/* EXPERIENCE 3: MONTHLY_RENT (Airbnb/Wander premium style) */}
            {selectedMode === 'MONTHLY_RENT' && activeRentOffering && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex items-baseline justify-between border-b border-brand-gray-100 pb-4 mb-1">
                  <div>
                    <span className="text-2xl font-black text-brand-black">${activeRentOffering.priceAmount || 2500}</span>
                    <span className="text-xs text-brand-gray-500 font-semibold"> / {language === 'es' ? 'mes' : 'month'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                      {language === 'es' ? 'Renta Larga' : 'Long-Term'}
                    </span>
                  </div>
                </div>

                <div className="bg-brand-gray-50 rounded-2xl p-4 border border-brand-gray-200/40 text-[11px] leading-relaxed text-brand-gray-600 font-semibold flex flex-col gap-2.5">
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Depósito en garantía:' : 'Security deposit:'}</span>
                    <span className="text-brand-black font-extrabold">${(activeRentOffering.securityDepositAmount || 2000).toLocaleString()} USD</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Mes adelantado:' : 'Months in advance:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.advanceMonths || 1} {language === 'es' ? 'mes' : 'month'}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Aval / Obligado Solidario:' : 'Guarantor Required:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.requiresGuarantor ? (language === 'es' ? 'Sí, requerido' : 'Yes') : (language === 'es' ? 'No requerido' : 'No')}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Póliza Jurídica:' : 'Legal Policy:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.requiresLegalPolicy ? (language === 'es' ? 'Sí, requerida' : 'Yes') : (language === 'es' ? 'No requerida' : 'No')}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Contrato Mínimo:' : 'Min Contract Term:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.monthlyContract || 12} {language === 'es' ? 'meses' : 'months'}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Mascotas:' : 'Pets Allowed:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.acceptsPets !== false ? (language === 'es' ? 'Aceptadas' : 'Allowed') : (language === 'es' ? 'No aceptadas' : 'No')}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Amueblado:' : 'Furnished:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.isFurnished ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-gray-200 pb-2">
                    <span>{language === 'es' ? 'Mantenimiento:' : 'Maintenance:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.includesMaintenance !== false ? (language === 'es' ? 'Incluido' : 'Included') : (language === 'es' ? 'No incluido' : 'Not Included')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === 'es' ? 'Servicios (Agua/Luz):' : 'Utilities:'}</span>
                    <span className="text-brand-black font-extrabold">{property.metadata?.includesServices ? (language === 'es' ? 'Incluidos' : 'Included') : (language === 'es' ? 'No incluidos' : 'Not Included')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-brand-gray-100 text-xs">
                  <div className="flex justify-between text-brand-gray-500">
                    <span>{language === 'es' ? 'Primer mes de renta' : 'First month rent'}</span>
                    <span className="font-semibold text-brand-black">${activeRentOffering.priceAmount || 2500} USD</span>
                  </div>
                  <div className="flex justify-between text-brand-gray-500">
                    <span>{language === 'es' ? 'Depósito de garantía' : 'Security deposit'}</span>
                    <span className="font-semibold text-brand-black">${activeRentOffering.securityDepositAmount || 2000} USD</span>
                  </div>
                  <div className="border-t border-brand-gray-100 my-1" />
                  <div className="flex items-center justify-between font-bold text-brand-black text-sm">
                    <span>{language === 'es' ? 'Total debido al firmar' : 'Total due at signing'}</span>
                    <span>${(activeRentOffering.priceAmount || 2500) + (activeRentOffering.securityDepositAmount || 2000)} USD</span>
                  </div>
                </div>

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : (
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
                )}
              </div>
            )}

            {/* EXPERIENCE 4: SALE (Sotheby's / Pacaso luxury style) */}
            {selectedMode === 'SALE' && activeSaleOffering && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="border-b border-brand-gray-100 pb-4 mb-1">
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full tracking-wider inline-block">
                    {language === 'es' ? 'Propiedad en Venta' : 'Property For Sale'}
                  </span>
                  <div className="flex items-baseline gap-1 mt-2.5">
                    <span className="text-3xl font-black text-brand-black tracking-tight">
                      {activeSaleOffering.currency || 'USD'} ${(activeSaleOffering.priceAmount || 450000).toLocaleString()}
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
                          {property.priceHistory.lastModificationDate} ({language === 'es' ? 'hace 3 semanas' : '3 weeks ago'})
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-brand-gray-500 font-semibold mt-1">
                    {language === 'es' ? 'Listado inmobiliario premium de propiedad verificada.' : 'Premium verified real estate listing.'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50/20 to-brand-gray-50 border border-amber-200/40 rounded-2xl p-4 text-xs leading-relaxed text-brand-gray-600 font-semibold flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-brand-black font-extrabold text-[10px] uppercase tracking-wider text-amber-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>{language === 'es' ? 'Transacción Segura Incluida' : 'Secure Transaction Included'}</span>
                  </div>
                  <p className="text-[10px] text-brand-gray-500 leading-normal font-medium">
                    {language === 'es'
                      ? 'Nuestros asesores gestionan el contrato de compraventa y los fondos de garantía en fideicomiso (Escrow) para tu tranquilidad.'
                      : 'Our advisors manage the purchase contract and escrow safety deposit accounts for your absolute peace of mind.'}
                  </p>
                  <div className="border-t border-brand-gray-200/60 my-1" />
                  <div className="flex justify-between items-center text-[10px]">
                    <span>{language === 'es' ? 'Acepta ofertas de compra:' : 'Accepts buying offers:'}</span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black">
                      {activeSaleOffering.acceptsOffers !== false ? (language === 'es' ? 'SÍ' : 'YES') : (language === 'es' ? 'SÓLO LISTADO' : 'ONLY LISTING')}
                    </span>
                  </div>
                </div>

                {/* 1. Simulador Hipotecario Financiero */}
                <div className="bg-brand-gray-50 border border-brand-gray-200/60 rounded-3xl p-4 flex flex-col gap-3.5 shadow-xs">
                  <div className="flex items-center justify-between text-brand-black font-extrabold text-[9px] uppercase tracking-wider text-brand-accent">
                    <BarChart2 className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                    <span>{language === 'es' ? 'Simulador Hipotecario (Informativo)' : 'Mortgage Simulator'}</span>
                  </div>
                  <div className="border-t border-brand-gray-200/60" />

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
                    const price = activeSaleOffering.priceAmount || 450000;
                    const downPayment = price * (downPaymentPct / 100);
                    const loan = price - downPayment;
                    const annualRate = 0.105; // 10.5% annual rate
                    const monthlyRate = annualRate / 12;
                    const totalPayments = financingTermYears * 12;
                    const monthlyPayment = loan * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);

                    return (
                      <div className="bg-brand-accent/5 p-3 rounded-2xl border border-brand-accent/20 flex flex-col gap-1 text-center">
                        <span className="text-[9px] font-black uppercase text-brand-accent tracking-wider">
                          {language === 'es' ? 'Mensualidad Estimada' : 'Estimated Monthly Payment'}
                        </span>
                        <span className="text-xl font-black text-brand-black">
                          ${Math.round(monthlyPayment).toLocaleString()} {activeSaleOffering.currency || 'USD'}
                        </span>
                        <span className="text-[9px] text-brand-gray-500 font-semibold">
                          {language === 'es'
                            ? `Financiando el ${100 - downPaymentPct}% a tasa fija de 10.5%`
                            : `Financing ${100 - downPaymentPct}% at 10.5% fixed rate`}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Desglose de Gastos de Adquisición */}
                <div className="bg-brand-gray-50 border border-brand-gray-200/60 rounded-3xl p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center justify-between text-brand-black font-extrabold text-[9px] uppercase tracking-wider text-brand-accent">
                    <span>💵</span>
                    <span>{language === 'es' ? 'Costos de Adquisición (Escrituración)' : 'Acquisition & Notary Costs'}</span>
                  </div>
                  <div className="border-t border-brand-gray-200/60" />

                  {(() => {
                    const price = activeSaleOffering.priceAmount || 450000;
                    const isai = price * 0.03; // ISAI 3%
                    const notary = price * 0.025; // Notary 2.5%
                    const appraisal = Math.max(5000, price * 0.001); // Appraisal 0.1% or min 5000
                    const registration = price * 0.005; // Registration fee 0.5%
                    const totalAcquisition = isai + notary + appraisal + registration;

                    return (
                      <div className="flex flex-col gap-2.5 text-[11px] leading-relaxed text-brand-gray-600 font-semibold">
                        <div className="flex justify-between border-b border-brand-gray-100 pb-1">
                          <span>{language === 'es' ? 'ISAI (Impuesto de Traslado - 3%):' : 'ISAI (Transfer Tax - 3%):'}</span>
                          <span className="text-brand-black font-bold">${Math.round(isai).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-gray-100 pb-1">
                          <span>{language === 'es' ? 'Honorarios Notaría (2.5%):' : 'Notary Fees (2.5%):'}</span>
                          <span className="text-brand-black font-bold">${Math.round(notary).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-gray-100 pb-1">
                          <span>{language === 'es' ? 'Avalúo Comercial Oficial:' : 'Official Appraisal:'}</span>
                          <span className="text-brand-black font-bold">${Math.round(appraisal).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-gray-100 pb-1">
                          <span>{language === 'es' ? 'Registro Público (0.5%):' : 'Public Registry Fee (0.5%):'}</span>
                          <span className="text-brand-black font-bold">${Math.round(registration).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-gray-100 pb-1">
                          <span>{language === 'es' ? 'Honorarios de Intermediación:' : 'Agency Commission:'}</span>
                          <span className="text-emerald-600 font-bold">{language === 'es' ? 'Paga Propietario ($0)' : 'Paid by Seller ($0)'}</span>
                        </div>
                        <div className="border-t border-brand-gray-200/60 my-1" />
                        <div className="flex justify-between items-center text-brand-black font-extrabold text-xs">
                          <span>{language === 'es' ? 'Total Gastos Escrituración:' : 'Total Acquisition Costs:'}</span>
                          <span>${Math.round(totalAcquisition).toLocaleString()} {activeSaleOffering.currency || 'USD'}</span>
                        </div>
                        <span className="text-[9px] text-brand-gray-400 font-semibold leading-snug">
                          {language === 'es'
                            ? '* Gastos calculados en promedio para la República Mexicana (aprox. 5% al 6% del valor total de venta).'
                            : '* Estimated values based on average rates in Mexico (approx. 5% to 6% of total purchase value).'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {isSelfProperty ? (
                  <div className="mt-3 p-4 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl text-xs font-semibold text-brand-black">
                    {language === 'es' ? 'Esta es tu propiedad listada.' : 'This is your own listed property.'}
                  </div>
                ) : (
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
                )}
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
                              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-brand-gray-100">
                                <img
                                  src={((url) => {
                                    if (!url) return '';
                                    if (myProp.metadata?.imagesMetadata?.[url]?.thumbnailUrl) {
                                      return myProp.metadata.imagesMetadata[url].thumbnailUrl;
                                    }
                                    if (url.includes('property-images/') && !url.includes('-thumb.webp') && url.endsWith('.webp')) {
                                      return url.replace(/\.webp$/, '-thumb.webp');
                                    }
                                    return url;
                                  })(myProp.images[0])}
                                  alt={myProp.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
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

      {/* Premium Lightbox Gallery Modal */}
      <AnimatePresence>
        {isGalleryOpen && mediaItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-xl flex flex-col justify-between"
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/60 to-transparent z-10 text-white">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsGalleryOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title={language === 'es' ? 'Cerrar' : 'Close'}
                >
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-brand-accent tracking-widest">
                    {language === 'es' ? 'Galería Premium' : 'Premium Gallery'}
                  </span>
                  <span className="text-xs font-bold text-brand-gray-300">
                    {galleryIndex + 1} / {mediaItems.length}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                  title="Fullscreen"
                >
                  <Maximize className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mediaItems[galleryIndex]) {
                      const link = document.createElement('a');
                      link.href = mediaItems[galleryIndex].url;
                      link.download = `propiedad-${property.id}-media-${galleryIndex + 1}`;
                      link.target = '_blank';
                      link.click();
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                  title="Descargar"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mediaItems[galleryIndex]) {
                      navigator.clipboard.writeText(mediaItems[galleryIndex].url);
                      alert(language === 'es' ? 'Enlace copiado al portapapeles.' : 'URL copied to clipboard.');
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                  title="Compartir enlace"
                >
                  <Share className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Interactive Stage */}
            <div 
              className="flex-1 w-full flex items-center justify-center relative overflow-hidden px-4 md:px-16"
            >
              {/* Navigation Arrows */}
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-4 md:left-8 p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-white transition-colors cursor-pointer z-10 hidden sm:block"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Main Media Content */}
              <div className="w-full h-full flex items-center justify-center relative">
                {mediaItems[galleryIndex]?.type === 'image' ? (
                  <motion.img
                    key={galleryIndex}
                    src={mediaItems[galleryIndex].url}
                    alt={`${property.title} - ${galleryIndex + 1}`}
                    animate={{ scale: zoomScale, x: panOffset.x, y: panOffset.y }}
                    drag={isZoomed}
                    dragConstraints={{ left: -300 * zoomScale, right: 300 * zoomScale, top: -200 * zoomScale, bottom: 200 * zoomScale }}
                    dragElastic={0.1}
                    onDragEnd={(e, info) => {
                      setPanOffset({ x: info.offset.x, y: info.offset.y });
                    }}
                    onDoubleClick={handleDoubleClick}
                    className={`max-w-full max-h-[75vh] object-contain rounded-xl select-none shadow-2xl transition-shadow ${isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                  />
                ) : (
                  <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black flex items-center justify-center">
                    {renderMediaItem(mediaItems[galleryIndex], "w-full h-full object-contain")}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-4 md:right-8 p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-white transition-colors cursor-pointer z-10 hidden sm:block"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Bottom Thumbnail Strip */}
            <div className="bg-gradient-to-t from-black/80 to-transparent p-6 z-10">
              <div className="flex justify-center gap-2 max-w-full overflow-x-auto py-2 no-scrollbar">
                {mediaItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setIsZoomed(false);
                      setZoomScale(1);
                      setPanOffset({ x: 0, y: 0 });
                      setGalleryIndex(idx);
                    }}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${galleryIndex === idx ? 'border-brand-accent scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : item.type === 'video' ? (
                      <div className="w-full h-full bg-brand-black flex items-center justify-center relative">
                        <video src={item.url} className="w-full h-full object-cover opacity-60" muted />
                        <Play className="absolute w-4 h-4 text-white fill-white" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-brand-black flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-brand-accent/40" />
                        <span className="absolute text-[8px] font-black text-white uppercase tracking-wider">3D</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
