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
import { formatCount, formatPropertyLocation, formatSentencePart } from '../lib/textHelpers';
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
import { generatePropertySummary } from '../lib/eterna/actions/PropertyActions';
import { EternaChatMessage } from '../lib/eterna/propertySales';
import { PageAgentResponse, parsePageAgentResponse } from '../lib/eterna/pageAgent';
import {
  captureEternaPageSnapshot,
  executeSemanticPageAction,
} from '../lib/eterna/pageActions';
import {
  mergeSearchAnalysisIntoMemory,
  parseSearchConciergeResponse,
  SearchConciergeResponse,
} from '../lib/eterna/searchConcierge';
import { planFastPropertySearch } from '../lib/eterna/fastSearchPlanner';
import { useSearchActions } from '../lib/eterna/actions/SearchActions';
import { useNavigationActions } from '../lib/eterna/actions/NavigationActions';
import { useGeneralActions } from '../lib/eterna/actions/GeneralActions';
import { Property } from '../lib/types';
import { ServiceFactory } from '../lib/services/ServiceFactory';
import { parseBudgetToNumber, parseBudgetRange } from '../lib/search/SearchEngine';
import { PropertySearchFilters } from '../lib/search/types';
import { searchLogger } from '../lib/search/searchLogger';
import { DoubleBufferVideoPlayer } from './DoubleBufferVideoPlayer';
import { EternaPropertyActions } from './eterna/EternaPropertyActions';
import { AvatarStateName } from '../lib/eternaAssets';
// ────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────

import { useEternaVoice } from '../hooks/useEternaVoice';
import { useThinkingContext } from '../hooks/useThinkingContext';

type ThinkingContext = 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general';

const ETERNA_CHAT_SESSION_KEY = 'eterna_chat_history_v4';
const ETERNA_CONVERSATION_SESSION_KEY = 'eterna_conversation_session_v2';
const ETERNA_HOME_INTRO_SESSION_KEY = 'eterna_home_intro_v4';
const ETERNA_SESSION_TTL_MS = 30 * 60 * 1000;
const LEGACY_ETERNA_LOCAL_KEYS = ['eterna_chat_history_v3', 'eterna_conversation_session'] as const;

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
  const [isHydrated, setIsHydrated] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [chatHistory, setChatHistory] = useState<EternaChatMessage[]>([]);
  const chatHistoryRestoredRef = useRef(false);
  const [geminiActive, setGeminiActive] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auraswap_gemini_active') !== 'false';
    }
    return true;
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    try {
      LEGACY_ETERNA_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
      const stored = sessionStorage.getItem(ETERNA_CHAT_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { updatedAt?: number; messages?: EternaChatMessage[] };
        if (
          parsed.updatedAt
          && Date.now() - parsed.updatedAt < ETERNA_SESSION_TTL_MS
          && Array.isArray(parsed.messages)
        ) {
          setChatHistory(parsed.messages.slice(-30));
        } else {
          sessionStorage.removeItem(ETERNA_CHAT_SESSION_KEY);
        }
      }
    } catch (error) {
      console.warn('[Eterna] No fue posible restaurar la conversación.', error);
      sessionStorage.removeItem(ETERNA_CHAT_SESSION_KEY);
    } finally {
      chatHistoryRestoredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!chatHistoryRestoredRef.current) return;
    sessionStorage.setItem(ETERNA_CHAT_SESSION_KEY, JSON.stringify({
      updatedAt: Date.now(),
      messages: chatHistory.slice(-30),
    }));
  }, [chatHistory]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.active === 'boolean') {
        setGeminiActive(detail.active);
      }
    };
    window.addEventListener('auraswap:gemini-active-changed', handleEvent);
    return () => window.removeEventListener('auraswap:gemini-active-changed', handleEvent);
  }, []);
  
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
    step: 'operation',
    memory: {},
    createdAt: 0,
    updatedAt: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(ETERNA_CONVERSATION_SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && Date.now() - parsed.updatedAt < ETERNA_SESSION_TTL_MS) {
            setConversationalSession(parsed);
          } else {
            sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
          }
        } catch (e) {
          console.warn("[Eterna] Failed to parse conversational session:", e);
          sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
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
  const homeSearchAbortControllerRef = useRef<AbortController | null>(null);
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
    isConnected: isConnected && !geminiActive,
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

  const [micPermissionDeniedOpen, setMicPermissionDeniedOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const checkMicPermission = useCallback(async (): Promise<'granted' | 'prompt' | 'denied'> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return 'prompt';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as any });
          if (result.state === 'granted') return 'granted';
          if (result.state === 'denied') return 'denied';
          return 'prompt';
        } catch (e) {
          // Fallback if query for "microphone" rejects
        }
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = devices.some(device => device.kind === 'audioinput' && device.label !== '');
      if (hasLabels) return 'granted';
      return 'prompt';
    } catch (error) {
      return 'prompt';
    }
  }, []);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: any) {
      console.warn("Microphone access denied:", err);
      return false;
    }
  }, []);

  const handleMicButtonClickWithPermission = useCallback(async () => {
    addDebugLog("[PERMISSION] handleMicButtonClickWithPermission triggered");
    if (voiceMode) {
      addDebugLog("[PERMISSION] voiceMode is active (muting), bypassing check");
      handleVoiceButtonClick();
      return;
    }
    const permission = await checkMicPermission();
    addDebugLog(`[PERMISSION] checked state: ${permission}`);
    if (permission === 'granted') {
      handleVoiceButtonClick();
    } else if (permission === 'prompt') {
      const allowed = await requestMicPermission();
      if (allowed) {
        handleVoiceButtonClick();
      } else {
        setMicPermissionDeniedOpen(true);
      }
    } else {
      setMicPermissionDeniedOpen(true);
    }
  }, [voiceMode, checkMicPermission, requestMicPermission, handleVoiceButtonClick, addDebugLog]);

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
      (window as any).__eternaStartVoice = async () => {
        addDebugLog(`__eternaStartVoice invoked. voiceMode: ${voiceMode}, speechRecognitionSupported: ${speechRecognitionSupported}`);
        console.log("[MOBILE TAP] __eternaStartVoice handler fired, voiceMode before:", voiceMode);
        
        // 1. Abrir inmediatamente el modo conversación
        setIsOpen(true);
        
        // 2. Mostrar el estado: "Solicitando acceso al micrófono..."
        setSimulatedText(language === 'es' ? 'Solicitando acceso al micrófono...' : 'Requesting microphone access...');
        setSimulatedStatus('thinking');

        // 3. Sólo entonces solicitar el permiso
        const permission = await checkMicPermission();
        addDebugLog(`__eternaStartVoice [PERMISSION] state: ${permission}`);

        if (permission === 'granted') {
          setSimulatedText('');
          if (voiceMode) {
            stopVoiceMode();
          } else {
            handleVoiceButtonClick();
          }
        } else if (permission === 'prompt') {
          const allowed = await requestMicPermission();
          if (allowed) {
            setSimulatedText('');
            if (voiceMode) {
              stopVoiceMode();
            } else {
              handleVoiceButtonClick();
            }
          } else {
            setSimulatedText('');
            setSimulatedStatus('idle');
            setMicPermissionDeniedOpen(true);
          }
        } else {
          setSimulatedText('');
          setSimulatedStatus('idle');
          setMicPermissionDeniedOpen(true);
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
  }, [voiceMode, handleVoiceButtonClick, stopVoiceMode, speechRecognitionSupported, addDebugLog, checkMicPermission, requestMicPermission, language, setSimulatedText, setSimulatedStatus]);

  // Re-check microphone permission when the page regains focus or visibility (returning from browser Settings)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRecheckPermission = async () => {
      if (micPermissionDeniedOpen) {
        addDebugLog("[PERMISSION] Window focus/visibility changed. Re-checking permission status...");
        const permission = await checkMicPermission();
        addDebugLog(`[PERMISSION] Re-check state: ${permission}`);
        if (permission === 'granted') {
          setMicPermissionDeniedOpen(false);
          setIsOpen(true);
          if (!voiceMode) {
            handleVoiceButtonClick();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleRecheckPermission);
    window.addEventListener("focus", handleRecheckPermission);

    return () => {
      document.removeEventListener("visibilitychange", handleRecheckPermission);
      window.removeEventListener("focus", handleRecheckPermission);
    };
  }, [micPermissionDeniedOpen, voiceMode, handleVoiceButtonClick, checkMicPermission, addDebugLog]);

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
  const activeStatus = (isConnected && !geminiActive) ? wsStatus : simulatedStatus;

  const [conciergeMode, setConciergeMode] = useState<'avatar' | 'chat'>('avatar');

  const latestPropertySales = useMemo(() => {
    for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
      const message = chatHistory[index];
      if (message.role === 'assistant' && message.propertySales) {
        return message.propertySales;
      }
    }
    return null;
  }, [chatHistory]);

  const closeEternaCompletely = useCallback(() => {
    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }

    geminiAbortControllerRef.current?.abort();
    geminiAbortControllerRef.current = null;
    homeSearchAbortControllerRef.current?.abort();
    homeSearchAbortControllerRef.current = null;

    if (isConnected) {
      interrupt();
    }
    interruptVoice();
    stopVoiceMode();

    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
      window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
    }

    setSimulatedStatus('idle');
    setSimulatedText('');
    setIsOpen(false);
  }, [interrupt, interruptVoice, isConnected, stopVoiceMode]);

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
      userName: currentUser?.name || 'Usuario',
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
      user: currentUser?.name || 'Usuario',
      userId: currentUser?.id || '',
      properties: myProps.map(p => `${p.title} (${formatPropertyLocation(p.location, p.country)})`),
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
        ? `Eres Eterna, una Broker Inmobiliaria profesional de élite para la plataforma AuraSwap. Tu objetivo es asesorar con un tono corporativo, persuasivo, seguro y altamente comercial a ${currentUser?.name || 'el usuario'} en la búsqueda, inversión, compra, venta, renta o intercambio de propiedades.

REGLAS DE RESPUESTA:
1. Responde estrictamente en ESPAÑOL neutro, corporativo y elegante. Evita modismos de otros idiomas.
2. Da respuestas de máximo 2 o 3 oraciones extremadamente fluidas y directas, orientadas a la acción y óptimas para sintetizar a voz nativa.
3. Resuelve dudas complejas del cliente para avanzar en el embudo de venta:
   - Si te preguntan por métodos de pago, explica con claridad las opciones disponibles basadas en los datos de la propiedad (Venta, créditos aceptados).
   - Si te preguntan por el estado legal, dales certidumbre mencionando que el expediente está revisado y el estatus actual (ej. Libre de gravamen).
   - Sé proactiva: Al terminar de describir una característica o amenidad, cierra con una pregunta de enganche profesional (ej. "¿Te gustaría agendar una videollamada para revisar el expediente jurídico de esta casa residencial?" o "¿Qué esquema de pago se adapta mejor a tus necesidades actuales?").
   - Jamás inventes datos financieros o legales; si un dato no está en el expediente que recibes, invita cordialmente a contactar al propietario mediante el botón de la plataforma.

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
* Filtros disponibles: Ubicación o ciudad (buscador), Rango de Fechas (calendario), Capacidad de personas, Swap Type (Premium, Luxury, Exclusive, Curated), y ordenación por Aura Score (match), capacidad o calificación.
* Pestañas comerciales en Explore: Todo (ALL), Intercambio (SWAP), Renta (RENT - engloba SHORT_RENT y MONTHLY_RENT) y Venta (SALE).

4. NAVEGACIÓN DISPONIBLE (Rutas de AuraSwap a las que puedes dirigir al usuario):
* Explorar catálogo general: "/explore"
* Bandeja de entrada de chat/mensajes: "/messages"
* Edición de perfil: "/profile"
* Dashboard - Pestaña Mis Propiedades (y Wizard): "/dashboard?tab=properties"
* Dashboard - Pestaña Mis Solicitudes / Visitas: "/dashboard?tab=trips"
* Dashboard - Pestaña Solicitudes de Intercambio (Swaps): "/dashboard?tab=swaps"
No inventes otras rutas de navegación. Si el usuario te pide ir a alguna sección, guíalo hacia estas rutas SPA con amabilidad.`
        : `You are Eterna, an elite professional Real Estate Broker for the AuraSwap platform. Your goal is to advise ${currentUser?.name || 'the user'} with a corporate, persuasive, confident, and highly commercial tone regarding property search, investment, purchase, sale, rental, or exchange.

RESPONSE RULES:
1. Respond strictly in clean, corporate, and elegant ENGLISH.
2. Give short responses of at most 2 or 3 extremely fluid, direct, and action-oriented sentences.
3. Resolve complex client queries to move them down the sales funnel:
   - If asked about payment methods, clearly explain the available options based on the property data (Sale, credits accepted).
   - If asked about legal status, give them certainty by mentioning that the dossier has been reviewed and state the current status (e.g., Free of liens).
   - Be proactive: After describing a feature or amenity, close with a professional hook question (e.g., "Would you like to schedule a video call to review the legal dossier of this residential property?" or "Which payment scheme fits your current needs best?").
   - Never invent financial or legal data; if a detail is not in the dossier you receive, cordially invite them to contact the owner using the button on the platform.

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
* Available Filters: Location (search bar), Dates (calendar), Capacity (people), Swap Type (Premium, Luxury, Exclusive, Curated), and sorting by Aura Score (match), capacity, or rating.
* Commercial tabs in Explore: All (ALL), Swap (SWAP), Rent (RENT - groups SHORT_RENT and MONTHLY_RENT), and Sale (SALE).

4. AVAILABLE NAVIGATION (AuraSwap SPA routes you can guide the user to):
* Browse properties catalog: "/explore"
* Inbox messages / chats: "/messages"
* Edit profile details: "/profile"
* Dashboard - My Properties tab (and Wizard): "/dashboard?tab=properties"
* Dashboard - My Requests tab: "/dashboard?tab=trips"
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

  const analyzeHomeConversationWithGemini = useCallback(async (
    prompt: string,
    memory: ConversationMemory,
  ): Promise<SearchConciergeResponse> => {
    homeSearchAbortControllerRef.current?.abort();
    const controller = new AbortController();
    homeSearchAbortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 16_000);

    try {
      const conversationHistory = chatHistoryRef.current
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          userId: currentUser?.id,
          conversationHistory,
          systemPrompt: systemPrompt.content,
          responseMode: 'search_concierge',
          currentSearchState: memory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini search concierge HTTP ${response.status}`);
      }

      const parsed = parseSearchConciergeResponse(await response.json());
      if (!parsed) {
        throw new Error('Gemini devolvió un análisis de búsqueda inválido.');
      }
      return parsed;
    } finally {
      window.clearTimeout(timeoutId);
      if (homeSearchAbortControllerRef.current === controller) {
        homeSearchAbortControllerRef.current = null;
      }
    }
  }, [currentUser?.id, systemPrompt.content]);



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
        0: "Selecciona el perfil que te representa: Propietario, Agente Inmobiliario, Desarrollador Inmobiliario o Administrador de Propiedades / Airbnb. Esto nos ayuda a adaptar las opciones a tu medida.",
        1: "Escribe un título llamativo y un resumen de la propiedad (máximo 160 caracteres). También selecciona el tipo de inmueble.",
        2: "Busca y selecciona la ubicación exacta. Puedes elegir ocultar la dirección exacta y mostrar una zona aproximada si lo deseas por privacidad.",
        3: "Elige las modalidades comerciales: venta directa, renta o swap/intercambio. ¡Puedes seleccionar más de uno!",
        4: "Ingresa los detalles físicos de la propiedad: recámaras, baños, estacionamientos, estilo arquitectónico y las superficies construidas y totales.",
        5: "Marca las amenidades del espacio. Si no encuentras alguna en el catálogo, puedes agregarla manualmente escribiéndola en 'Otra amenidad'.",
        6: "Define las características de la propiedad que buscas recibir a cambio y si aceptas efectivo, autos o terrenos como compensación.",
        7: "Establece el precio mensual de renta, depósito, plazos mínimos, aval o póliza jurídica y las reglas básicas del inmueble.",
        8: "Configura el precio total de venta y marca las condiciones legales como predial al corriente, escrituras y gravámenes.",
        9: "Sube las fotografías de la propiedad. Recuerda marcar una como portada haciendo clic en la estrella, y agrega enlaces de video o Matterport si cuentas con ellos.",
        10: "Configura la comisión total y el porcentaje co-operador para compartir con otros brokers. Las meta-etiquetas de SEO se generarán automáticamente mediante IA.",
        11: "Valida la ficha técnica preliminar y nuestro checklist de calidad del anuncio. Si todo se ve correcto, haz clic en Publicar Anuncio."
      };

      const stepMessagesEN: Record<number, string> = {
        0: "Select the profile that represents you: Owner, Real Estate Agent, Developer, or Property Manager / Airbnb. This helps us customize your onboarding flow.",
        1: "Create a catchy title and a short summary / description (max 160 characters). Don't forget to select the property type.",
        2: "Search and select the exact location. You can choose to hide the exact address and show an approximate area for privacy.",
        3: "Choose your marketing channels: sale, rent, or swap/exchange. You can activate multiple channels at the same time!",
        4: "Enter the physical specs: bedrooms, bathrooms, parkings, architectural style, and construction / total surface areas.",
        5: "Select the amenities. If you can't find one, add it manually in the 'Other amenity' box at the bottom.",
        6: "Define what you're looking to receive in exchange, and whether you accept cash, vehicles, or land as difference.",
        7: "Set the monthly rent price, security deposit, contract duration, legal policies, and home rules.",
        8: "Set the sale price and check legal conditions such as tax records, deeds, and mortgage status.",
        9: "Upload your photos. Star the main one to set it as cover, and link any video tours or 3D Matterport links.",
        10: "Configure total commissions and the percentage shared with cooperating agents. SEO tags will be automatically optimized via AI.",
        11: "Review your draft summary and listing quality checklist. If everything looks perfect, click Publish Listing."
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
    if (memory.operation?.value === 'sale' || memory.operation?.value === 'rent') {
      return memory.operation.value;
    }
    const clean = promptHistory.toLowerCase();
    if (/\b(intercambiar|intercambio|hacer swap|swap|swaps|permutar|permuta|acepto intercambio|trueque|exchange)\b/i.test(clean)) {
      return undefined;
    }
    if (/\b(renta|rentar|alquilar|alquiler|busco renta|arrendar|arriendo|mensual|mes|rent|rental|monthly|lease)\b/i.test(clean)) {
      return 'rent';
    }
    if (/\b(comprar|compra|adquirir|busco comprar|me interesa comprar|adquisicion|venta|buy|purchase|sale|inversion)\b/i.test(clean)) {
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
    if (memory.operation?.value === 'sale') return 'SALE';
    if (memory.operation?.value === 'rent') return 'RENT';
    if (memory.operation?.value === 'swap') return 'SWAP';
    const clean = promptHistory.toLowerCase();
    if (/\b(intercambiar|intercambio|hacer swap|swap|swaps|permutar|permuta|acepto intercambio|trueque|exchange)\b/i.test(clean)) {
      return 'SWAP';
    }
    if (/\b(renta|rentar|alquilar|alquiler|busco renta|arrendar|arriendo|mensual|mes|rent|rental|monthly|lease)\b/i.test(clean)) {
      return 'RENT';
    }
    if (/\b(comprar|compra|adquirir|busco comprar|me interesa comprar|adquisicion|venta|buy|purchase|sale|inversion)\b/i.test(clean)) {
      return 'SALE';
    }
    const purpose = memory.purpose?.value || 'vivir';
    return purpose === 'inversion' ? 'SALE' : 'SWAP';
  };

  const determinePropertyType = (memory: ConversationMemory, promptHistory: string): 'Casas' | 'Departamentos' | undefined => {
    if (memory.propertyType?.value === 'departamento') return 'Departamentos';
    if (memory.propertyType?.value === 'casa') return 'Casas';
    const clean = promptHistory.toLowerCase();
    if (/\b(departamento|departamentos|depa|depas|depto|deptos|condo|condominio|apartment|apartments|flat|apartamento|apartamentos)\b/i.test(clean)) {
      return 'Departamentos';
    }
    if (/\b(casa|casas|hogar|hogares|vivienda|viviendas|residencia|residencias|residencial|home|house|houses|villa)\b/i.test(clean)) {
      return 'Casas';
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
            ? formatCount(legacyProp.bedrooms || 0, 'recámara', 'recámaras', 'feminine', true)
            : `${legacyProp.bedrooms} bedroom${legacyProp.bedrooms !== 1 ? 's' : ''}`;
            
          const bathsLabel = language === 'es'
            ? formatCount(legacyProp.bathrooms || 0, 'baño', 'baños', 'masculine', true)
            : `${legacyProp.bathrooms} bathroom${legacyProp.bathrooms !== 1 ? 's' : ''}`;
            
          card += `🛏️ ${bedsLabel}\n\n`;
          card += `🚿 ${bathsLabel}\n\n`;
          
          const parkingCount = legacyProp.parking ?? 0;
          if (parkingCount > 0) {
            const parkLabel = language === 'es'
              ? formatCount(parkingCount, 'estacionamiento', 'estacionamientos', 'masculine', true)
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

  const runSearchAndRedirect = useCallback(async (
    searchMemory: ConversationMemory,
    userPrompt: string,
    intelligentIntro?: string,
  ) => {
    const city = searchMemory.city?.value || '';
    const promptHistory = chatHistory.filter(h => h.role === 'user').map(h => h.content).join(' ') + ' ' + userPrompt;
    const offeringMode = determineOfferingMode(searchMemory, promptHistory);
    const operation = offeringMode === 'SALE' ? 'sale' : (offeringMode === 'RENT' ? 'rent' : undefined);
    const type = determinePropertyType(searchMemory, promptHistory);
    
    // Parse budget and minBudget ranges
    const range = searchMemory.budget?.value ? parseBudgetRange(searchMemory.budget.value) : {};
    const budgetVal = range.max && range.max > 0 ? range.max : undefined;
    const minBudgetVal = range.min && range.min > 0 ? range.min : undefined;
    
    const roomsVal = searchMemory.rooms?.value;

    const amenityCategories = [];
    if (searchMemory.pool?.value) amenityCategories.push('Alberca');
    if (searchMemory.garden?.value) amenityCategories.push('Jardín');

    const viewTypeId = searchMemory.oceanView?.value ? 'Vista al mar' : undefined;

    // Detect zone/colonia from the prompt history
    const cleanPrompt = promptHistory.toLowerCase();
    let zone = undefined;
    if (cleanPrompt.includes('tres rios') || cleanPrompt.includes('tres ríos')) {
      zone = 'Tres Ríos';
    } else if (cleanPrompt.includes('la primavera')) {
      zone = 'La Primavera';
    } else if (cleanPrompt.includes('montebello')) {
      zone = 'Montebello';
    } else if (cleanPrompt.includes('marina mazatlan') || cleanPrompt.includes('marina mazatlán')) {
      zone = 'Marina Mazatlán';
    } else if (cleanPrompt.includes('zona dorada')) {
      zone = 'Zona Dorada';
    } else if (cleanPrompt.includes('malecon') || cleanPrompt.includes('malecón')) {
      zone = 'Malecón';
    }

    const filters: PropertySearchFilters = {
      city: zone || city || undefined, // Search in zone first if detected
      operation,
      budget: budgetVal,
      minBudget: minBudgetVal,
      rooms: roomsVal,
      sort: 'best_match',
      amenityCategories: amenityCategories.length > 0 ? amenityCategories : undefined,
      viewTypeId,
    };
    if (type) {
      filters.type = type;
    }

    const buildExploreUrl = (appliedFilters: PropertySearchFilters) => {
      let url = `/explore?search=${encodeURIComponent(appliedFilters.city || city)}&offering=${offeringMode}`;
      if (appliedFilters.budget !== undefined) url += `&budget=${appliedFilters.budget}`;
      if (appliedFilters.minBudget !== undefined) url += `&minBudget=${appliedFilters.minBudget}`;
      if (appliedFilters.rooms !== undefined) url += `&rooms=${appliedFilters.rooms}`;
      if (type) url += `&category=${type.toLowerCase()}`;
      if (amenityCategories.length > 0) url += `&amenity=${encodeURIComponent(amenityCategories[0])}`;
      if (viewTypeId) url += `&view=${encodeURIComponent(viewTypeId)}`;
      return url;
    };

    const navigateToExplore = (appliedFilters: PropertySearchFilters) => {
      setExploreFilters({
        category: type || 'All',
        offeringTab: offeringMode,
        query: appliedFilters.city || city,
        guests: 0,
        swapType: 'All',
        sortBy: 'match',
      });
      router.push(buildExploreUrl(appliedFilters));
      if (window.innerWidth < 768) {
        setIsCompact(true);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    setThinkingContext('property_search');
    const immediateSearchMessage = intelligentIntro || (language === 'es'
      ? `Voy a buscar opciones en ${city || 'el catálogo'} con los criterios que me diste.`
      : `I will search the catalog using the criteria you gave me.`);
    setChatHistory((previous) => [...previous, { role: 'assistant', content: immediateSearchMessage }]);
    setSimulatedStatus('talking');
    speak(immediateSearchMessage);

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

    // When there is no price fallback to resolve, the destination URL is
    // already final. Navigate now and let the catalogue load concurrently.
    let navigatedEarly = false;
    if (budgetVal === undefined && minBudgetVal === undefined) {
      navigateToExplore(filters);
      navigatedEarly = true;
    }

    try {
      let searchResult = await ServiceFactory.getPropertyService().search(filters);
      let results = searchResult.results || [];
      let finalFilters = filters;
      let isAlternative = false;
      let altType = null;

      // Smart budget fallback if no properties match budget
      if (results.length === 0 && (budgetVal !== undefined || minBudgetVal !== undefined)) {
        // Fallback 1: search in the same zone/colonia without budget constraint
        if (zone) {
          const zoneFallbackFilters: PropertySearchFilters = {
            ...filters,
            city: zone
          };
          delete zoneFallbackFilters.budget;
          delete zoneFallbackFilters.minBudget;

          const zoneResult = await ServiceFactory.getPropertyService().search(zoneFallbackFilters);
          if (zoneResult.results && zoneResult.results.length > 0) {
            results = zoneResult.results;
            searchResult = zoneResult;
            finalFilters = zoneFallbackFilters;
            isAlternative = true;
            altType = 'zone';
          }
        }

        // Fallback 2: search in the same city without budget constraint
        if (results.length === 0) {
          const cityFallbackFilters: PropertySearchFilters = {
            ...filters,
            city: city || undefined
          };
          delete cityFallbackFilters.budget;
          delete cityFallbackFilters.minBudget;

          const cityResult = await ServiceFactory.getPropertyService().search(cityFallbackFilters);
          if (cityResult.results && cityResult.results.length > 0) {
            results = cityResult.results;
            searchResult = cityResult;
            finalFilters = cityFallbackFilters;
            isAlternative = true;
            altType = 'city';
          }
        }
      }

      const hasResults = results.length > 0;
      let searchMsg = '';
      if (hasResults) {
        if (isAlternative) {
          if (altType === 'zone') {
            searchMsg = language === 'es'
              ? `No he encontrado propiedades por ese precio en ${zone}, pero te muestro las opciones disponibles en esa zona en el explorador.`
              : `I did not find properties for that price in ${zone}, but I am showing you the options available in that area in the explorer.`;
          } else {
            searchMsg = language === 'es'
              ? `No he encontrado propiedades por ese precio en ${city || 'esa ubicación'}, pero te muestro las alternativas en el explorador.`
              : `I did not find properties for that price in ${city || 'that location'}, but I will show you the alternatives in the explorer.`;
          }
        } else {
          searchMsg = intelligentIntro || (language === 'es'
            ? `Encontré opciones que coinciden con lo que buscas en ${city || 'el catálogo'}. Te las muestro en el explorador.`
            : `I found options matching what you need in ${city || 'the catalog'}. I am showing them in the explorer.`);
        }
      } else {
        searchMsg = language === 'es'
          ? `No he encontrado coincidencias para tu búsqueda en ${city}, pero te mostraré algunas alternativas en el explorador.`
          : `I did not find matches for your search in ${city}, but I will show you some alternatives in the explorer.`;
      }

      if (searchMsg !== immediateSearchMessage) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: searchMsg }]);
        setSimulatedStatus('talking');
        speak(searchMsg);
      }

      console.log(`[SEARCH]
Query original: "${userPrompt}"
↓
Intent detectado: SEARCH_PROPERTY
↓
Filtros generados: ${JSON.stringify(filters, null, 2)}
↓
Filtros aplicados (finales): ${JSON.stringify(finalFilters, null, 2)}
↓
PropertyService.search() completed
↓
Cantidad de resultados: ${results.length}
↓
Explore actualizado: Redirecting to /explore`);

      setActiveSearch({
        id: sessionId,
        origin: "eterna",
        filters: finalFilters,
        results: results,
        provider: searchResult.provider,
        createdAt: sessionStart,
        loading: false,
        error: null
      });

      if (!navigatedEarly) navigateToExplore(finalFilters);
    } catch (err) {
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
      if (!navigatedEarly) navigateToExplore(filters);
    }

    const resetSession: ConversationSession = {
      activeIntent: ConversationIntent.NONE,
      status: ConversationStatus.IDLE,
      step: 'operation',
      memory: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setConversationalSession(resetSession);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
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
    setIsOpen,
    setConversationalSession
  ]);

  // ────────────────────────────────────────────────
  // HANDLE SEND — Intent Router → LLM fallback
  // ────────────────────────────────────────────────

  const openPropertyContact = useCallback((channel: 'message' | 'call', message: string) => {
    const property = liveContext.property;
    if (!property) return;

    window.dispatchEvent(new CustomEvent('eterna:open-property-contact', {
      detail: {
        propertyId: property.id,
        channel,
        message,
      },
    }));
  }, [liveContext.property]);

  const requestPageAgentResponse = useCallback(async (
    prompt: string,
    pageContext: unknown,
  ): Promise<PageAgentResponse> => {
    geminiAbortControllerRef.current?.abort();
    const controller = new AbortController();
    geminiAbortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 8_500);

    try {
      const conversationHistory = chatHistoryRef.current
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }));
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          userId: currentUser?.id,
          conversationHistory,
          responseMode: 'page_agent',
          pageContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `Eterna page agent HTTP ${response.status}`);
      }

      const parsed = parsePageAgentResponse(await response.json());
      if (!parsed) throw new Error('Gemini devolvió una decisión de página inválida.');
      return parsed;
    } finally {
      window.clearTimeout(timeoutId);
      if (geminiAbortControllerRef.current === controller) {
        geminiAbortControllerRef.current = null;
      }
    }
  }, [currentUser?.id]);

  const executePageAgentAction = useCallback(async (
    response: PageAgentResponse,
    originalPrompt: string,
  ) => {
    const { action } = response;
    if (action.type === 'none' || action.type === 'search_properties') {
      return { status: 'ignored' as const };
    }

    if (action.type === 'navigate') {
      const route = action.route.trim();
      const isSafeInternalRoute = /^\/(?:$|explore(?:[/?].*)?|dashboard(?:[/?].*)?|messages(?:[/?].*)?|profile(?:[/?].*)?|login(?:[/?].*)?|admin(?:[/?].*)?|property\/[a-zA-Z0-9-]+(?:[/?].*)?)$/.test(route);
      if (!isSafeInternalRoute) return { status: 'not_found' as const, target: route };

      let intentKey = 'view_dashboard';
      if (route.includes('tab=properties')) intentKey = response.intent === 'publish' ? 'publish_property' : 'view_properties';
      else if (route.includes('tab=trips')) intentKey = 'view_trips';
      else if (route.includes('tab=swaps')) intentKey = 'view_swaps';
      else if (route.startsWith('/messages')) intentKey = 'view_messages';
      else if (route.startsWith('/profile')) intentKey = 'edit_profile';

      navigateToRoute(route, originalPrompt, intentKey);
      return { status: 'completed' as const, target: route };
    }

    if (action.type === 'go_back') {
      router.back();
      return { status: 'completed' as const, target: 'back' };
    }

    if (action.type === 'open_property_contact') {
      if (!liveContext.property) return { status: 'not_found' as const, target: 'property contact' };
      const channel = action.channel === 'call' ? 'call' : 'message';
      openPropertyContact(channel, response.leadSummary);
      return { status: 'completed' as const, target: channel };
    }

    if (action.type === 'open_property_wizard') {
      if (!currentUser || pathname !== '/dashboard' || searchParams.get('tab') !== 'properties') {
        navigateToRoute('/dashboard?tab=properties', originalPrompt, 'publish_property');
      } else {
        setActiveGuidedFlow('publish_property');
        window.dispatchEvent(new CustomEvent('open-property-wizard'));
      }
      return { status: 'completed' as const, target: 'property wizard' };
    }

    const result = await executeSemanticPageAction(action);
    if (window.innerWidth < 768 && result.status === 'completed') {
      setIsCompact(true);
      setIsOpen(true);
    }
    return result;
  }, [
    currentUser,
    liveContext.property,
    navigateToRoute,
    openPropertyContact,
    pathname,
    router,
    searchParams,
    setActiveGuidedFlow,
  ]);

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
    const currentPropertyId = activeProperty?.id || liveContext.propertyPage?.propertyId || null;

    const activePropertyTitle = activeProperty
      ? (t(`properties.${activeProperty.id}.title`).startsWith('properties.') 
          ? activeProperty.title 
          : t(`properties.${activeProperty.id}.title`))
      : null;

    const activePropertyDescription = activeProperty
      ? (t(`properties.${activeProperty.id}.description`).startsWith('properties.') 
          ? activeProperty.description 
          : t(`properties.${activeProperty.id}.description`))
      : null;

    let activePropertyDossier: string | null = null;
    if (activeProperty) {
      const confirmedStatus = (value: boolean | undefined, positive: string, negative: string) => {
        if (value === true) return positive;
        if (value === false) return negative;
        return "No especificado";
      };

      const legalStatus = {
        libreDeGravamen: confirmedStatus(activeProperty.legalDebtFree, "Confirmado: libre de gravamen", "Confirmado: tiene gravamen activo"),
        escriturada: confirmedStatus(activeProperty.legalPublicDeed, "Confirmado: escriturada", "Confirmado: no escriturada o pendiente"),
        predialAlCorriente: confirmedStatus(activeProperty.legalTaxCurrent, "Confirmado: al corriente", "Confirmado: pendiente"),
        serviciosPagados: confirmedStatus(activeProperty.legalServicesPaid, "Confirmado: al corriente", "Confirmado: pendiente"),
        regimenCondominio: confirmedStatus(activeProperty.condominiumRegime, "Sí", "No"),
        tipoPropietario: activeProperty.legalOwnerType || "No especificado",
        hipotecada: confirmedStatus(activeProperty.legalIsMortgaged, "Confirmado: hipoteca activa", "Confirmado: sin hipoteca"),
        documentacionCompleta: confirmedStatus(activeProperty.legalDocumentationComplete, "Confirmada como completa", "Confirmada como incompleta"),
        usoDeSuelo: activeProperty.legalLandUse || "No especificado",
        restricciones: activeProperty.legalRestrictions || "No especificadas",
        ultimaActualizacion: activeProperty.legalLastUpdate || "No especificada",
      };

      const paymentMethods = {
        creditoBancario: activeProperty.offerings?.some(o => o.acceptsBankCredit === true) ? "Aceptado" : "No confirmado",
        creditoInfonavit: activeProperty.offerings?.some(o => o.acceptsInfonavit === true) ? "Aceptado" : "No confirmado",
        creditoFovissste: activeProperty.offerings?.some(o => o.acceptsFovissste === true) ? "Aceptado" : "No confirmado",
        contado: activeProperty.offerings?.some(o => o.acceptsCash === true) ? "Aceptado" : "No confirmado",
        financiamientoDesarrollador: activeProperty.offerings?.some(o => o.developerFinancing === true) ? "Disponible" : "No confirmado",
        esquemasAuraSwap: activeProperty.offerings?.map(o => ({
          modalidad: o.mode,
          estado: o.status,
          precio: o.priceAmount ? `${o.priceAmount} ${o.currency}` : "N/A",
          periodo: o.billingPeriod,
          precioNegociable: o.isPriceNegotiable,
          aceptaOfertas: o.acceptsOffers,
          disponibilidadDesde: o.availableFrom || null,
          disponibilidadHasta: o.availableUntil || null,
        })) || []
      };

      const countItems = [
        { count: activeProperty.bedrooms || 0, singular: 'habitación', plural: 'habitaciones', gender: 'feminine' as const },
        { count: activeProperty.bathrooms || 0, singular: 'baño', plural: 'baños', gender: 'masculine' as const },
        (activeProperty.parkingSpaces !== undefined && activeProperty.parkingSpaces !== null) 
          ? { count: activeProperty.parkingSpaces, singular: 'estacionamiento', plural: 'estacionamientos', gender: 'masculine' as const } 
          : null
      ].filter(Boolean) as any[];

      const resumenCaracteristicas = `Esta propiedad cuenta con ${formatSentencePart(countItems, true)}.`;

      activePropertyDossier = JSON.stringify({
        id: activeProperty.id,
        titulo: activePropertyTitle,
        descripcion: activePropertyDescription,
        ubicacionPublica: {
          zona: activeProperty.location,
          ciudad: activeProperty.city || null,
          estado: activeProperty.state || null,
          pais: activeProperty.country,
          direccionMostrable: activeProperty.showPublicAddress
            ? (activeProperty.formattedAddress || activeProperty.address || null)
            : null,
          referencia: activeProperty.locationReference || null,
        },
        resumenCaracteristicas,
        caracteristicas: {
          habitaciones: activeProperty.bedrooms,
          banos: activeProperty.bathrooms,
          mediosBanos: activeProperty.halfBathrooms || 0,
          estacionamientos: activeProperty.parkingSpaces ?? null,
          niveles: activeProperty.levelsCount ?? null,
          superficieTotalM2: activeProperty.surfaceTotal ?? null,
          superficieConstruidaM2: activeProperty.surfaceBuilt ?? null,
          antiguedadConstruccion: activeProperty.constructionAge ?? null,
          estadoConservacion: activeProperty.conservationStateId || null,
        },
        amenidades: activeProperty.amenities || [],
        expedienteJuridico: legalStatus,
        modalidadesYMetodosPago: paymentMethods,
        responsableComercial: {
          nombre: activeProperty.hostName || "Responsable de la propiedad",
          verificado: activeProperty.hostVerified,
          tipo: activeProperty.legalOwnerType || "No especificado",
          horarioPreferido: activeProperty.ownerContactTime || "No especificado",
        },
      }, null, 2);
    }

    // High-confidence catalog searches do not need a round trip to the LLM.
    // This preserves context across turns and makes the most common flow feel
    // immediate, while Gemini remains responsible for nuanced conversation,
    // property advice and page actions.
    if (!activeProperty) {
      const fastSearchPlan = planFastPropertySearch({
        prompt,
        currentMemory: conversationalSession.memory,
        catalogLocations: properties,
      });

      if (fastSearchPlan.matched) {
        if (fastSearchPlan.ready) {
          await runSearchAndRedirect(fastSearchPlan.memory, prompt, fastSearchPlan.reply);
          return;
        }

        const updatedSession: ConversationSession = {
          activeIntent: ConversationIntent.PROPERTY_SEARCH,
          status: ConversationStatus.COLLECTING,
          step: fastSearchPlan.missing || 'operation',
          memory: fastSearchPlan.memory,
          createdAt: conversationalSession.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        setConversationalSession(updatedSession);
        sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
        setThinkingContext('property_search');
        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: fastSearchPlan.reply,
          suggestedReplies: fastSearchPlan.suggestedReplies,
        }]);
        setSimulatedStatus('talking');
        speak(fastSearchPlan.reply, () => setSimulatedStatus('idle'));
        return;
      }
    }

    // Gemini is the primary decision-maker on every screen. The local intent
    // catalog below remains only as a resilient fallback when the AI endpoint
    // is disabled or temporarily unavailable.
    if (geminiActive) {
      try {
        setThinkingContext(activeProperty ? 'property_detail' : 'general');
        setSimulatedStatus('thinking');

        const pageContext = captureEternaPageSnapshot({
          route: liveContext.currentUrl,
          dashboard: liveContext.dashboard,
          wizard: liveContext.wizard,
          explore: liveContext.explore,
          propertyPage: liveContext.propertyPage,
          auth: liveContext.auth,
          activeGuidedFlow: liveContext.eterna.activeGuidedFlow,
          accountSummary: contextBridgeJSON,
          currentPropertyDossier: activePropertyDossier,
          currentSearchMemory: conversationalSession.memory,
        });
        const pageDecision = await requestPageAgentResponse(prompt, pageContext);
        const isSearchDecision = pageDecision.intent === 'property_search'
          || pageDecision.action.type === 'search_properties';

        if (isSearchDecision) {
          const updatedMemory = mergeSearchAnalysisIntoMemory(
            conversationalSession.memory,
            pageDecision.search,
          );
          // The model may be conservative about readyToSearch. The product
          // rule is deterministic: operation + location are sufficient;
          // budget and purpose are optional refinements.
          const canSearch = Boolean(
            updatedMemory.operation?.value
            && (updatedMemory.city?.value || updatedMemory.zone?.value),
          );

          if (canSearch) {
            await runSearchAndRedirect(updatedMemory, prompt, pageDecision.reply);
            return;
          }

          const nextStep: ConversationStep = updatedMemory.operation?.value ? 'city' : 'operation';
          const updatedSession: ConversationSession = {
            activeIntent: ConversationIntent.PROPERTY_SEARCH,
            status: ConversationStatus.COLLECTING,
            step: nextStep,
            memory: updatedMemory,
            createdAt: conversationalSession.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
          setConversationalSession(updatedSession);
          sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
          setChatHistory((previous) => [...previous, {
            role: 'assistant',
            content: pageDecision.reply,
            suggestedReplies: pageDecision.suggestedReplies,
          }]);
          setSimulatedStatus('talking');
          speak(pageDecision.reply, () => setSimulatedStatus('idle'));
          return;
        }

        const shouldAttachPropertyActions = Boolean(
          activeProperty
          && (
            pageDecision.contactIntent
            || pageDecision.propertyStage === 'ready_to_contact'
            || pageDecision.action.type === 'open_property_contact'
          ),
        );
        const propertySales = shouldAttachPropertyActions ? {
          reply: pageDecision.reply,
          stage: pageDecision.propertyStage,
          contactIntent: pageDecision.contactIntent,
          preferredContact: pageDecision.preferredContact,
          leadSummary: pageDecision.leadSummary,
          suggestedQuestions: pageDecision.suggestedReplies,
        } : undefined;

        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: pageDecision.reply,
          propertySales,
          suggestedReplies: propertySales ? undefined : pageDecision.suggestedReplies,
        }]);
        setSimulatedStatus('talking');
        speak(pageDecision.reply, () => setSimulatedStatus('idle'));

        const actionResult = await executePageAgentAction(pageDecision, prompt);
        if (actionResult.status === 'not_found') {
          const clarification = language === 'es'
            ? `No encuentro “${actionResult.target}” en esta pantalla. Puedo llevarte a la sección correcta si me dices qué deseas conseguir.`
            : `I cannot find “${actionResult.target}” on this screen. I can take you to the right section if you tell me what you want to accomplish.`;
          setChatHistory((previous) => [...previous, { role: 'assistant', content: clarification }]);
        }
        return;
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;

        console.warn('[Eterna-Gemini] Page agent failed without activating the legacy questionnaire.', error);
        const navigationFallback = resolveIntent(prompt);
        if (
          navigationFallback.matched
          && navigationFallback.action === 'navigate'
          && navigationFallback.route
        ) {
          navigateToRoute(navigationFallback.route, prompt, 'view_dashboard');
          setChatHistory((previous) => [...previous, {
            role: 'assistant',
            content: navigationFallback.response,
            route: navigationFallback.route,
          }]);
          setSimulatedStatus('talking');
          speak(navigationFallback.response, () => setSimulatedStatus('idle'));
          return;
        }

        const recoveryMessage = activeProperty
          ? 'Conservo la propiedad y tu pregunta, pero no pude completar el análisis en este instante. Inténtalo de nuevo y retomaré exactamente desde aquí.'
          : 'Conservo lo que me dijiste, pero no pude completar el análisis en este instante. Inténtalo de nuevo y retomaré desde aquí.';
        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: recoveryMessage,
          suggestedReplies: ['Reintentar'],
        }]);
        setSimulatedStatus('talking');
        speak(recoveryMessage, () => setSimulatedStatus('idle'));
        return;
      }
    }

    // On a property page Gemini owns the conversation. Local regex flows only
    // keep explicit navigation commands deterministic.
    if (activeProperty) {
      const navigationIntent = resolveIntent(prompt);
      const isExplicitNavigation = navigationIntent.matched
        && navigationIntent.action === 'navigate'
        && Boolean(navigationIntent.route);

      if (!isExplicitNavigation) {
        setThinkingContext('property_detail');
        callGeminiAvatarAPI(
          prompt,
          currentPropertyId,
          activePropertyTitle,
          activePropertyDescription,
          activePropertyDossier,
        );
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
        currentStep = 'operation';
        memory = {};
        
        const resetSession: ConversationSession = {
          activeIntent: ConversationIntent.NONE,
          status: ConversationStatus.IDLE,
          step: 'operation',
          memory: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setConversationalSession(resetSession);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
        }
      }
    }

    // On the home page Gemini interprets the whole conversation before the
    // deterministic flow. The local classifier remains available as a safe
    // fallback when Gemini is disabled or temporarily unavailable.
    const homeNavigationIntent = isHome ? resolveIntent(prompt) : null;
    const isExplicitHomeNavigation = Boolean(
      homeNavigationIntent?.matched
      && homeNavigationIntent.action === 'navigate'
      && homeNavigationIntent.route,
    );

    if (isHome && geminiActive && !isInterruption && !isExplicitHomeNavigation) {
      try {
        setThinkingContext('property_search');
        const analysis = await analyzeHomeConversationWithGemini(prompt, memory);

        if (analysis.intent === 'property_search') {
          const updatedMemory = mergeSearchAnalysisIntoMemory(memory, analysis);
          const operation = updatedMemory.operation?.value;
          const hasSearchRequirements = Boolean(
            updatedMemory.city
            && operation,
          );

          if (hasSearchRequirements) {
            await runSearchAndRedirect(updatedMemory, prompt);
            return;
          }

          const nextStep: ConversationStep = operation ? 'city' : 'operation';
          const updatedSession: ConversationSession = {
            activeIntent: ConversationIntent.PROPERTY_SEARCH,
            status: ConversationStatus.COLLECTING,
            step: nextStep,
            memory: updatedMemory,
            createdAt: conversationalSession.createdAt || Date.now(),
            updatedAt: Date.now(),
          };

          setConversationalSession(updatedSession);
          sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
          setChatHistory(prev => [...prev, { role: 'assistant', content: analysis.reply }]);
          setSimulatedStatus('talking');
          speak(analysis.reply, () => setSimulatedStatus('idle'));
          return;
        }

        if (analysis.intent === 'general') {
          setThinkingContext('general');
          setChatHistory(prev => [...prev, { role: 'assistant', content: analysis.reply }]);
          setSimulatedStatus('talking');
          speak(analysis.reply, () => setSimulatedStatus('idle'));
          return;
        }
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
          console.warn('[Eterna-Gemini] Home analysis failed; using local fallback.', error);
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
          step: 'operation',
          memory: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setConversationalSession(resetSession);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
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
          await runSearchAndRedirect(memory, prompt);
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
              sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
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
              sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
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

      // Location + operation are enough to start. All other criteria can be
      // refined from the result page without blocking the user.
      if (updatedMemory.city && updatedMemory.operation) {
        await runSearchAndRedirect(updatedMemory, prompt);
        return;
      }

      const nextStep = ConversationEngine.getNextStep(updatedMemory);

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
        sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(updatedSession));
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
      const userAlreadyResponded = (activeIntent as any) === ConversationIntent.PROPERTY_SEARCH;
      const isBanned = !!activeProperty || userAlreadyResponded;

      if (classification.confidence < 0.60 && !isBanned) {
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

      if (initialMemory.city && initialMemory.operation) {
        await runSearchAndRedirect(initialMemory, prompt);
        return;
      }

      const nextStep = ConversationEngine.getNextStep(initialMemory);

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
        sessionStorage.setItem(ETERNA_CONVERSATION_SESSION_KEY, JSON.stringify(newSession));
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

    if (geminiActive) {
      // Gemini Flash is the default brain: send message directly to Gemini native endpoint
      console.log("[Eterna-Gemini] Brain switch is active. Sending directly to Gemini API.");
      callGeminiAvatarAPI(prompt, currentPropertyId, activePropertyTitle, activePropertyDescription, activePropertyDossier);
    } else if (isConnected) {
      // Send to WebSocket server with Context Bridge and Secure User ID
      console.log("[Eterna Audit] handleSend: Routing to remote WebSocket backend.");
      sendMessage(prompt, [systemPrompt, ...chatHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }))], currentUser?.id);
    } else {
      // Gemini REST integration as intelligent fallback
      console.log("[Eterna REST Integration] Routing to Gemini API endpoint `/api/avatar` as fallback.");
      callGeminiAvatarAPI(prompt, currentPropertyId, activePropertyTitle, activePropertyDescription, activePropertyDossier);
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
      const introDone = sessionStorage.getItem(ETERNA_HOME_INTRO_SESSION_KEY);
      if (introDone) return;
    }

    // Only present if chat log is empty
    if (chatHistory.length > 0) return;

    let safetyTimer: NodeJS.Timeout;

    const timer = setTimeout(() => {
      // Re-verify in case user interacted during the delay
      if (chatHistoryRef.current.length > 0) return;

      const part1 = language === 'es'
        ? "Hola, soy Eterna, tu asesora inmobiliaria en AuraSwap."
        : "Hello, I am Eterna, your real estate advisor at AuraSwap.";
      const part2 = language === 'es'
        ? "Dime qué quieres lograr: puedo buscar y comparar propiedades, revisar la que estás viendo o llevarte exactamente a la sección que necesitas."
        : "Tell me what you want to accomplish: I can search and compare properties, review the one you are viewing, or take you directly to the section you need.";

      const welcomeMsg = part1 + " " + part2;

      // Add to chat history
      setChatHistory(prev => {
        if (prev.some(msg => msg.content === welcomeMsg)) return prev;
        return [...prev, { role: 'assistant', content: welcomeMsg }];
      });

      let welcomeBecameAudible = false;
      const welcomeSpeechOptions = {
        preferImmediate: true,
        onStart: () => {
          welcomeBecameAudible = true;
        },
      };

      // Speak Part 1 first. Before the first user gesture, browser speech is
      // intentionally preferred because remote audio autoplay is commonly blocked.
      speak(part1, () => {
        // Highlight action cards exactly when Part 2 starts
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: true }));
        }

        // Speak Part 2
        speak(part2, () => {
          if (typeof window !== 'undefined') {
            if (welcomeBecameAudible) {
              sessionStorage.setItem(ETERNA_HOME_INTRO_SESSION_KEY, 'true');
            }
            window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
          }
          setSimulatedStatus('idle');
        }, welcomeSpeechOptions);

        // Safety timeout to disable highlight after 8 seconds in case speech fails to end
        safetyTimer = setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
          }
        }, 8000);
      }, welcomeSpeechOptions);

    }, 1800);

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
      closeEternaCompletely();
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
  }, [eternaCommand, voiceMode, handleVoiceButtonClick, handleSend, clearEternaCommand, shouldBeCompactOnMobile, closeEternaCompletely, isHome, conciergeMode, stopVoiceMode]);

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
            data-eterna-ui
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
                      ? `¡Hola, ${isHydrated && currentUser?.name ? currentUser.name.split(' ')[0] : 'Usuario'}! 👋`
                      : `Hi, ${isHydrated && currentUser?.name ? currentUser.name.split(' ')[0] : 'User'}! 👋`}
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
              onClick={handleMicButtonClickWithPermission}
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
              type="button"
              aria-label={language === 'es' ? 'Abrir chat con Eterna' : 'Open Eterna chat'}
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
          <div data-eterna-ui className="fixed inset-x-0 bottom-0 md:bottom-6 md:right-6 md:left-auto z-50 flex flex-col items-end pointer-events-none">
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
                  onClick={handleMicButtonClickWithPermission}
                  className="relative w-full h-full rounded-[28px] overflow-hidden bg-slate-950 flex flex-col justify-between"
                >
                  {/* Main Double Buffered Video Element */}
                  <DoubleBufferVideoPlayer
                    state={
                      isListening ? 'LISTENING' :
                      activeStatus === 'thinking' ? 'THINKING' :
                      activeStatus === 'talking' ? 'TALKING' :
                      'IDLE'
                    }
                    loop={true}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    objectPosition="center 15%"
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
                          closeEternaCompletely();
                        }}
                        aria-label={language === 'es' ? 'Cerrar Eterna y apagar el micrófono' : 'Close Eterna and turn off the microphone'}
                        className={`text-white/70 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
                      >
                        <X className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                      </button>
                    </div>
                  </div>

                  {/* Contextual property actions remain available in avatar mode */}
                  {latestPropertySales && liveContext.property && !isCompact && activeStatus !== 'thinking' && (
                    <div
                      className="absolute inset-x-3 bottom-[76px] z-40 pointer-events-auto"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <EternaPropertyActions
                        propertySales={latestPropertySales}
                        language={language}
                        propertyTitle={liveContext.property.title}
                        variant="avatar"
                        onQuestion={handleSend}
                        onContact={openPropertyContact}
                      />
                    </div>
                  )}

                  {/* Centered Glassmorphic Helper Tooltip */}
                  {!latestPropertySales && !isListening && activeStatus === 'idle' && !isCompact && (
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
                        onClick={closeEternaCompletely}
                        aria-label={language === 'es' ? 'Cerrar Eterna y apagar el micrófono' : 'Close Eterna and turn off the microphone'}
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
                            <p className={`text-xs font-extrabold ${isHome ? 'text-white' : 'text-brand-black'}`}>{t('messages.eternaGreeting', { name: currentUser?.name ? currentUser.name.split(' ')[0] : 'Usuario' })}</p>
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
                                {!msg.propertySales && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {msg.suggestedReplies.map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSend(suggestion);
                                        }}
                                        className={`max-w-full rounded-full border px-2.5 py-1.5 text-left text-[9px] font-bold transition-colors ${
                                          isHome
                                            ? 'border-white/15 bg-white/5 text-white/75 hover:border-white/35 hover:text-white'
                                            : 'border-brand-gray-200 bg-white text-brand-gray-600 hover:border-brand-accent/50 hover:text-brand-accent'
                                        }`}
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                )}
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
                                {msg.propertySales && liveContext.property && (
                                  <EternaPropertyActions
                                    propertySales={msg.propertySales}
                                    language={language}
                                    propertyTitle={liveContext.property.title}
                                    onQuestion={handleSend}
                                    onContact={openPropertyContact}
                                  />
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Real-time WebSockets chunk transcription */}
                        {(isConnected && !geminiActive) && textResponse && wsStatus === 'talking' && (
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
                        {(!isConnected || geminiActive) && simulatedText && simulatedStatus === 'talking' && (
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
                            onClick={handleMicButtonClickWithPermission}
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
                        onClick={handleMicButtonClickWithPermission}
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

      {/* C. PREMIUM MICROPHONE PERMISSION DENIED MODAL */}
      <AnimatePresence>
        {micPermissionDeniedOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-[420px] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center gap-5 select-none"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setMicPermissionDeniedOpen(false);
                  setShowInstructions(false);
                }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/40 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon Container */}
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 animate-pulse mt-2">
                <MicOff className="w-8 h-8" />
              </div>

              {/* Title & Description */}
              <div className="flex flex-col gap-2">
                <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">
                  {language === 'es' ? 'Acceso al micrófono denegado' : 'Microphone Access Denied'}
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed px-2">
                  {language === 'es' 
                    ? 'Tienes desactivado el acceso al micrófono. Para hablar con Eterna debes permitir el uso del micrófono para este sitio.'
                    : 'Microphone access is disabled. To talk with Eterna, you must allow microphone access for this site.'}
                </p>
              </div>

              {/* Instructions Panel */}
              <AnimatePresence>
                {showInstructions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="w-full text-left bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 flex flex-col gap-3 text-[11px] leading-relaxed text-slate-300 overflow-hidden"
                  >
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-[9px] border-b border-slate-800/50 pb-1">
                      {language === 'es' ? 'Cómo activarlo:' : 'How to enable:'}
                    </div>
                    <div>
                      <span className="font-bold text-rose-400">Safari (iOS/Mac):</span>{' '}
                      {language === 'es'
                        ? 'Ve a Ajustes > Safari > Micrófono > Permitir, o toca el icono "aA" en la barra de direcciones y selecciona "Configuración del sitio web".'
                        : 'Go to Settings > Safari > Microphone > Allow, or tap the "aA" icon in the address bar and select "Website Settings".'}
                    </div>
                    <div>
                      <span className="font-bold text-blue-400">Chrome (Android/PC):</span>{' '}
                      {language === 'es'
                        ? 'Toca el candado o el icono de ajustes junto a la URL en la barra de direcciones, selecciona "Permisos" y activa el Micrófono.'
                        : 'Tap the lock or settings icon next to the URL in the address bar, select "Permissions" and enable the Microphone.'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2 mt-2">
                <button
                  onClick={async () => {
                    addDebugLog("[PERMISSION] Retry requested");
                    const allowed = await requestMicPermission();
                    if (allowed) {
                      setMicPermissionDeniedOpen(false);
                      setShowInstructions(false);
                      setIsOpen(true);
                      if (!voiceMode) {
                        handleVoiceButtonClick();
                      }
                    }
                  }}
                  className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-extrabold text-xs tracking-wider uppercase rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  {language === 'es' ? 'Reintentar' : 'Retry'}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMicPermissionDeniedOpen(false);
                      setShowInstructions(false);
                      setIsOpen(true);
                      if (typeof window !== 'undefined') {
                        const chatInput = document.querySelector('input[type="text"]');
                        if (chatInput) {
                          chatInput.scrollIntoView({ behavior: 'smooth' });
                          (chatInput as HTMLInputElement).focus();
                        }
                      }
                    }}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] tracking-wider uppercase rounded-xl transition-all active:scale-98 cursor-pointer"
                  >
                    {language === 'es' ? 'Escribir' : 'Write'}
                  </button>

                  <button
                    onClick={() => setShowInstructions(prev => !prev)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] tracking-wider uppercase rounded-xl transition-all active:scale-98 cursor-pointer"
                  >
                    {language === 'es' ? 'Cómo activarlo' : 'Instructions'}
                  </button>
                </div>
              </div>
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
