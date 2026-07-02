"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useWebSocketStream, StreamStatus } from '../hooks/useWebSocketStream';
import { useTranslation } from '../lib/context/LanguageContext';
import { VideoAvatar } from './VideoAvatar';
import { useSwap } from '../lib/context/SwapContext';
import { useLiveContext } from '../lib/context/LiveContext';
import { GUIDED_FLOWS } from '../lib/concierge/guidedFlows';
import { 
  Sparkles, X, Send, Mic, MicOff, 
  HelpCircle, Volume2, VolumeX, Minimize2,
  Navigation, ArrowUpRight, User, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  resolveIntent as pureResolveIntent,
  isPropertySearchTrigger,
  PropertySearchIntent,
  IntentContext,
  IntentResult
} from '../lib/eterna/IntentRouter';
import {
  ConversationEngine,
  ConversationIntent,
  ConversationStatus,
  ConversationSession,
  ConversationMemory,
  ConversationStep
} from '../lib/eterna/ConversationEngine';
import { IntentClassifier } from '../lib/eterna/IntentClassifier';
import { generatePropertySummary, resolveLocalPropertyQA } from '../lib/eterna/actions/PropertyActions';
import { useSearchActions } from '../lib/eterna/actions/SearchActions';
import { useNavigationActions } from '../lib/eterna/actions/NavigationActions';
import { useGeneralActions } from '../lib/eterna/actions/GeneralActions';
import { Property } from '../lib/types';
import { ServiceFactory } from '../lib/services/ServiceFactory';
import { parseBudgetToNumber } from '../lib/search/SearchEngine';
import { PropertySearchFilters } from '../lib/search/types';
import { searchLogger } from '../lib/search/searchLogger';
// ────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────

import { useEternaVoice } from '../hooks/useEternaVoice';
import { useThinkingContext } from '../hooks/useThinkingContext';

type ThinkingContext = 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general';

export default function EternaConcierge() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { properties, swaps, currentUser, messages, reviews, travelDetails, setActiveSearch } = useSwap();
  const { t, language } = useTranslation();
  const { 
    liveContext, 
    setPendingIntent, 
    setActiveGuidedFlow, 
    setExploreFilters,
    eternaCommand,
    clearEternaCommand,
    setEternaChatState
  } = useLiveContext();

  // Overlay state
  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const [typedInput, setTypedInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string; route?: string; showAuthButtons?: boolean; showPublishButton?: boolean }[]>([]);
  
  const chatHistoryRef = useRef(chatHistory);
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  const shouldBeCompactOnMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return pathname !== '/';
  }, [pathname]);

  // Keep Eterna compact on mobile pages other than home page
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (shouldBeCompactOnMobile) {
        setIsCompact(true);
      }
    }
  }, [pathname, shouldBeCompactOnMobile]);
  // Eterna Search Concierge State
  const [searchIntent, setSearchIntent] = useState<PropertySearchIntent | null>(null);
  const [searchQuestionsCount, setSearchQuestionsCount] = useState<number>(0);



  // Conversational State Machine
  const [conversationalSession, setConversationalSession] = useState<ConversationSession>({
    activeIntent: ConversationIntent.NONE,
    status: ConversationStatus.IDLE,
    step: 'purpose',
    memory: {},
    createdAt: 0,
    updatedAt: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('eterna_conversation_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && Date.now() - parsed.updatedAt < 30 * 60 * 1000) {
            setConversationalSession(parsed);
          }
        } catch (e) {
          console.warn("[Eterna] Failed to parse conversational session:", e);
        }
      }
    }
  }, []);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false);
  
  // Greeting state
  const greetingTriggeredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Gemini API REST Abort Controller Ref
  const geminiAbortControllerRef = useRef<AbortController | null>(null);
  const lastPropertySummaryRef = useRef<string | null>(null);
  
  // Realtime hook
  const {
    sendMessage,
    interrupt,
    status: wsStatus,
    textResponse,
    isConnected
  } = useWebSocketStream();

  // Local simulator states (Used when disconnected)
  const [simulatedStatus, setSimulatedStatus] = useState<StreamStatus>('idle');
  const [simulatedText, setSimulatedText] = useState('');

  const {
    setThinkingContext,
    getThinkingMessage,
    getConversationContextLabel
  } = useThinkingContext({ language });

  const {
    voiceMode,
    voiceState,
    isListening,
    partialTranscript,
    speechRecognitionSupported,
    handleVoiceButtonClick,
    speak,
    stopVoiceMode,
    interruptVoice
  } = useEternaVoice({
    language,
    isConnected,
    interrupt,
    wsStatus,
    isMuted,
    simulatedStatus,
    setSimulatedStatus,
    setChatHistory,
    onMessageSend: (text) => handleSend(text),
    setThinkingContext,
    setSimulatedText
  });

  const addDebugLog = useCallback((msg: string) => {
    if (typeof window !== 'undefined') {
      if ((window as any).__eternaAddDebugLog) {
        (window as any).__eternaAddDebugLog(msg);
      } else {
        (window as any).__eternaDebugLogs = (window as any).__eternaDebugLogs || [];
        (window as any).__eternaDebugLogs.push({ time: new Date().toLocaleTimeString(), message: msg });
      }
    }
  }, []);

  // Track key voice and conversation states
  useEffect(() => {
    addDebugLog(`EternaState: listening=${isListening}, voiceState=${voiceState}, voiceMode=${voiceMode}, speechRecognitionSupported=${speechRecognitionSupported}`);
  }, [isListening, voiceState, voiceMode, speechRecognitionSupported, addDebugLog]);

  const textEndRef = useRef<HTMLDivElement>(null);
  const greetingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount to prevent memory leaks and state updates on unmounted components
  useEffect(() => {
    const currentAbortController = geminiAbortControllerRef.current;
    return () => {
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
      }
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, []);

  // Auto-close tooltip after 8s
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Expose a synchronous trigger for starting voice mode to preserve user-gesture activation context on mobile devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__eternaStartVoice = () => {
        addDebugLog(`__eternaStartVoice invoked. voiceMode: ${voiceMode}, speechRecognitionSupported: ${speechRecognitionSupported}`);
        console.log("[MOBILE TAP] __eternaStartVoice handler fired, voiceMode before:", voiceMode);
        setIsOpen(true);
        if (voiceMode) {
          stopVoiceMode();
        } else {
          handleVoiceButtonClick();
        }
        addDebugLog("__eternaStartVoice completed");
        console.log("[MOBILE TAP] __eternaStartVoice completed");
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__eternaStartVoice;
      }
    };
  }, [voiceMode, handleVoiceButtonClick, stopVoiceMode, speechRecognitionSupported, addDebugLog]);

  // Auto-focus input when the chat card is opened (MEJORA UX #1)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll text log to bottom (skip on home page to avoid viewport jumping)
  useEffect(() => {
    if (!isHome) {
      textEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, textResponse, simulatedText, isHome]);

  // Sync simulated status when WebSocket is active
  const activeStatus = isConnected ? wsStatus : simulatedStatus;

  // Floating Concierge Dual-Modality State (Phase 7)
  const [conciergeMode, setConciergeMode] = useState<'avatar' | 'chat'>('avatar');
  const [conciergeSrc, setConciergeSrc] = useState("/videos/tranquila.mp4");
  const [conciergeOpacity, setConciergeOpacity] = useState(1);
  const conciergeVideoRef = useRef<HTMLVideoElement | null>(null);

  const getConciergeTargetSrc = useCallback(() => {
    if (isListening || activeStatus === "thinking") {
      return "/videos/idle.mp4";
    }
    if (activeStatus === "talking") {
      return "/videos/talking.mp4";
    }
    return "/videos/tranquila.mp4";
  }, [isListening, activeStatus]);

  // Handle source changes with crossfade
  useEffect(() => {
    const target = getConciergeTargetSrc();
    if (target !== conciergeSrc) {
      setConciergeOpacity(0);
      
      const timer = setTimeout(() => {
        setConciergeSrc(target);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [getConciergeTargetSrc, conciergeSrc]);

  // Load and play video when source changes or mode changes to avatar
  useEffect(() => {
    if (conciergeMode === 'avatar' && conciergeVideoRef.current) {
      conciergeVideoRef.current.load();
      conciergeVideoRef.current.play().catch(err => {
        console.warn("[Concierge Video] Play blocked or interrupted:", err);
      });
    }
  }, [conciergeSrc, conciergeMode]);

  // Handle opacity transitions
  useEffect(() => {
    if (conciergeOpacity === 0) {
      setConciergeOpacity(1);
    }
  }, [conciergeSrc, conciergeOpacity]);

  // ────────────────────────────────────────────────
  // CONTEXT BRIDGE — Real user data for LLM
  // ────────────────────────────────────────────────

  const intentContext: IntentContext = useMemo(() => {
    const myProps = properties.filter(p => p.hostId === currentUser?.id);
    const pendingSwaps = swaps.filter(s =>
      s.status === 'PENDING' && (s.receiverId === currentUser?.id || s.senderId === currentUser?.id)
    );
    const activeTrips = swaps.filter(s =>
      ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status) &&
      (s.senderId === currentUser?.id || s.receiverId === currentUser?.id)
    );
    const unreadMessages = messages.filter(m =>
      !m.isRead && m.senderId !== currentUser?.id
    );
    const pendingReviews = swaps.filter(s =>
      s.status === 'COMPLETED' &&
      (s.senderId === currentUser?.id || s.receiverId === currentUser?.id) &&
      !reviews.some(r => r.swapId === s.id && r.reviewerId === currentUser?.id)
    );

    return {
      pendingSwaps: pendingSwaps.length,
      activeTrips: activeTrips.length,
      unreadMessages: unreadMessages.length,
      myPropertiesCount: myProps.length,
      pendingReviews: pendingReviews.length,
      userName: currentUser?.name || 'Viajero',
      swaps,
      properties,
      currentUser,
      messages,
      reviews,
      travelDetails: travelDetails || [],
    };
  }, [properties, swaps, messages, reviews, currentUser, travelDetails]);

  const contextBridgeJSON = useMemo(() => {
    const myProps = properties.filter(p => p.hostId === currentUser?.id);
    const activeTrips = swaps.filter(s =>
      ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status) &&
      (s.senderId === currentUser?.id || s.receiverId === currentUser?.id)
    );
    const myReviews = reviews.filter(r => r.reviewedUserId === currentUser?.id);

    return JSON.stringify({
      user: currentUser?.name || 'Viajero',
      userId: currentUser?.id || '',
      properties: myProps.map(p => `${p.title} (${p.location}, ${p.country})`),
      propertiesCount: myProps.length,
      pendingSwaps: intentContext.pendingSwaps,
      activeTrips: activeTrips.map(s => ({
        status: s.status,
        dates: `${s.startDate} → ${s.endDate}`,
      })),
      activeTripsCount: intentContext.activeTrips,
      unreadMessages: intentContext.unreadMessages,
      avgRating: myReviews.length > 0
        ? (myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length).toFixed(1)
        : null,
      totalReviews: myReviews.length,
      pendingReviews: intentContext.pendingReviews,
    });
  }, [properties, swaps, reviews, currentUser, intentContext]);

  // 1. Zero-Configuration RAG Auto-Syncing disabled for LOCAL ONLY MODE
  useEffect(() => {
    // RAG and FastAPI are frozen in Local Only Mode.
  }, []);

  // 1.5 Robust Auto-connection disabled for LOCAL ONLY MODE
  // WebSockets and FastAPI are frozen. Operating in Local Only Mode.



  // ────────────────────────────────────────────────
  // CONTEXT-AWARE SYSTEM PROMPT (with Context Bridge)
  // ────────────────────────────────────────────────

  const systemPrompt = useMemo(() => {
    return {
      role: 'system',
      content: language === 'es'
        ? `Eres Eterna, la Concierge IA de Lujo y anfitriona virtual oficial de AuraSwap (versión 2026).
Tu propósito es asistir con extrema elegancia, calidez y profesionalidad a ${currentUser?.name || 'el usuario'} en su viaje.
REGLAS DE RESPUESTA:
1. Responde estrictamente en ESPAÑOL neutro y elegante. Evita modismos de otros idiomas.
2. Da respuestas de máximo 2 o 3 oraciones extremadamente fluidas y directas, óptimas para sintetizar a voz nativa.
3. Utiliza los datos reales de la cuenta del usuario para personalizar tus respuestas.
4. Para dirigir al usuario a una sección, invítalo a pedirte que lo lleves (ej: "Dime 'llévame a mis mensajes'").

---
DATOS DE LA CUENTA DEL USUARIO:
${contextBridgeJSON}

---
PÁGINA ACTUAL: ${pathname || '/'}

---
CONOCIMIENTO DEL PRODUCTO AURASWAP 2026:

1. MODALIDADES COMERCIALES SOPORTADAS:
* SWAP: Intercambio recíproco libre de pago de alquiler diario (0€). Comisión de servicio del 1% por swap exitoso. Seguro premium hasta 1,000,000€.
* SHORT_RENT: Renta temporal por noche (estilo vacacional / Airbnb).
* MONTHLY_RENT: Renta de mediano/largo plazo mensual.
* SALE: Venta directa del inmueble.
* Nota: La compra no es una modalidad; es la acción del usuario sobre una propiedad en SALE.

2. WIZARD DE PUBLICACIÓN DE PROPIEDADES (Acceso mediante el Dashboard):
El Wizard consta de 6 fases secuenciales en el modal:
* Paso 0 (Identidad): Seleccionar si publica como Propietario, Agente/Broker, o Desarrollador.
* Paso 1 (Modalidades): Elegir las modalidades de publicación deseadas (SWAP, SHORT_RENT, MONTHLY_RENT, SALE).
* Paso 2 (Información básica): Título del anuncio, Tipo de propiedad, Dirección completa, Ciudad, País y Descripción.
* Paso 3 (Características): Cantidad de dormitorios, baños completos, medios baños y huéspedes (capacidad máxima).
* Paso 4 (Multimedia): Cargar fotos, Enlace de video y Enlace de Tour Virtual.
* Paso 5 (Ofertas): Configurar precios, monedas, depósitos e intervalos de forma independiente por cada pestaña de modalidad (ej: el precio de venta se coloca en el Paso 5 dentro de la pestaña SALE).

3. EXPLORACIÓN DE PROPIEDADES (Explore Page):
* Categorías (Tipos de Propiedad): Apartment, Beach House, Cabin, Penthouse, Villa, Loft.
* Filtros disponibles: Destino (buscador), Rango de Fechas (calendario), Huéspedes, Swap Type (Premium, Luxury, Exclusive, Curated), y ordenación por Aura Score (match), capacidad o calificación.
* Pestañas comerciales en Explore: Todo (ALL), Intercambio (SWAP), Renta (RENT - engloba SHORT_RENT y MONTHLY_RENT) y Venta (SALE).

4. NAVEGACIÓN DISPONIBLE (Rutas de AuraSwap a las que puedes dirigir al usuario):
* Explorar catálogo general: "/explore"
* Bandeja de entrada de chat/mensajes: "/messages"
* Edición de perfil: "/profile"
* Dashboard - Pestaña Mis Propiedades (y Wizard): "/dashboard?tab=properties"
* Dashboard - Pestaña Mis Viajes: "/dashboard?tab=trips"
* Dashboard - Pestaña Solicitudes de Intercambio (Swaps): "/dashboard?tab=swaps"
No inventes otras rutas de navegación. Si el usuario te pide ir a alguna sección, guíalo hacia estas rutas SPA con amabilidad.`
        : `You are Eterna, the official Luxury AI Concierge and virtual host of AuraSwap (2026 version).
Your purpose is to assist ${currentUser?.name || 'the user'} with extreme elegance, warmth, and professionalism on their journey.
RESPONSE RULES:
1. Respond strictly in clean and elegant ENGLISH.
2. Give short responses of at most 2 or 3 extremely fluid and direct sentences, optimal for speech synthesis.
3. Use the real user account data to personalize your responses.
4. To guide the user to a section, invite them to ask you to take them there (e.g., "Tell me 'take me to my messages'").

---
USER ACCOUNT DATA:
${contextBridgeJSON}

---
CURRENT PAGE: ${pathname || '/'}

---
AURASWAP 2026 PRODUCT KNOWLEDGE:

1. SUPPORTED COMMERCIAL MODES:
* SWAP: Rent-free reciprocal exchange (0€). 1% service fee per successful swap. Premium damage protection insurance up to 1,000,000€.
* SHORT_RENT: Short-term rental per night (vacation/Airbnb style).
* MONTHLY_RENT: Mid/long-term rental paid monthly.
* SALE: Direct sale of the property.
* Note: Purchase (buying) is not a listing mode; it is the user's action on a property in SALE mode.

2. PROPERTY PUBLISHING WIZARD (Accessed via the Dashboard):
The Wizard consists of 6 sequential steps in the modal:
* Step 0 (Identity): Select if publishing as Owner, Agent/Broker, or Developer.
* Step 1 (Modes): Choose listing modes (SWAP, SHORT_RENT, MONTHLY_RENT, SALE).
* Step 2 (Basic Info): Listing Title, Property Type, Physical Address, City, Country, and Description.
* Step 3 (Features): Bedrooms, bathrooms, half bathrooms, and guests capacity.
* Step 4 (Multimedia): Upload photos, Video link, and Virtual Tour link.
* Step 5 (Offers): Configure prices, currencies, deposits, and dates independently per mode tab (e.g., the sale price is configured in Step 5 inside the SALE tab).

3. PROPERTY EXPLORATION (Explore Page):
* Categories (Property Types): Apartment, Beach House, Cabin, Penthouse, Villa, Loft.
* Available Filters: Destination (search bar), Dates (calendar), Guests, Swap Type (Premium, Luxury, Exclusive, Curated), and sorting by Aura Score (match), capacity, or rating.
* Commercial tabs in Explore: All (ALL), Swap (SWAP), Rent (RENT - groups SHORT_RENT and MONTHLY_RENT), and Sale (SALE).

4. AVAILABLE NAVIGATION (AuraSwap SPA routes you can guide the user to):
* Browse properties catalog: "/explore"
* Inbox messages / chats: "/messages"
* Edit profile details: "/profile"
* Dashboard - My Properties tab (and Wizard): "/dashboard?tab=properties"
* Dashboard - My Trips tab: "/dashboard?tab=trips"
* Dashboard - Swap Requests tab: "/dashboard?tab=swaps"
Do not invent any other routes. If the user asks you to go to a section, politely guide them to these SPA routes.`
    };
  }, [contextBridgeJSON, currentUser, language, pathname]);



  // ────────────────────────────────────────────────
  // INTENT ROUTER — Resolves actions without LLM
  // ────────────────────────────────────────────────

  const resolveIntent = useCallback((prompt: string): IntentResult => {
    return pureResolveIntent(prompt, intentContext, language);
  }, [intentContext, language]);



  // ── ETERNA SEARCH CONCIERGE HELPERS (useSearchActions Hook) ──
  const {
    checkNextSearchStep
  } = useSearchActions({
    language,
    router,
    speak,
    setSearchIntent,
    setSearchQuestionsCount,
    setExploreFilters,
    setChatHistory,
    setSimulatedStatus,
    setIsOpen,
    setIsCompact
  });

  // Sync active property summary auto-speak
  useEffect(() => {
    const activeProperty = liveContext.property;
    const isPropertyPage = pathname?.startsWith('/property/');

    if (isPropertyPage && activeProperty) {
      if (lastPropertySummaryRef.current === activeProperty.id) {
        return;
      }

      lastPropertySummaryRef.current = activeProperty.id;

      const summary = generatePropertySummary(activeProperty, language === 'es' ? 'es' : 'en');

      if (window.innerWidth < 768) {
        setIsCompact(true);
      }
      setIsOpen(true);
      setChatHistory(prev => [...prev, { role: 'assistant', content: summary }]);
      setSimulatedStatus('talking');
      speak(summary, () => {
        setSimulatedStatus('idle');
      });
    } else if (!isPropertyPage) {
      lastPropertySummaryRef.current = null;
    }
  }, [liveContext.property, pathname, language, speak]);

  // ────────────────────────────────────────────────
  // PERSONALIZED AUTO-GREETING on panel open
  // ────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && !greetingTriggeredRef.current && chatHistory.length === 0 && currentUser) {
      greetingTriggeredRef.current = true;

      // Build personalized greeting with real data
      const parts: string[] = [];

      if (language === 'es') {
        parts.push(`Hola ${currentUser.name.split(' ')[0]}.`);

        const dataPoints: string[] = [];
        if (intentContext.unreadMessages > 0) {
          dataPoints.push(`${intentContext.unreadMessages} mensaje${intentContext.unreadMessages > 1 ? 's' : ''} sin leer`);
        }
        if (intentContext.activeTrips > 0) {
          dataPoints.push(`${intentContext.activeTrips} viaje${intentContext.activeTrips > 1 ? 's' : ''} activo${intentContext.activeTrips > 1 ? 's' : ''}`);
        }
        if (intentContext.pendingSwaps > 0) {
          dataPoints.push(`${intentContext.pendingSwaps} solicitud${intentContext.pendingSwaps > 1 ? 'es' : ''} pendiente${intentContext.pendingSwaps > 1 ? 's' : ''}`);
        }
        if (intentContext.pendingReviews > 0) {
          dataPoints.push(`${intentContext.pendingReviews} reseña${intentContext.pendingReviews > 1 ? 's' : ''} por escribir`);
        }

        if (dataPoints.length > 0) {
          parts.push(`Tienes ${dataPoints.join(', ')}.`);
        } else {
          parts.push('Todo está al día en tu cuenta.');
        }

        parts.push('¿En qué puedo ayudarte?');
      } else {
        parts.push(`Hi ${currentUser.name.split(' ')[0]}.`);

        const dataPoints: string[] = [];
        if (intentContext.unreadMessages > 0) {
          dataPoints.push(`${intentContext.unreadMessages} unread message${intentContext.unreadMessages > 1 ? 's' : ''}`);
        }
        if (intentContext.activeTrips > 0) {
          dataPoints.push(`${intentContext.activeTrips} active trip${intentContext.activeTrips > 1 ? 's' : ''}`);
        }
        if (intentContext.pendingSwaps > 0) {
          dataPoints.push(`${intentContext.pendingSwaps} pending request${intentContext.pendingSwaps > 1 ? 's' : ''}`);
        }
        if (intentContext.pendingReviews > 0) {
          dataPoints.push(`${intentContext.pendingReviews} review${intentContext.pendingReviews > 1 ? 's' : ''} to write`);
        }

        if (dataPoints.length > 0) {
          parts.push(`You have ${dataPoints.join(', ')}.`);
        } else {
          parts.push('Everything is up to date on your account.');
        }

        parts.push('How can I help you?');
      }

      const greeting = parts.join(' ');

      // Add greeting to chat and speak it
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
      }

      greetingTimerRef.current = setTimeout(() => {
        // Double-check using the latest ref to prevent greeting if a message was received
        if (chatHistoryRef.current.length > 0) {
          return;
        }

        setSimulatedStatus('talking');
        setChatHistory(prev => prev.length > 0 ? prev : [{ role: 'assistant', content: greeting }]);

        speak(greeting, () => {
          setSimulatedStatus('idle');
        });
      }, 600);
    }

    return () => {
      // Only clear if the panel closes, avoiding clearing on mid-rendering hasGreeted state updates
      if (!isOpen && greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
        greetingTimerRef.current = null;
      }
    };
  }, [isOpen, currentUser, intentContext, language, speak, chatHistory.length]);

  // Reset greeting when panel closes, but ONLY if there is no chat history
  useEffect(() => {
    if (!isOpen && chatHistory.length === 0) {
      const timer = setTimeout(() => {
        greetingTriggeredRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, chatHistory.length]);

  // Sync streaming text chunk to chat history when WS ends speaking
  useEffect(() => {
    if (isConnected && textResponse && wsStatus === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatHistory(prev => [...prev, { role: 'assistant', content: textResponse }]);
    }
  }, [wsStatus, isConnected, textResponse]);

  // ────────────────────────────────────────────────
  // GEMINI API & INTELLIGENT FALLBACK (useGeneralActions Hook)
  // ────────────────────────────────────────────────
  const {
    callGeminiAvatarAPI
  } = useGeneralActions({
    language,
    currentUser,
    chatHistory,
    systemPrompt,
    messages,
    reviews,
    intentContext,
    geminiAbortControllerRef,
    setThinkingContext,
    setSimulatedStatus,
    setSimulatedText,
    setChatHistory,
    speak
  });

  // ────────────────────────────────────────────────
  // PERSISTENT GUIDED FLOWS & NAVIGATION (useNavigationActions Hook)
  // ────────────────────────────────────────────────
  const {
    getCatalogMessage,
    navigateToRoute,
    completeActiveFlow
  } = useNavigationActions({
    currentUser,
    language,
    router,
    speak,
    setPendingIntent,
    setActiveGuidedFlow,
    setChatHistory,
    setIsOpen,
    setSimulatedStatus,
    setIsCompact
  });

  // 1. Post-Login Recovery and Flow Activation
  useEffect(() => {
    const pending = liveContext.eterna.pendingIntent;
    if (currentUser && pending) {
      if (Date.now() - pending.timestamp < 10 * 60 * 1000) {
        // Clear pending intent to prevent loops
        setPendingIntent(null);

        // Activate persistent guided flow
        setActiveGuidedFlow(pending.intent);

        // Personalize message with first name
        const firstName = currentUser.name.split(' ')[0];
        const postLoginMsg = getCatalogMessage(pending.intent, 'post', language)
          .replace('{name}', firstName);

        const isPublish = pending.intent === 'publish_property';

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChatHistory(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: postLoginMsg, 
            showPublishButton: isPublish 
          }
        ]);
        setIsOpen(true);
        setSimulatedStatus('talking');

        speak(postLoginMsg, () => {
          setSimulatedStatus('idle');
          // Navigate to target route
          router.push(pending.route);
        });
      } else {
        setPendingIntent(null);
      }
    }
  }, [currentUser, liveContext.eterna.pendingIntent, setPendingIntent, setActiveGuidedFlow, getCatalogMessage, language, speak, router]);

  // 2. Guided Flow Custom Event Listeners (profile_saved, property_created)
  useEffect(() => {
    const handleFlowEvent = (e: Event) => {
      const eventName = (e as CustomEvent).detail?.event;
      const currentFlow = liveContext.eterna.activeGuidedFlow;
      if (!currentFlow) return;

      const definition = GUIDED_FLOWS[currentFlow];
      if (definition && definition.completionCondition === eventName) {
        completeActiveFlow(currentFlow);
      }
    };

    window.addEventListener('auraswap:flow-event', handleFlowEvent);
    return () => window.removeEventListener('auraswap:flow-event', handleFlowEvent);
  }, [liveContext.eterna.activeGuidedFlow, completeActiveFlow]);

  // 3. Guided Flow Route-based Completion (page_loaded)
  useEffect(() => {
    const currentFlow = liveContext.eterna.activeGuidedFlow;
    if (!currentFlow) return;

    const definition = GUIDED_FLOWS[currentFlow];
    if (definition && definition.completionCondition === 'page_loaded') {
      const params = searchParams.toString();
      const currentUrlPath = pathname + (params ? `?${params}` : '');
      if (currentUrlPath.startsWith(definition.destination)) {
        completeActiveFlow(currentFlow);
      }
    }
  }, [pathname, searchParams, liveContext.eterna.activeGuidedFlow, completeActiveFlow]);

  // 4. Property Wizard Steps Contextual Guidance (publish_property flow)
  const lastGuidedStepRef = useRef<number | null>(null);
  useEffect(() => {
    const currentFlow = liveContext.eterna.activeGuidedFlow;
    const { isOpen: isWizardOpen, step } = liveContext.wizard;

    if (!isWizardOpen) {
      lastGuidedStepRef.current = null;
      return;
    }

    if (currentFlow === 'publish_property' && step !== null && step !== lastGuidedStepRef.current) {
      lastGuidedStepRef.current = step;

      const stepMessagesES: Record<number, string> = {
        0: "Selecciona la opción que mejor te represente.\n\nSoy Propietario:\nsi la propiedad te pertenece.\n\nAgente Inmobiliario:\nsi representas a un cliente.\n\nDesarrollador Inmobiliario:\nsi pertenece a un proyecto inmobiliario.\n\nCuando selecciones una opción continuaremos automáticamente.",
        1: "Ahora definiremos cómo deseas comercializar la propiedad.\n\nPuedes ofrecerla para venta, renta, intercambio o varias modalidades al mismo tiempo.\n\nSelecciona las opciones que mejor se adapten a tus objetivos.",
        2: "Ahora vamos a crear el anuncio.\n\nUtiliza un título claro y atractivo.\n\nDespués agrega una descripción destacando ubicación, características principales, amenidades y ventajas competitivas.",
        3: "Ingresa las características físicas de la propiedad.\n\nHabitaciones, baños, capacidad y demás información relevante.\n\nMientras más precisa sea la información, mejores resultados obtendrás.",
        4: "Ahora agrega fotografías.\n\nTe recomiendo incluir fachada, áreas comunes, habitaciones, baños y espacios exteriores.\n\nLas imágenes de calidad mejoran significativamente el desempeño del anuncio.",
        5: "Configura precios y modalidades comerciales.\n\nSi la propiedad está disponible para venta y renta puedes configurar ambas opciones."
      };

      const stepMessagesEN: Record<number, string> = {
        0: "Select the option that best represents you.\n\nOwner:\nif the property belongs to you.\n\nReal Estate Agent:\nif you represent a client.\n\nReal Estate Developer:\nif it belongs to a real estate project.\n\nOnce you select an option, we will continue automatically.",
        1: "Now we will define how you wish to market the property.\n\nYou can offer it for sale, rent, exchange, or several modalities at the same time.\n\nSelect the options that best fit your goals.",
        2: "Now we are going to create the listing.\n\nUse a clear and attractive title.\n\nThen add a description highlighting location, main features, amenities, and competitive advantages.",
        3: "Enter the physical characteristics of the property.\n\nBedrooms, bathrooms, capacity, and other relevant information.\n\nThe more precise the information is, the better results you will get.",
        4: "Now add photographs.\n\nI recommend including the facade, common areas, bedrooms, bathrooms, and outdoor spaces.\n\nQuality images significantly improve the performance of the listing.",
        5: "Configure prices and commercial modalities.\n\nIf the property is available for sale and rent, you can configure both options."
      };

      const stepMsg = language === 'es' ? stepMessagesES[step] : stepMessagesEN[step];

      if (stepMsg) {
        setTimeout(() => {
          setChatHistory(prev => [...prev, { role: 'assistant', content: stepMsg }]);
          setIsOpen(true);
          setSimulatedStatus('talking');
          speak(stepMsg, () => {
            setSimulatedStatus('idle');
          });
        }, 0);
      }
    }

    if (!isWizardOpen) {
      lastGuidedStepRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveContext.wizard.isOpen, liveContext.wizard.step, liveContext.eterna.activeGuidedFlow, language, speak]);

  const publishWizardOpenedRef = useRef(false);

  // 4b. Auto-open Property Wizard if publish_property guided flow is active and we are on dashboard tab=properties
  useEffect(() => {
    const isDashboardProperties = pathname === '/dashboard' && searchParams.get('tab') === 'properties';
    const isPublishFlow = liveContext.eterna.activeGuidedFlow === 'publish_property';
    const isWizardOpen = liveContext.wizard.isOpen;

    console.log('[WIZARD CLOSE] auto-open effect', {
      activeGuidedFlow: liveContext.eterna.activeGuidedFlow,
      wizardOpen: isWizardOpen,
      publishWizardOpenedRef: publishWizardOpenedRef.current,
      pathname,
      tab: searchParams.get('tab')
    });

    if (!isDashboardProperties || !isPublishFlow) {
      publishWizardOpenedRef.current = false;
    } else if (!isWizardOpen && !publishWizardOpenedRef.current) {
      console.log('[WIZARD CLOSE] dispatch open-property-wizard');
      window.dispatchEvent(new CustomEvent('open-property-wizard'));
      publishWizardOpenedRef.current = true;
    }
  }, [pathname, searchParams, liveContext.eterna.activeGuidedFlow, liveContext.wizard.isOpen]);

  // 4c. Set active guided flow to publish_property if wizard is opened manually for listing/publishing (not editing)
  /*
  useEffect(() => {
    const { isOpen: isWizardOpen, isEditing } = liveContext.wizard;
    const currentFlow = liveContext.eterna.activeGuidedFlow;
    if (isWizardOpen && !isEditing && !currentFlow) {
      setActiveGuidedFlow('publish_property');
    }
  }, [liveContext.wizard.isOpen, liveContext.wizard.isEditing, liveContext.eterna.activeGuidedFlow, setActiveGuidedFlow]);
  */

  const determineOperation = (memory: ConversationMemory, promptHistory: string): 'sale' | 'rent' | undefined => {
    const clean = promptHistory.toLowerCase();
    if (/\b(intercambio|intercambiar|swap|swaps|trueque|exchange|intercambio reciproco)\b/i.test(clean)) {
      return undefined;
    }
    if (/\b(renta|rentar|alquiler|alquilar|mensual|mensuales|mes|rent|rental|monthly|lease|rentar una casa)\b/i.test(clean)) {
      return 'rent';
    }
    if (/\b(comprar|compra|adquirir|venta|buy|purchase|sale|inversion|invertir)\b/i.test(clean)) {
      return 'sale';
    }
    if (memory.budget?.value) {
      const budgetClean = memory.budget.value.toLowerCase();
      if (/\b(renta|rentar|alquiler|alquilar|mensual|mensuales|mes|rent|rental|monthly|lease)\b/i.test(budgetClean)) {
        return 'rent';
      }
    }
    const purpose = memory.purpose?.value || 'vivir';
    return purpose === 'inversion' ? 'sale' : 'rent';
  };

  const determineOfferingMode = (memory: ConversationMemory, promptHistory: string): 'SALE' | 'RENT' | 'SWAP' => {
    const clean = promptHistory.toLowerCase();
    if (/\b(intercambio|intercambiar|swap|swaps|trueque|exchange|intercambio reciproco)\b/i.test(clean)) {
      return 'SWAP';
    }
    if (/\b(renta|rentar|alquiler|alquilar|mensual|mensuales|mes|rent|rental|monthly|lease|rentar una casa)\b/i.test(clean)) {
      return 'RENT';
    }
    if (/\b(comprar|compra|adquirir|venta|buy|purchase|sale|inversion|invertir)\b/i.test(clean)) {
      return 'SALE';
    }
    const purpose = memory.purpose?.value || 'vivir';
    return purpose === 'inversion' ? 'SALE' : 'SWAP';
  };

  const determinePropertyType = (memory: ConversationMemory, promptHistory: string): 'house' | 'apartment' | undefined => {
    const clean = promptHistory.toLowerCase();
    if (/\b(departamento|departamentos|depto|deptos|condo|condominio|apartment|apartments|flat)\b/i.test(clean)) {
      return 'apartment';
    }
    if (/\b(casa|casas|residencia|residencial|home|house|houses|villa)\b/i.test(clean)) {
      return 'house';
    }
    return undefined;
  };

  const askStepOrConfirm = async (
    step: ConversationStep,
    memory: ConversationMemory,
    userPrompt: string
  ): Promise<string> => {
    const baseQuestion = ConversationEngine.ask(step, memory, language);
    if (step !== 'confirm') {
      return baseQuestion;
    }

    const promptHistory = chatHistory.filter(h => h.role === 'user').map(h => h.content).join(' ') + ' ' + userPrompt;
    const operation = determineOperation(memory, promptHistory);
    const type = determinePropertyType(memory, promptHistory);
    const city = memory.city?.value || '';
    const budgetVal = memory.budget?.value ? parseBudgetToNumber(memory.budget.value, operation || 'rent') : undefined;
    const roomsVal = memory.rooms?.value;

    const filters: PropertySearchFilters = {
      city,
      operation,
      budget: budgetVal,
      rooms: roomsVal,
    };
    if (type) {
      filters.type = type;
    }

    try {
      const searchResult = await ServiceFactory.getPropertyService().search(filters);
      const results = searchResult.results;
      if (results && results.length > 0) {
        const topResults = results.slice(0, 3);
        type LegacyProperty = Property & {
          price?: number;
          zone?: string;
          currency?: string;
          operation?: 'sale' | 'rent';
          parking?: number;
          idealFor?: string;
          features?: string[];
        };
        const formattedCards = topResults.map(prop => {
          const legacyProp = prop as LegacyProperty;
          const activeOffering = (legacyProp.offerings || []).find(o => o.status === 'ACTIVE');
          const price = activeOffering?.priceAmount ?? legacyProp.price ?? 0;
          const priceStr = price > 0 ? price.toLocaleString('en-US') : 'Contactar';
          const currency = activeOffering?.currency ?? legacyProp.currency ?? 'MXN';
          const operation = activeOffering ? (activeOffering.mode === 'SALE' ? 'sale' : 'rent') : (legacyProp.operation || 'sale');
          
          const locParts = (legacyProp.location || '').split(',');
          const zone = locParts[0]?.trim() || '';
          const city = legacyProp.city || locParts[1]?.trim() || '';

          const featuresStr = legacyProp.amenities?.join(' • ') || legacyProp.features?.join(' • ') || '';
          
          let card = `**${legacyProp.title}**\n\n`;
          if (zone && city) {
            card += `📍 ${zone}, ${city}\n\n`;
          } else {
            card += `📍 ${legacyProp.location || ''}\n\n`;
          }

          if (operation === 'rent') {
            card += `💰 $${priceStr} ${currency} mensuales\n\n`;
          } else {
            card += `💰 $${priceStr} ${currency}\n\n`;
          }
          
          const bedsLabel = language === 'es' 
            ? `${legacyProp.bedrooms} recámara${legacyProp.bedrooms !== 1 ? 's' : ''}`
            : `${legacyProp.bedrooms} bedroom${legacyProp.bedrooms !== 1 ? 's' : ''}`;
            
          const bathsLabel = language === 'es'
            ? `${legacyProp.bathrooms} baño${legacyProp.bathrooms !== 1 ? 's' : ''}`
            : `${legacyProp.bathrooms} bathroom${legacyProp.bathrooms !== 1 ? 's' : ''}`;
            
          card += `🛏️ ${bedsLabel}\n\n`;
          card += `🚿 ${bathsLabel}\n\n`;
          
          const parkingCount = legacyProp.parking ?? 0;
          if (parkingCount > 0) {
            const parkLabel = language === 'es'
              ? `${parkingCount} estacionamiento${parkingCount !== 1 ? 's' : ''}`
              : `${parkingCount} parking space${parkingCount !== 1 ? 's' : ''}`;
            card += `🚗 ${parkLabel}\n\n`;
          }
          
          if (featuresStr) {
            card += `✨ ${featuresStr}\n\n`;
          }
          
          let idealForStr = legacyProp.idealFor || legacyProp.description || '';
          if (idealForStr) {
            if (!idealForStr.toLowerCase().startsWith('ideal') && !idealForStr.toLowerCase().startsWith('residencia')) {
              idealForStr = language === 'es' ? `Ideal para ${idealForStr}` : `Ideal for ${idealForStr}`;
            }
            idealForStr = idealForStr.charAt(0).toUpperCase() + idealForStr.slice(1);
            if (!idealForStr.endsWith('.')) {
              idealForStr += '.';
            }
            card += idealForStr;
          }
          
          return card;
        }).join('\n\n---\n\n');

        const introHeader = language === 'es'
          ? `He encontrado las siguientes propiedades que coinciden con tu búsqueda:`
          : `I found the following properties matching your search:`;

        return `${baseQuestion}\n\n${introHeader}\n\n---\n\n${formattedCards}`;
      }
    } catch (err) {
      console.error("[Eterna Concierge] Error searching demo properties:", err);
    }

    return baseQuestion;
  };

  const runSearchAndRedirect = useCallback(async (searchMemory: ConversationMemory, userPrompt: string) => {
    const cityStr = searchMemory.city?.value || '';
    const searchMsg = language === 'es'
      ? `¡Excelente! He encontrado propiedades interesantes en ${cityStr} que se ajustan a tu presupuesto. Te muestro las opciones en el explorador.`
      : `Excellent! I have found interesting properties in ${cityStr} that match your budget. Showing you the options in the explorer.`;

    setThinkingContext('property_search');
    setChatHistory(prev => [...prev, { role: 'assistant', content: searchMsg }]);
    setSimulatedStatus('talking');

    const city = searchMemory.city?.value || '';
    const promptHistory = chatHistory.filter(h => h.role === 'user').map(h => h.content).join(' ') + ' ' + userPrompt;
    const offeringMode = determineOfferingMode(searchMemory, promptHistory);
    const operation = offeringMode === 'SALE' ? 'sale' : (offeringMode === 'RENT' ? 'rent' : undefined);
    const type = determinePropertyType(searchMemory, promptHistory);
    const budgetVal = searchMemory.budget?.value ? parseBudgetToNumber(searchMemory.budget.value, operation || 'rent') : undefined;
    const roomsVal = searchMemory.rooms?.value;

    const filters: PropertySearchFilters = {
      city,
      operation,
      budget: budgetVal,
      rooms: roomsVal,
    };
    if (type) {
      filters.type = type;
    }

    const sessionId = `session-${Date.now()}`;
    const sessionStart = Date.now();
    const providerName = ServiceFactory.getPropertyService().getCapabilities().supportsRealtime ? 'supabase' : 'mock';

    // Set activeSearch state to loading
    setActiveSearch({
      id: sessionId,
      origin: "eterna",
      filters,
      results: [],
      provider: providerName,
      createdAt: sessionStart,
      loading: true,
      error: null
    });

    // Run search asynchronously
    ServiceFactory.getPropertyService().search(filters)
      .then((searchResult) => {
        setActiveSearch({
          id: sessionId,
          origin: "eterna",
          filters: searchResult.filters,
          results: searchResult.results,
          provider: searchResult.provider,
          createdAt: sessionStart,
          loading: false,
          error: null
        });
      })
      .catch((err) => {
        searchLogger.error("[Eterna Concierge] Error performing activeSearch:", err);
        setActiveSearch({
          id: sessionId,
          origin: "eterna",
          filters,
          results: [],
          provider: providerName,
          createdAt: sessionStart,
          loading: false,
          error: err.message || 'Error searching properties'
        });
      });

    // Speak and redirect instantly
    speak(searchMsg);
    
    const url = `/explore?search=${encodeURIComponent(city)}&offering=${offeringMode}`;
    
    setExploreFilters({
      category: 'All',
      offeringTab: offeringMode,
      query: city,
      guests: 0,
      swapType: 'All',
      sortBy: 'match',
    });

    router.push(url);
    if (window.innerWidth < 768) {
      setIsCompact(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }

    const resetSession: ConversationSession = {
      activeIntent: ConversationIntent.NONE,
      status: ConversationStatus.IDLE,
      step: 'purpose',
      memory: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setConversationalSession(resetSession);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eterna_conversation_session');
    }
  }, [
    language,
    chatHistory,
    setThinkingContext,
    setChatHistory,
    setSimulatedStatus,
    determinePropertyType,
    setActiveSearch,
    speak,
    setExploreFilters,
    router,
    setIsCompact,
    setIsOpen
  ]);

  // ────────────────────────────────────────────────
  // HANDLE SEND — Intent Router → LLM fallback
  // ────────────────────────────────────────────────

  const handleSend = async (textToSend?: string) => {
    console.log("[Eterna Voice Console] handleSend() entry point. textToSend:", textToSend, "typedInput:", typedInput);
    // Cancel greeting timer if active
    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }

    const prompt = textToSend || typedInput;
    if (!prompt.trim()) return;

    // Interrupt current speech
    if (activeStatus === 'talking') {
      setThinkingContext('general');
      if (isConnected) {
        interrupt();
      } else {
        if (typeof window !== 'undefined') window.speechSynthesis.cancel();
        setSimulatedStatus('idle');
      }
    }



    // Default status to thinking
    setSimulatedStatus('thinking');
    setThinkingContext('general');

    // Add to chat history
    console.log("[Eterna Voice Console] setChatHistory (user):", prompt);
    setChatHistory(prev => [...prev, { role: 'user', content: prompt }]);
    setTypedInput('');

    // ── LOCAL PROPERTY QA ROUTER ──
    const activeProperty = liveContext.property;
    if (activeProperty) {
      const localQAAnswer = resolveLocalPropertyQA(prompt, activeProperty, language === 'es' ? 'es' : 'en');
      if (localQAAnswer) {
        setThinkingContext('property_detail');
        setChatHistory(prev => [...prev, { role: 'assistant', content: localQAAnswer }]);
        setSimulatedStatus('talking');
        speak(localQAAnswer, () => {
          setSimulatedStatus('idle');
        });
        return;
      }
    }

    // ── ETERNA PROPERTY SEARCH CONCIERGE (Slot Filling & Redirection) ──
    const cleanPrompt = prompt.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Check if the user initiated an explicit interruption
    const isInterruption = ConversationEngine.checkInterruption(prompt);

    const userMessages = chatHistory.filter(h => h.role === 'user');
    const isFirstUserMessage = userMessages.length === 0;

    let activeIntent = conversationalSession.activeIntent;
    let currentStep = conversationalSession.step;
    let memory = { ...conversationalSession.memory };

    // Reset restored session if this is a fresh page load / first message and it is not a direct confirmation/rejection
    if (activeIntent === ConversationIntent.PROPERTY_SEARCH && isFirstUserMessage) {
      const isConfirm = /\b(si|yes|correcto|confirmar|confirmo|de acuerdo|perfecto|ok|confirm|agree|correct)\b/i.test(cleanPrompt);
      const isReject = /\b(no|incorrecto|cambiar|modificar|corregir|modify|change|correct|edit)\b/i.test(cleanPrompt);
      if (!isConfirm && !isReject) {
        activeIntent = ConversationIntent.NONE;
        currentStep = 'purpose';
        memory = {};
        
        const resetSession: ConversationSession = {
          activeIntent: ConversationIntent.NONE,
          status: ConversationStatus.IDLE,
          step: 'purpose',
          memory: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setConversationalSession(resetSession);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('eterna_conversation_session');
        }
      }
    }

    if (activeIntent === ConversationIntent.PROPERTY_SEARCH) {
      // 1. Check if the user is attempting a topic change or cancellation
      const checkIntent = resolveIntent(prompt);
      const isTopicChange = checkIntent.matched && (checkIntent.action === 'navigate' || checkIntent.action === 'local_response');

      if (isInterruption || isTopicChange) {
        // Reset the active flow
        const resetSession: ConversationSession = {
          activeIntent: ConversationIntent.NONE,
          status: ConversationStatus.IDLE,
          step: 'purpose',
          memory: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setConversationalSession(resetSession);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('eterna_conversation_session');
        }

        if (isTopicChange) {
          console.log("[Eterna Engine] Flow interrupted by a new intent:", checkIntent.route || "local QA");
          
          let context: ThinkingContext = 'navigation';
          if (checkIntent.route) {
            const cleanPromptStr = prompt.toLowerCase();
            if (checkIntent.route.includes('tab=properties')) {
              const publishKeywords = [
                'publicar', 'crear', 'anuncio', 'list', 'add', 'vender', 'venta', 'anunciar', 'rentar', 'subir', 'sell', 'publish'
              ];
              context = publishKeywords.some(kw => cleanPromptStr.includes(kw))
                ? 'publish_property'
                : 'property_detail';
            } else if (checkIntent.route.includes('tab=swaps')) {
              context = 'swap';
            }
          } else if (checkIntent.action === 'data_response') {
            const clean = prompt.toLowerCase();
            if (clean.includes('propiedad') || clean.includes('properties')) {
              context = 'property_detail';
            } else if (clean.includes('reseña') || clean.includes('review') || clean.includes('calificacion') || clean.includes('rating')) {
              context = 'property_detail';
            }
          }
          
          setThinkingContext(context);
          setSimulatedStatus('thinking');

          if (checkIntent.route) {
            setTimeout(() => {
              let intentKey = 'view_dashboard';
              const cleanPromptStr = prompt.toLowerCase();
              if (checkIntent.route.includes('tab=properties')) {
                const publishKeywords = [
                  'publicar', 'crear', 'anuncio', 'list', 'add', 'vender', 'venta', 'anunciar', 'rentar', 'subir', 'sell', 'publish'
                ];
                intentKey = publishKeywords.some(kw => cleanPromptStr.includes(kw))
                  ? 'publish_property'
                  : 'view_properties';
              } else if (checkIntent.route.includes('tab=trips')) {
                intentKey = 'view_trips';
              } else if (checkIntent.route.includes('tab=swaps')) {
                intentKey = 'view_swaps';
              } else if (checkIntent.route.includes('messages')) {
                intentKey = 'view_messages';
              } else if (checkIntent.route.includes('profile')) {
                intentKey = 'edit_profile';
              }
              navigateToRoute(checkIntent.route, prompt, intentKey);
            }, 800);
          }

          setSimulatedStatus('talking');
          setChatHistory(prev => [...prev, { role: 'assistant', content: checkIntent.response, route: checkIntent.route }]);

          speak(checkIntent.response, () => {
            setSimulatedStatus('idle');
          });
          return;
        } else {
          const cancelMsg = language === 'es'
            ? 'Entendido. He cancelado la búsqueda actual. ¿En qué más te puedo ayudar?'
            : 'Understood. I have cancelled the current search. How else can I help you?';

          setThinkingContext('general');
          setChatHistory(prev => [...prev, { role: 'assistant', content: cancelMsg }]);
          setSimulatedStatus('talking');
          speak(cancelMsg, () => {
            setSimulatedStatus('idle');
          });
          return;
        }
      }

      // 2. Normal Flow handling
      // Use the pre-existing currentStep and memory variables

      if (currentStep === 'confirm') {
        const isConfirm = /\b(si|yes|correcto|confirmar|confirmo|de acuerdo|perfecto|ok|confirm|agree|correct)\b/i.test(cleanPrompt);
        const isReject = /\b(no|incorrecto|cambiar|modificar|corregir|modify|change|correct|edit)\b/i.test(cleanPrompt);

        if (isConfirm) {
          // Flow completed successfully!
          const searchMsg = language === 'es'
            ? 'Excelente. Buscando propiedades en el catálogo...'
            : 'Excellent. Searching properties in the catalog...';

          setThinkingContext('property_search');
          setChatHistory(prev => [...prev, { role: 'assistant', content: searchMsg }]);
          setSimulatedStatus('talking');

          const city = memory.city?.value || '';
          const promptHistory = chatHistory.filter(h => h.role === 'user').map(h => h.content).join(' ') + ' ' + prompt;
          const offeringMode = determineOfferingMode(memory, promptHistory);
          const operation = offeringMode === 'SALE' ? 'sale' : (offeringMode === 'RENT' ? 'rent' : undefined);
          const type = determinePropertyType(memory, promptHistory);
          const budgetVal = memory.budget?.value ? parseBudgetToNumber(memory.budget.value, operation || 'rent') : undefined;
          const roomsVal = memory.rooms?.value;

          const filters: PropertySearchFilters = {
            city,
            operation,
            budget: budgetVal,
            rooms: roomsVal,
          };
          if (type) {
            filters.type = type;
          }

          const sessionId = `session-${Date.now()}`;
          const sessionStart = Date.now();
          const providerName = ServiceFactory.getPropertyService().getCapabilities().supportsRealtime ? 'supabase' : 'mock';

          // Set activeSearch state to loading
          setActiveSearch({
            id: sessionId,
            origin: "eterna",
            filters,
            results: [],
            provider: providerName,
            createdAt: sessionStart,
            loading: true,
            error: null
          });

          // Run search asynchronously
          ServiceFactory.getPropertyService().search(filters)
            .then((searchResult) => {
              setActiveSearch({
                id: sessionId,
                origin: "eterna",
                filters: searchResult.filters,
                results: searchResult.results,
                provider: searchResult.provider,
                createdAt: sessionStart,
                loading: false,
                error: null
              });
            })
            .catch((err) => {
              searchLogger.error("[Eterna Concierge] Error performing activeSearch:", err);
              setActiveSearch({
                id: sessionId,
                origin: "eterna",
                filters,
                results: [],
                provider: providerName,
                createdAt: sessionStart,
                loading: false,
                error: err.message || 'Error searching properties'
              });
            });

          speak(searchMsg, () => {
            setSimulatedStatus('idle');
            
            const url = `/explore?search=${encodeURIComponent(city)}&offering=${offeringMode}`;
            
            setExploreFilters({
              category: 'All',
              offeringTab: offeringMode,
              query: city,
              guests: 0,
              swapType: 'All',
              sortBy: 'match',
            });

            setTimeout(() => {
              router.push(url);
              if (window.innerWidth < 768) {
                setIsCompact(true);
                setIsOpen(true);
              } else {
                setIsOpen(false);
              }
            }, 500);
          });

          const resetSession: ConversationSession = {
            activeIntent: ConversationIntent.NONE,
            status: ConversationStatus.IDLE,
            step: 'purpose',
            memory: {},
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          setConversationalSession(resetSession);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('eterna_conversation_session');
          }
          return;

        } else if (isReject) {
          // Check if they named a specific field to correct
          let fieldToClear: keyof ConversationMemory | null = null;
          if (/\b(presupuesto|budget|precio|dinero|price|costo|cost)\b/i.test(cleanPrompt)) {
            fieldToClear = 'budget';
          } else if (/\b(ciudad|city|lugar|zona|destino|destination)\b/i.test(cleanPrompt)) {
            fieldToClear = 'city';
          } else if (/\b(proposito|propósito|purpose|modo|inversion|vivir)\b/i.test(cleanPrompt)) {
            fieldToClear = 'purpose';
          } else if (/\b(habitacion|habitaciones|recamara|recamaras|cuarto|cuartos|rooms|bedrooms|room|bedroom)\b/i.test(cleanPrompt)) {
            fieldToClear = 'rooms';
          } else if (/\b(preferencia|preferencias|extras|alberca|jardin|piscina|pool|garden|preferences)\b/i.test(cleanPrompt)) {
            fieldToClear = 'preferences';
          }

          if (fieldToClear) {
            delete memory[fieldToClear];
            const nextStep = ConversationEngine.getNextStep(memory);
            const updatedSession: ConversationSession = {
              activeIntent: ConversationIntent.PROPERTY_SEARCH,
              status: ConversationStatus.COLLECTING,
              step: nextStep,
              memory,
              createdAt: conversationalSession.createdAt,
              updatedAt: Date.now()
            };
            setConversationalSession(updatedSession);
            if (typeof window !== 'undefined') {
              localStorage.setItem('eterna_conversation_session', JSON.stringify(updatedSession));
            }

            const question = await askStepOrConfirm(nextStep, memory, prompt);
            setThinkingContext('property_search');
            setChatHistory(prev => [...prev, { role: 'assistant', content: question }]);
            setSimulatedStatus('talking');
            speak(question, () => {
              setSimulatedStatus('idle');
            });
            return;
          } else {
            const askModify = language === 'es'
              ? '¿Qué dato deseas modificar? (propósito, ciudad, presupuesto, habitaciones o preferencias)'
              : 'Which field would you like to modify? (purpose, city, budget, rooms, or preferences)';

            setThinkingContext('property_search');
            setChatHistory(prev => [...prev, { role: 'assistant', content: askModify }]);
            setSimulatedStatus('talking');
            speak(askModify, () => {
              setSimulatedStatus('idle');
            });
            return;
          }
        } else {
          // Check if they are naming a field to modify in general response
          let fieldToClear: keyof ConversationMemory | null = null;
          if (/\b(presupuesto|budget|precio|dinero|price|costo|cost)\b/i.test(cleanPrompt)) {
            fieldToClear = 'budget';
          } else if (/\b(ciudad|city|lugar|zona|destino|destination)\b/i.test(cleanPrompt)) {
            fieldToClear = 'city';
          } else if (/\b(proposito|propósito|purpose|modo|inversion|vivir)\b/i.test(cleanPrompt)) {
            fieldToClear = 'purpose';
          } else if (/\b(habitacion|habitaciones|recamara|recamaras|cuarto|cuartos|rooms|bedrooms|room|bedroom)\b/i.test(cleanPrompt)) {
            fieldToClear = 'rooms';
          } else if (/\b(preferencia|preferencias|extras|alberca|jardin|piscina|pool|garden|preferences)\b/i.test(cleanPrompt)) {
            fieldToClear = 'preferences';
          }

          if (fieldToClear) {
            delete memory[fieldToClear];
            const nextStep = ConversationEngine.getNextStep(memory);
            const updatedSession: ConversationSession = {
              activeIntent: ConversationIntent.PROPERTY_SEARCH,
              status: ConversationStatus.COLLECTING,
              step: nextStep,
              memory,
              createdAt: conversationalSession.createdAt,
              updatedAt: Date.now()
            };
            setConversationalSession(updatedSession);
            if (typeof window !== 'undefined') {
              localStorage.setItem('eterna_conversation_session', JSON.stringify(updatedSession));
            }

            const question = await askStepOrConfirm(nextStep, memory, prompt);
            setThinkingContext('property_search');
            setChatHistory(prev => [...prev, { role: 'assistant', content: question }]);
            setSimulatedStatus('talking');
            speak(question, () => {
              setSimulatedStatus('idle');
            });
            return;
          } else {
            const confirmPrompt = language === 'es'
              ? 'Por favor, responde "Sí" para confirmar o dinos qué dato modificar.'
              : 'Please answer "Yes" to confirm or tell us what field to modify.';
            
            setThinkingContext('property_search');
            setChatHistory(prev => [...prev, { role: 'assistant', content: confirmPrompt }]);
            setSimulatedStatus('talking');
            speak(confirmPrompt, () => {
              setSimulatedStatus('idle');
            });
            return;
          }
        }
      }

      // Slot filling update
      let updatedMemory = ConversationEngine.parseAllEntities(prompt, memory, currentStep);
      // Extract other slots mentioned in prompt and merge
      const extraSlots = IntentClassifier.extractSlots(prompt);
      updatedMemory = IntentClassifier.mergeSlotsIntoMemory(updatedMemory, extraSlots);

      // If we have both city and budget in updatedMemory, run search and redirect immediately!
      if (updatedMemory.city && updatedMemory.budget) {
        await runSearchAndRedirect(updatedMemory, prompt);
        return;
      }

      // Determine next step from the shortened flow: purpose -> city -> budget
      let nextStep: ConversationStep = 'purpose';
      if (!updatedMemory.purpose) nextStep = 'purpose';
      else if (!updatedMemory.city) nextStep = 'city';
      else if (!updatedMemory.budget) nextStep = 'budget';

      const updatedSession: ConversationSession = {
        activeIntent: ConversationIntent.PROPERTY_SEARCH,
        status: ConversationStatus.COLLECTING,
        step: nextStep,
        memory: updatedMemory,
        createdAt: conversationalSession.createdAt,
        updatedAt: Date.now()
      };
      setConversationalSession(updatedSession);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eterna_conversation_session', JSON.stringify(updatedSession));
      }

      const question = await askStepOrConfirm(nextStep, updatedMemory, prompt);
      setThinkingContext('property_search');
      setChatHistory(prev => [...prev, { role: 'assistant', content: question }]);
      setSimulatedStatus('talking');
      speak(question, () => {
        setSimulatedStatus('idle');
      });
      return;
    }

    // Classify the user prompt using IntentClassifier
    const classification = IntentClassifier.classify(prompt);

    // Development logging for classification metrics
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IntentClassifier Metrics]
        Intent: ${classification.intent}
        Confidence: ${classification.confidence}
        Slots: ${JSON.stringify(classification.slots)}
        Time: ${classification.executionTimeMs}ms
        Reason: ${classification.decisionReason}`);
    }

    const isPropertySearch = ['BUY_PROPERTY', 'RENT_PROPERTY', 'SWAP_PROPERTY', 'SEARCH_PROPERTY'].includes(classification.intent);

    if (isPropertySearch) {
      if (classification.confidence < 0.60) {
        // Low confidence. Ask the clarifying question as requested.
        const clarifyMsg = language === 'es'
          ? '¿Quieres comprar, rentar o intercambiar una propiedad?'
          : 'Do you want to buy, rent or swap a property?';

        setThinkingContext('general');
        setChatHistory(prev => [...prev, { role: 'assistant', content: clarifyMsg }]);
        setSimulatedStatus('talking');
        speak(clarifyMsg, () => {
          setSimulatedStatus('idle');
        });
        return;
      }

      // Explicit transaction intent or high confidence search. Initiate flow.
      let initialMemory = ConversationEngine.parseAllEntities(prompt, {}, 'purpose');
      // Prefill slots extracted from the prompt
      initialMemory = IntentClassifier.mergeSlotsIntoMemory(initialMemory, classification.slots);

      // If we already have both city and budget, run search and redirect immediately!
      if (initialMemory.city && initialMemory.budget) {
        await runSearchAndRedirect(initialMemory, prompt);
        return;
      }

      // Determine next step from the shortened flow: purpose -> city -> budget
      let nextStep: ConversationStep = 'purpose';
      if (!initialMemory.purpose) nextStep = 'purpose';
      else if (!initialMemory.city) nextStep = 'city';
      else if (!initialMemory.budget) nextStep = 'budget';

      const newSession: ConversationSession = {
        activeIntent: ConversationIntent.PROPERTY_SEARCH,
        status: ConversationStatus.COLLECTING,
        step: nextStep,
        memory: initialMemory,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setConversationalSession(newSession);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eterna_conversation_session', JSON.stringify(newSession));
      }

      const question = await askStepOrConfirm(nextStep, initialMemory, prompt);
      setThinkingContext('property_search');
      setChatHistory(prev => [...prev, { role: 'assistant', content: question }]);
      setSimulatedStatus('talking');
      speak(question, () => {
        setSimulatedStatus('idle');
      });
      return;
    }

    if (classification.intent === 'SELL_PROPERTY' && classification.confidence >= 0.60) {
      const responseMsg = language === 'es'
        ? 'Te llevo al panel de tus propiedades para iniciar el proceso de publicación.'
        : 'Taking you to your properties panel to start the listing process.';

      setThinkingContext('publish_property');
      setChatHistory(prev => [...prev, { role: 'assistant', content: responseMsg }]);
      setSimulatedStatus('talking');
      speak(responseMsg, () => {
        setSimulatedStatus('idle');
        navigateToRoute('/dashboard?tab=properties', prompt, 'publish_property');
      });
      return;
    }

    if (classification.intent === 'PROPERTY_VALUATION' && classification.confidence >= 0.60) {
      const responseMsg = language === 'es'
        ? 'En AuraSwap te ayudamos a estimar el valor de tu propiedad analizando los precios del mercado en tu zona. Puedes ver los detalles en tu panel de control.'
        : 'At AuraSwap, we help you estimate your property value by analyzing market prices in your area. You can see the details in your dashboard.';

      setThinkingContext('property_detail');
      setChatHistory(prev => [...prev, { role: 'assistant', content: responseMsg }]);
      setSimulatedStatus('talking');
      speak(responseMsg, () => {
        setSimulatedStatus('idle');
      });
      return;
    }

    // ── STEP 1: Try Intent Router first ──
    console.log("[Eterna Voice Console] calling resolveIntent for prompt:", prompt);
    const intent = resolveIntent(prompt);
    console.log("[Eterna Voice Console] resolveIntent returned matched:", intent.matched, "action:", intent.action, "route:", intent.route, "response:", intent.response);

    if (intent.matched) {
      // If we are online, bypass local data queries so Groq Tool Calling handles them dynamically
      // Keep navigations instant!
      if (isConnected && intent.action === 'data_response') {
        console.log(`[Eterna] Bypassing local intent '${intent.route || 'data_query'}' to delegate to Groq Tool Calling.`);
      } else {
        console.log("[Eterna Audit] handleSend: Resolving locally with immediate response.");
        
        // Asignación de contexto para intenciones locales
        let context: ThinkingContext = 'navigation';
        if (intent.route) {
          const cleanPrompt = prompt.toLowerCase();
          if (intent.route.includes('tab=properties')) {
            const publishKeywords = [
              'publicar', 'crear', 'anuncio', 'list', 'add', 'vender', 'venta', 'anunciar', 'rentar', 'subir', 'sell', 'publish'
            ];
            context = publishKeywords.some(kw => cleanPrompt.includes(kw))
              ? 'publish_property'
              : 'property_detail';
          } else if (intent.route.includes('tab=swaps')) {
            context = 'swap';
          }
        } else if (intent.action === 'data_response') {
          // Si es una consulta de datos local como "mis propiedades" o "mis reseñas"
          const clean = prompt.toLowerCase();
          if (clean.includes('propiedad') || clean.includes('properties')) {
            context = 'property_detail';
          } else if (clean.includes('reseña') || clean.includes('review') || clean.includes('calificacion') || clean.includes('rating')) {
            context = 'property_detail';
          }
        }
        
        setThinkingContext(context);
        setSimulatedStatus('thinking');

        // Navigate if route exists
        if (intent.route) {
          console.log("[Eterna Audit] handleSend: Scheduling navigation to", intent.route);
          setTimeout(() => {
            let intentKey = 'view_dashboard';
            const cleanPrompt = prompt.toLowerCase();
            if (intent.route.includes('tab=properties')) {
              const publishKeywords = [
                'publicar', 'crear', 'anuncio', 'list', 'add', 'vender', 'venta', 'anunciar', 'rentar', 'subir', 'sell', 'publish'
              ];
              intentKey = publishKeywords.some(kw => cleanPrompt.includes(kw))
                ? 'publish_property'
                : 'view_properties';
            } else if (intent.route.includes('tab=trips')) {
              intentKey = 'view_trips';
            } else if (intent.route.includes('tab=swaps')) {
              intentKey = 'view_swaps';
            } else if (intent.route.includes('messages')) {
              intentKey = 'view_messages';
            } else if (intent.route.includes('profile')) {
              intentKey = 'edit_profile';
            }
            navigateToRoute(intent.route, prompt, intentKey);
          }, 800);
        }

        // Respond immediately with real data (BUG #3 double-bubble correction)
        setSimulatedStatus('talking');
        console.log("[Eterna Voice Console] intent matched response:", intent.response);
        setChatHistory(prev => [...prev, { role: 'assistant', content: intent.response, route: intent.route }]);

        speak(intent.response, () => {
          setSimulatedStatus('idle');
        });
        return;
      }
    }

    // ── STEP 2: Send to LLM (WebSocket or REST fallback) ──
    console.log("[Eterna Audit] handleSend: Devia to Step 2. isConnected =", isConnected);
    
    // Determine context dynamically
    const clean = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let fallbackContext: ThinkingContext = 'general';
    if (liveContext.property) {
      fallbackContext = 'property_detail';
    } else if (clean.includes('publicar') || clean.includes('anuncio') || clean.includes('publish') || clean.includes('listing')) {
      fallbackContext = 'publish_property';
    } else if (clean.includes('buscar') || clean.includes('propiedad') || clean.includes('search') || clean.includes('property')) {
      fallbackContext = 'property_search';
    } else if (clean.includes('intercambio') || clean.includes('swap')) {
      fallbackContext = 'swap';
    }
    
    setThinkingContext(fallbackContext);
    setSimulatedStatus('thinking');

    if (isConnected) {
      // Send to WebSocket server with Context Bridge and Secure User ID
      console.log("[Eterna Audit] handleSend: Routing to remote WebSocket backend.");
      sendMessage(prompt, [systemPrompt, ...chatHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }))], currentUser?.id);
    } else {
      // Gemini REST integration as intelligent fallback
      console.log("[Eterna REST Integration] Routing to Gemini API endpoint `/api/avatar`.");
      callGeminiAvatarAPI(prompt);
    }
  };

  // ────────────────────────────────────────────────
  // INTELLIGENT FALLBACK — Data-aware responses without backend
  // ────────────────────────────────────────────────

  // Scroll visibility and custom event triggers for the hybrid Eterna experience
  const [showOrb] = useState(true);
  const [isDiscrete, setIsDiscrete] = useState(false);

  useEffect(() => {


    if (pathname !== '/') {
      setTimeout(() => setIsDiscrete(false), 0);
      return;
    }

    const handleScroll = () => {
      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
      const threshold = isMobileScreen ? 350 : 200;
      setIsDiscrete(window.scrollY <= threshold);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [pathname]);

  // Dispatch active status to global custom events (e.g. for Home page Hero avatar synchronization)
  useEffect(() => {
    const event = new CustomEvent('eterna-status', { detail: activeStatus });
    window.dispatchEvent(event);

    // Also listen to query requests to immediately dispatch status
    const handleQuery = () => {
      window.dispatchEvent(new CustomEvent('eterna-status', { detail: activeStatus }));
    };
    window.addEventListener('eterna-query-status', handleQuery);
    return () => window.removeEventListener('eterna-query-status', handleQuery);
  }, [activeStatus]);

  // Dispatch active listening status for Eterna sync (e.g. for Home page Hero)
  useEffect(() => {
    const event = new CustomEvent('eterna-listening', { detail: isListening });
    window.dispatchEvent(event);
  }, [isListening]);

  // Listen to remote events to trigger messages or open Eterna Concierge card
  useEffect(() => {
    const handleSendMsg = (e: Event) => {
      const text = (e as CustomEvent).detail;
      handleSend(text);
    };
    const handleOpenCard = () => {
      setIsOpen(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && pathname?.startsWith('/property/')) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
      setShowTooltip(false);
    };
    const handleCancelSpeech = () => {
      console.log('[VOICE FIX] wizard close interrupt only');
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSimulatedStatus('idle');
      if (isConnected) {
        interrupt();
      }
      interruptVoice();
      console.log('[VOICE FIX] voiceMode preserved:', voiceMode);
      console.log('[VOICE FIX] returned to listening');
    };

    window.addEventListener('eterna-send', handleSendMsg);
    window.addEventListener('eterna-open', handleOpenCard);
    window.addEventListener('eterna-cancel-speech', handleCancelSpeech);

    return () => {
      window.removeEventListener('eterna-send', handleSendMsg);
      window.removeEventListener('eterna-open', handleOpenCard);
      window.removeEventListener('eterna-cancel-speech', handleCancelSpeech);
    };
  }, [handleSend, isConnected, interrupt, stopVoiceMode, interruptVoice, voiceMode]);

  // Synchronize local states to LiveContext (Theme/Chat sync)
  useEffect(() => {
    setEternaChatState({
      isOpen,
      isListening,
      status: activeStatus,
      chatHistory
    });
  }, [isOpen, isListening, activeStatus, chatHistory, setEternaChatState]);

  // Automatic welcome greeting presentation flow (Phase 6)
  useEffect(() => {
    if (pathname !== '/') return;

    // Check if introduction was already presented in this session
    if (typeof window !== 'undefined') {
      const introDone = sessionStorage.getItem('eterna_intro_done');
      if (introDone) return;
    }

    // Only present if chat log is empty
    if (chatHistory.length > 0) return;

    let safetyTimer: NodeJS.Timeout;

    const timer = setTimeout(() => {
      // Re-verify in case user interacted during the delay
      if (chatHistoryRef.current.length > 0) return;

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('eterna_intro_done', 'true');
      }

      const part1 = language === 'es'
        ? "¡Hola! Soy Eterna y estoy aquí para ayudarte a encontrar la propiedad que buscas."
        : "Hello! I'm Eterna, and I'm here to help you find the property you need.";
      const part2 = language === 'es'
        ? "A un lado tienes las consultas más frecuentes, o bien, puedes hacer clic en mí en cualquier momento para decirme directamente lo que necesitas."
        : "Nearby are the most common queries, or you can click on me at any time to tell me directly what you need.";

      const welcomeMsg = part1 + " " + part2;

      // Add to chat history
      setChatHistory(prev => {
        if (prev.some(msg => msg.content === welcomeMsg)) return prev;
        return [...prev, { role: 'assistant', content: welcomeMsg }];
      });

      setSimulatedStatus('talking');

      // Speak Part 1 first
      speak(part1, () => {
        // Highlight action cards exactly when Part 2 starts
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: true }));
        }

        // Speak Part 2
        speak(part2, () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
          }
          setSimulatedStatus('idle');
        });

        // Safety timeout to disable highlight after 8 seconds in case speech fails to end
        safetyTimer = setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
          }
        }, 8000);
      });

    }, 3500); // 3.5 seconds delay after load

    return () => {
      clearTimeout(timer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [pathname, language, speak, setChatHistory, setSimulatedStatus]);

  // Execute commands from LiveContext (Home Experience Context actions)
  useEffect(() => {
    if (!eternaCommand) return;
    const { type, payload } = eternaCommand;

    if (type === 'open') {
      setIsOpen(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && shouldBeCompactOnMobile) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
      if (payload) {
        handleSend(payload);
      }
    } else if (type === 'close') {
      setIsOpen(false);
    } else if (type === 'startVoice') {
      setIsOpen(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && shouldBeCompactOnMobile) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
      if (voiceMode) {
        stopVoiceMode();
      } else {
        handleVoiceButtonClick();
      }
    } else if (type === 'send') {
      if (isHome || conciergeMode === 'avatar') {
        if (!voiceMode) {
          handleVoiceButtonClick();
        }
      }
      handleSend(payload);
      setIsOpen(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && shouldBeCompactOnMobile) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
    }

    clearEternaCommand();
  }, [eternaCommand, voiceMode, handleVoiceButtonClick, handleSend, clearEternaCommand, shouldBeCompactOnMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.changedTouches[0].clientY;
    const diffY = touchStartY.current - currentY; // positive = up, negative = down

    if (diffY > 40) {
      setIsCompact(false);
    } else if (diffY < -40) {
      setIsCompact(true);
    }

    touchStartY.current = null;
  };

  return (
    <>
      {/* A. SCROLL-AWARE PREMIUM FLOATING ORB */}
      <AnimatePresence>
        {showOrb && !isOpen && !isHome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ 
              opacity: isDiscrete ? 0.4 : 1, 
              scale: isDiscrete ? 0.5 : 1, 
              y: 0 
            }}
            whileHover={{
              opacity: isDiscrete ? 0.85 : 1,
              scale: isDiscrete ? 0.65 : 1.05
            }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed bottom-6 right-6 z-40 flex items-center origin-bottom-right"
          >
            {/* Tooltip on idle/hover: Eterna luxury speech bubble */}
            <AnimatePresence>
              {showTooltip && !isDiscrete && (
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  className="absolute right-[84px] bottom-1 px-4 py-3 bg-slate-950/90 text-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 text-xs font-semibold whitespace-nowrap backdrop-blur-md flex flex-col gap-1 z-30 select-none pointer-events-none"
                >
                  <span className="text-[11px] font-bold text-white leading-none">
                    {language === 'es' 
                      ? `¡Hola, ${currentUser?.name ? currentUser.name.split(' ')[0] : 'Viajero'}! 👋` 
                      : `Hi, ${currentUser?.name ? currentUser.name.split(' ')[0] : 'Traveler'}! 👋`}
                  </span>
                  <span className="text-[10px] text-white/60 font-semibold leading-none">
                    {language === 'es' ? '¿En qué puedo ayudarte?' : 'How can I help you?'}
                  </span>
                  
                  {/* Glass triangle pointer pointing right to the Orb */}
                  <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-slate-950/90" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice Mode Toggle Button (Closed Orb view) */}
            <button
              type="button"
              onClick={handleVoiceButtonClick}
              className={`mr-3 px-3.5 py-2.5 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 shadow-premium text-white active:scale-95 cursor-pointer ${
                voiceMode
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {voiceMode ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Mutear</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Hablar</span>
                </>
              )}
            </button>

            {/* Real-time speech transcription bubble */}
            {isListening && partialTranscript && (
              <div className="absolute bottom-[80px] right-[84px] bg-slate-950/95 text-white border border-white/10 px-4 py-2.5 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-[11px] font-semibold max-w-[220px] leading-normal animate-in fade-in slide-in-from-bottom-2 select-none pointer-events-none whitespace-normal break-words text-right z-30">
                <div className="text-[8px] font-black text-brand-accent uppercase tracking-wider mb-0.5">
                  {language === 'es' ? 'Te estoy escuchando...' : 'Listening to you...'}
                </div>
                <span className="italic text-white/90">&ldquo;{partialTranscript}&rdquo;</span>
              </div>
            )}

            {/* Glowing Orb Container */}
            <button
              onClick={() => {
                setIsOpen(true);
                setShowTooltip(false);
              }}
              className="hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer relative select-none flex flex-col items-center gap-1"
            >
              {/* Mini VideoAvatar representing Eterna inside the Orb */}
              <VideoAvatar 
                status={activeStatus} 
                size={60} 
                hidePill={true} 
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* B. PERSISTENT FLOATING DRAWER */}
      <AnimatePresence>
        {isOpen && !isHome && (
          <div className="fixed inset-x-0 bottom-0 md:bottom-6 md:right-6 md:left-auto z-50 flex flex-col items-end pointer-events-none">
            <motion.div
              initial={{ y: '100%', opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`relative z-10 w-full md:w-[380px] border backdrop-blur-xl flex flex-col justify-between overflow-hidden pointer-events-auto md:mr-6 md:mb-0 transition-all duration-300 rounded-[32px] ${
                conciergeMode === 'avatar'
                  ? 'bg-slate-950 border-transparent shadow-[0_20px_60px_rgba(0,0,0,0.3)] text-white p-[3.2px] cursor-pointer'
                  : 'bg-white/95 border-brand-gray-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.12)] text-brand-black'
              } ${
                isCompact ? 'h-[150px]' : 'h-[85vh] md:h-[580px]'
              } ${
                conciergeMode === 'avatar' && activeStatus === 'thinking' ? 'animate-border-glow-pulse' :
                conciergeMode === 'avatar' && activeStatus === 'talking' ? 'animate-border-glow-breath' : ''
              }`}
              style={
                conciergeMode === 'avatar'
                  ? {
                      borderColor:
                        isListening ? '#3B82F6' :
                        activeStatus === 'thinking' ? '#8B5CF6' :
                        activeStatus === 'talking' ? '#22C55E' :
                        'rgba(120, 170, 255, 0.25)',
                      boxShadow:
                        isListening ? '0 0 55px rgba(59, 130, 246, 0.35)' :
                        activeStatus === 'thinking' ? '0 0 55px rgba(139, 92, 246, 0.35)' :
                        activeStatus === 'talking' ? '0 0 65px rgba(34, 197, 94, 0.45)' :
                        '0 0 25px rgba(120, 170, 255, 0.12)'
                    }
                  : {}
              }
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle for mobile compact drawer expansion (Uber/Apple Maps style) */}
              <div 
                className="absolute top-0 inset-x-0 h-5 z-40 flex md:hidden items-center justify-center cursor-pointer select-none active:scale-98 pointer-events-auto"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={() => setIsCompact(!isCompact)}
              >
                <div className={`w-12 h-1 rounded-full mt-1.5 transition-colors ${conciergeMode === 'avatar' ? 'bg-white/30' : 'bg-brand-gray-300/70'}`} />
              </div>

              {conciergeMode === 'avatar' ? (
                /* MODALIDAD AVATAR */
                <div 
                  onClick={handleVoiceButtonClick}
                  className="relative w-full h-full rounded-[28px] overflow-hidden bg-slate-950 flex flex-col justify-between"
                >
                  {/* Main Video Element */}
                  <video
                    ref={conciergeVideoRef}
                    src={conciergeSrc}
                    muted
                    playsInline
                    autoPlay
                    loop={activeStatus !== 'talking'}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200 z-10"
                    style={{ 
                       opacity: conciergeOpacity,
                       objectPosition: "center 15%"
                    }}
                  />

                  {/* Header Overlay */}
                  <div className={`absolute top-0 left-0 w-full z-30 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent text-white rounded-t-[28px] pointer-events-none select-none ${isCompact ? 'p-2 pt-5' : 'p-4 pt-7'}`}>
                    <div className="flex items-center gap-2.5 pointer-events-auto">
                      <div className="flex flex-col text-left">
                        <h3 className={`font-extrabold flex items-center gap-1 text-white ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                          <span>Eterna Concierge</span>
                          <Sparkles className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-brand-accent animate-pulse`} />
                        </h3>
                        <p className={`text-brand-accent font-extrabold uppercase tracking-wider mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>
                          {isListening ? (language === 'es' ? '● Escuchando...' : '● Listening...') :
                           activeStatus === 'thinking' ? `● ${getThinkingMessage()}` :
                           activeStatus === 'talking' ? (language === 'es' ? '● Respondiendo...' : '● Responding...') :
                           voiceMode ? (language === 'es' ? '● Escuchando...' : '● Listening...') :
                           (language === 'es' ? '● Micrófono desactivado' : '● Microphone disabled')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      {/* Mute Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMuted(!isMuted);
                        }}
                        className={`text-white/70 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
                        title={isMuted ? 'Activar sonido' : 'Silenciar'}
                      >
                        {isMuted ? <VolumeX className={isCompact ? 'w-3 h-3 text-brand-rose' : 'w-3.5 h-3.5 text-brand-rose'} /> : <Volume2 className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
                      </button>

                      {/* Close button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                        }}
                        className={`text-white/70 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
                      >
                        <X className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                      </button>
                    </div>
                  </div>

                  {/* Centered Glassmorphic Helper Tooltip */}
                  {!isListening && activeStatus === 'idle' && !isCompact && (
                    <div className="absolute bottom-[35%] left-1/2 z-30 pointer-events-none select-none flex flex-col items-center animate-bounce-gentle w-full max-w-[90%]">
                      <div className="p-[1.2px] rounded-full animate-rainbow-border shadow-floating">
                        <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-1.5 md:gap-2 transition-all duration-300">
                          <Mic className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-500 animate-pulse" />
                          <span className="text-[10px] md:text-[11px] font-bold tracking-wide text-zinc-800 dark:text-zinc-200 text-center whitespace-nowrap">
                            Haz clic para decirme qué necesitas
                          </span>
                        </div>
                      </div>
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white/95 dark:bg-zinc-950/95 border-r border-b border-zinc-200/50 dark:border-white/10 rotate-45 -mt-1 md:-mt-1.5 shadow-xs" />
                    </div>
                  )}

                  {/* Floating CHAT button at the bottom center */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConciergeMode('chat');
                    }}
                    className={`absolute left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 text-brand-black dark:text-white rounded-full font-bold uppercase tracking-wider shadow-floating border border-zinc-200/50 dark:border-white/10 flex items-center hover:scale-105 active:scale-95 transition-all cursor-pointer z-30 pointer-events-auto ${
                      isCompact ? 'bottom-2.5 px-3.5 py-1.5 text-[9px] gap-1' : 'bottom-6 px-5 py-2.5 text-xs gap-1.5'
                    }`}
                  >
                    <MessageSquare className={isCompact ? 'w-3 h-3 text-brand-accent' : 'w-3.5 h-3.5 text-brand-accent'} />
                    <span>Chat</span>
                  </button>
                </div>
              ) : (
                /* MODALIDAD CHAT TRADICIONAL */
                <>
                  {/* Card Glassmorphic Header */}
                  <div className={`p-4 border-b flex items-center justify-between transition-colors ${
                    isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-brand-gray-50/50'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {/* Micro circular VideoAvatar in header */}
                      {!isHome && (
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-gray-200 bg-slate-950 flex items-center justify-center">
                          <VideoAvatar status={activeStatus} size={36} hidePill={true} hideGlow={true} isListening={isListening} />
                        </div>
                      )}
                      <div>
                        <h3 className={`text-xs font-extrabold flex items-center gap-1 ${
                          isHome ? 'text-white' : 'text-brand-black'
                        }`}>
                          <span>Eterna Concierge</span>
                          <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                        </h3>
                        <p className="text-[8px] text-brand-accent font-extrabold uppercase tracking-wider">
                          {isListening ? (language === 'es' ? '● Escuchando...' : '● Listening...') :
                           activeStatus === 'thinking' ? `● ${getThinkingMessage()}` :
                           activeStatus === 'talking' ? (language === 'es' ? '● Respondiendo...' : '● Responding...') :
                           voiceMode ? (language === 'es' ? '● Escuchando...' : '● Listening...') :
                           (language === 'es' ? '● Micrófono desactivado' : '● Microphone disabled')}
                        </p>
                        {voiceState !== 'disabled' && (
                          <p className="text-[8px] text-brand-gray-500 font-semibold tracking-wide mt-0.5">
                            {language === 'es' ? `Contexto: ${getConversationContextLabel()}` : `Context: ${getConversationContextLabel()}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Avatar Toggle Button */}
                      <button
                        onClick={() => setConciergeMode('avatar')}
                        className="px-2.5 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[9px] font-extrabold uppercase tracking-wider hover:bg-brand-accent/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                        title="Ver Avatar"
                      >
                        <User className="w-3 h-3" />
                        <span>Avatar</span>
                      </button>

                      {/* Mute Button */}
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-1.5 text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 rounded-full cursor-pointer transition-colors"
                        title={isMuted ? 'Activar sonido' : 'Silenciar'}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-brand-rose" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      {/* Close button */}
                      <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 rounded-full cursor-pointer transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chat Dialog Scroll Area */}
                  {(() => {
                    const messagesToRender = isCompact && chatHistory.length > 0 
                      ? [chatHistory[chatHistory.length - 1]] 
                      : chatHistory;
                    return (
                      <div className={`flex-1 overflow-y-auto flex flex-col scroll-smooth scrollbar-thin scrollbar-thumb-brand-gray-200 scrollbar-track-transparent transition-all duration-300 ${
                        isHome ? 'bg-transparent' : 'bg-white/20'
                      } ${
                        isCompact ? 'p-2 py-1 gap-1.5' : 'p-4 gap-3'
                      }`}>
                        {messagesToRender.length === 0 ? (
                          <div className={`flex flex-col items-center justify-center text-center ${
                            isHome ? 'text-white' : 'text-brand-gray-400'
                          } ${
                            isCompact ? 'p-1 h-[40px]' : 'p-6 h-full'
                          }`}>
                            <HelpCircle className={`${isHome ? 'text-white/40' : 'text-brand-gray-300'} ${isCompact ? 'hidden' : 'w-8 h-8 mb-3'}`} />
                            <p className={`text-xs font-extrabold ${isHome ? 'text-white' : 'text-brand-black'}`}>{t('messages.eternaGreeting', { name: currentUser?.name ? currentUser.name.split(' ')[0] : 'Viajero' })}</p>
                            {!isCompact && (
                              <p className={`text-[10px] leading-relaxed mt-1 max-w-[220px] ${isHome ? 'text-white/60' : 'text-brand-gray-400'}`}>
                                {t('messages.eternaGreetingDesc')}
                              </p>
                            )}
                          </div>
                        ) : (
                          messagesToRender.map((msg, index) => (
                            <div
                              key={index}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                            >
                              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed font-semibold ${
                                msg.role === 'user'
                                  ? 'bg-brand-accent text-white rounded-tr-none shadow-md'
                                  : isHome
                                  ? 'bg-white/10 border border-white/5 text-white rounded-tl-none shadow-sm'
                                  : 'bg-brand-gray-50 border border-brand-gray-100 text-brand-black rounded-tl-none shadow-sm'
                              }`}>
                                <span className={`text-[8px] uppercase tracking-wider block mb-0.5 font-black ${
                                  msg.role === 'user' ? 'text-indigo-200' : 'text-brand-accent'
                                }`}>
                                  {msg.role === 'user' ? t('messages.typing') : 'Eterna IA'}
                                </span>
                                <p className="whitespace-pre-line">{msg.content}</p>
                                {msg.route && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      let intentKey = 'view_dashboard';
                                      if (msg.route!.includes('tab=properties')) {
                                        intentKey = 'view_properties';
                                      } else if (msg.route!.includes('tab=trips')) {
                                        intentKey = 'view_trips';
                                      } else if (msg.route!.includes('tab=swaps')) {
                                        intentKey = 'view_swaps';
                                      } else if (msg.route!.includes('messages')) {
                                        intentKey = 'view_messages';
                                      } else if (msg.route!.includes('profile')) {
                                        intentKey = 'edit_profile';
                                      }
                                      navigateToRoute(msg.route!, msg.content, intentKey);
                                    }}
                                    className="mt-2 w-full inline-flex items-center justify-between px-3 py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold tracking-wide hover:bg-brand-accent/90 transition-all shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                                  >
                                    <span>{
                                      msg.route!.includes('tab=properties') 
                                        ? (language === 'es' ? 'Ir a mis propiedades' : 'Go to my properties')
                                        : msg.route!.includes('tab=trips')
                                        ? (language === 'es' ? 'Ir a mis viajes' : 'Go to my trips')
                                        : msg.route!.includes('tab=swaps')
                                        ? (language === 'es' ? 'Ir a intercambios' : 'Go to swaps')
                                        : msg.route!.includes('messages')
                                        ? (language === 'es' ? 'Ir a mensajes' : 'Go to messages')
                                        : msg.route!.includes('profile')
                                        ? (language === 'es' ? 'Ir a mi perfil' : 'Go to profile')
                                        : (language === 'es' ? 'Ver resultados' : 'View results')
                                    }</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {msg.showAuthButtons && (
                                  <div className="mt-3 flex gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push('/login?tab=login');
                                        setIsOpen(false);
                                      }}
                                      className="flex-grow py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold text-center hover:bg-brand-accent/90 transition-all cursor-pointer shadow-xs"
                                    >
                                      {language === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push('/login?tab=register');
                                        setIsOpen(false);
                                      }}
                                      className="flex-grow py-2 rounded-xl border border-brand-gray-200 bg-white text-brand-black text-[10px] font-extrabold text-center hover:bg-brand-gray-50 transition-all cursor-pointer shadow-xs"
                                    >
                                      {language === 'es' ? 'Crear Cuenta' : 'Register'}
                                    </button>
                                  </div>
                                )}
                                {msg.showPublishButton && (
                                  <div className="mt-3 w-full animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.dispatchEvent(new CustomEvent('open-property-wizard'));
                                      }}
                                      className="w-full py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold text-center hover:bg-brand-accent/90 transition-all cursor-pointer shadow-xs"
                                    >
                                      {language === 'es' ? 'Publicar Propiedad' : 'List Property'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Real-time WebSockets chunk transcription */}
                        {isConnected && textResponse && wsStatus === 'talking' && (
                          <div className="flex justify-start animate-pulse">
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed font-semibold rounded-tl-none shadow-sm ${
                              isHome
                                ? 'bg-white/10 border border-white/5 text-white'
                                : 'bg-brand-gray-50 border border-brand-gray-100 text-brand-black'
                            }`}>
                              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                                {t('messages.eternaTalking')}
                              </span>
                              <p className="whitespace-pre-line">{textResponse}</p>
                            </div>
                          </div>
                        )}

                        {/* Real-time simulation text */}
                        {!isConnected && simulatedText && simulatedStatus === 'talking' && (
                          <div className="flex justify-start">
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed font-semibold rounded-tl-none shadow-sm ${
                              isHome
                                ? 'bg-white/10 border border-white/5 text-white'
                                : 'bg-brand-gray-50 border border-brand-gray-100 text-brand-black'
                            }`}>
                              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                                Eterna IA
                              </span>
                              <p className="whitespace-pre-line">{simulatedText}</p>
                            </div>
                          </div>
                        )}

                        {/* Thinking bubble indicator */}
                        {activeStatus === 'thinking' && (
                          <div className="flex justify-start">
                            <div className={`rounded-2xl px-3.5 py-2 flex items-center gap-1 shadow-xs ${
                              isHome ? 'bg-white/10 border border-white/5' : 'bg-brand-gray-50 border border-brand-gray-100'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" />
                            </div>
                          </div>
                        )}

                        {/* Real-time speech transcription inside chat */}
                        {isListening && partialTranscript && (
                          <div className="flex justify-end animate-pulse">
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed font-semibold rounded-tr-none shadow-sm ${
                              isHome
                                ? 'bg-white/5 border border-white/5 text-white/90'
                                : 'bg-brand-accent/5 border border-brand-accent/15 text-brand-black'
                            }`}>
                              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                                {language === 'es' ? 'Te estoy escuchando...' : 'Listening to you...'}
                              </span>
                              <p className="italic text-brand-black/80">&ldquo;{partialTranscript}&rdquo;</p>
                            </div>
                          </div>
                        )}
                        
                        <div ref={textEndRef} />
                      </div>
                    );
                  })()}

                  {/* Píldoras / Contextual Suggestions (Carrusel horizontal móvil & Wrapping desktop) */}
                  {chatHistory.length === 0 && !isCompact && (
                    <div className={`p-3 border-t transition-colors ${
                      isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-brand-gray-50/20'
                    }`}>
                      {/* Sliding Container */}
                      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none px-1 py-1 select-none max-w-full md:flex-wrap md:justify-center scroll-smooth">
                        <button
                          onClick={() => handleSend(t('messages.howWorksPrompt'))}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                            isHome
                              ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                              : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
                          }`}
                        >
                          {t('messages.questionHowWorks')}
                        </button>
                        <button
                          onClick={() => handleSend(t('messages.beachVillaPrompt'))}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                            isHome
                              ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                              : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
                          }`}
                        >
                          {t('messages.questionBeachVilla')}
                        </button>
                        <button
                          onClick={() => handleSend(t('messages.feesInsurancePrompt'))}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                            isHome
                              ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                              : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
                          }`}
                        >
                          {t('messages.questionInsurance')}
                        </button>
                        <button
                          onClick={() => handleSend(language === 'es' ? 'Llévame a mis mensajes' : 'Take me to my messages')}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1 ${
                            isHome
                              ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                              : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
                          }`}
                        >
                          <Navigation className="w-3 h-3" />
                          <span>{language === 'es' ? 'Mis Mensajes' : 'My Messages'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Text / Microphone input bar */}
                  <div className={`border-t transition-colors duration-300 ${
                    isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-brand-gray-50/40'
                  } ${
                    isCompact ? 'p-1.5' : 'p-4'
                  }`}>
                    <div className="flex gap-1.5 items-center">
                      <div className={`flex-grow flex border focus-within:border-brand-accent/50 transition-all items-center rounded-2xl ${
                        isHome ? 'bg-white/5 border-white/10' : 'bg-white border-brand-gray-200'
                      } ${
                        isCompact ? 'p-0.5' : 'p-1.5'
                      }`}>
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder={isListening ? t('messages.listeningVoice') : t('messages.askEternaPlaceholder')}
                          value={typedInput}
                          onChange={(e) => setTypedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setSimulatedStatus('thinking');
                              handleSend();
                            }
                          }}
                          disabled={isListening}
                          className={`flex-grow pl-2.5 outline-none text-xs font-semibold bg-transparent placeholder-brand-gray-400 ${
                            isHome ? 'text-white placeholder-white/30' : 'text-brand-black placeholder-brand-gray-400'
                          } ${
                            isCompact ? 'py-1' : 'py-1.5'
                          }`}
                        />

                        {/* Microphone Toggle */}
                        {speechRecognitionSupported && (
                          <button
                            onClick={handleVoiceButtonClick}
                            className={`transition-all cursor-pointer shrink-0 ${
                              isCompact ? 'p-1 rounded-lg' : 'p-2 rounded-xl'
                            } ${
                              isListening
                                ? 'bg-brand-rose text-white animate-pulse'
                                : isHome
                                ? 'text-white/60 hover:text-white hover:bg-white/10'
                                : 'text-brand-gray-400 hover:text-brand-black hover:bg-brand-gray-100'
                            }`}
                            title={isListening ? 'Detener dictado' : t('messages.talkMic')}
                          >
                            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {/* Voice Mode Toggle Button (Expanded Chat view) */}
                      <button
                        type="button"
                        onClick={handleVoiceButtonClick}
                        className={`px-4 py-2.5 rounded-xl font-extrabold text-[10px] tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 shadow-sm text-white active:scale-95 cursor-pointer shrink-0 ${
                          voiceMode
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                        }`}
                      >
                        {voiceMode ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            <span>Mutear</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>Hablar</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setSimulatedStatus('thinking');
                          handleSend();
                        }}
                        disabled={!typedInput.trim() && activeStatus !== 'talking'}
                        title={activeStatus === 'talking' && !typedInput.trim() ? "Interrumpir" : undefined}
                        className={`transition-all shadow-sm shrink-0 cursor-pointer ${
                          isCompact ? 'p-2 rounded-xl' : 'p-3 rounded-2xl'
                        } ${
                          typedInput.trim()
                            ? 'bg-brand-accent text-white hover:scale-105 active:scale-95'
                            : activeStatus === 'talking'
                            ? (isHome ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-brand-gray-100 text-brand-gray-600 hover:bg-brand-gray-200 hover:scale-105 active:scale-95')
                            : (isHome ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-brand-gray-100 text-brand-gray-300 cursor-not-allowed')
                        }`}
                      >
                        {activeStatus === 'talking' && !typedInput.trim() ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styles for dynamic tooltip bounce animations */}
      <style jsx global>{`
        @keyframes bounce-gentle {
          0%, 100% {
            transform: translate(-50%, 0);
          }
          50% {
            transform: translate(-50%, -6px);
          }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 3s infinite ease-in-out;
        }
      `}</style>
    </>
  );
}
