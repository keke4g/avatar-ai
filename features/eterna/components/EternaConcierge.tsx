"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useEffectEvent, useRef, useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useWebSocketStream, StreamStatus } from '@/hooks/useWebSocketStream';
import { useTranslation } from '@/lib/context/LanguageContext';
import { useSwap } from '@/lib/context/SwapContext';
import { useLiveContext } from '@/lib/context/LiveContext';
import { GUIDED_FLOWS } from '@/lib/concierge/guidedFlows';
import { formatCount, formatPropertyLocation, formatSentencePart } from '@/lib/textHelpers';
import {
  resolveIntent as pureResolveIntent,
  isPropertyPublishingTrigger,
  IntentContext,
  IntentResult
} from '@/lib/eterna/IntentRouter';
import {
  ConversationEngine,
  ConversationIntent,
  ConversationStatus,
  ConversationSession,
  ConversationMemory,
  ConversationStep
} from '@/lib/eterna/ConversationEngine';
import { IntentClassifier } from '@/lib/eterna/IntentClassifier';
import {
  buildPropertyPresentation,
  selectEternaNearbyHighlights,
  type EternaPropertyPresentation,
} from '@/lib/eterna/actions/PropertyActions';
import { resolveMortgageQuestion } from '@/lib/eterna/actions/MortgageActions';
import type { MortgageConversationContext } from '@/lib/eterna/actions/MortgageActions';
import {
  getEternaValuationDossier,
  resolveValuationQuestion,
} from '@/lib/eterna/actions/ValuationActions';
import { MORTGAGE_SIMULATION_EVENT } from '@/lib/finance/mortgage';
import { EternaChatMessage } from '@/lib/eterna/propertySales';
import { PageAgentResponse, parsePageAgentResponse } from '@/lib/eterna/pageAgent';
import {
  captureEternaPageSnapshot,
  executeSemanticPageAction,
} from '@/lib/eterna/pageActions';
import {
  mergeSearchAnalysisIntoMemory,
  parseSearchConciergeResponse,
  SearchConciergeResponse,
} from '@/lib/eterna/searchConcierge';
import { planFastPropertySearch } from '@/lib/eterna/fastSearchPlanner';
import { useNavigationActions } from '@/lib/eterna/actions/NavigationActions';
import { useGeneralActions } from '@/lib/eterna/actions/GeneralActions';
import { Property } from '@/lib/types';
import { findPropertyByNaturalReference, findPropertyByReference } from '@/lib/searchFilters';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { parseBudgetToNumber, parseBudgetRange } from '@/lib/search/SearchEngine';
import { PropertySearchFilters } from '@/lib/search/types';
import { getPropertyPriceSnapshot } from '@/lib/search/propertyPrice';
import { searchLogger } from '@/lib/search/searchLogger';
import MicrophonePermissionDialog from '@/features/eterna/components/MicrophonePermissionDialog';
import { EternaDrawer } from '@/features/eterna/components/concierge/EternaDrawer';
import { EternaLauncher } from '@/features/eterna/components/concierge/EternaLauncher';
import {
  ensureConversationContinues,
  getConversationSuggestions,
} from '@/lib/eterna/conversationContinuity';
import {
  ETERNA_CLOSE_PROPERTY_VISUAL_EVENT,
  ETERNA_OPEN_PROPERTY_VIDEO_EVENT,
  ETERNA_SHOW_PROPERTY_VISUAL_EVENT,
  type EternaClosePropertyVisualDetail,
  type EternaPropertyVisualSection,
  type EternaShowPropertyVisualDetail,
} from '@/lib/eterna/events';
import { resolvePropertyVisualSection } from '@/lib/eterna/propertyVisuals';
import { buildEternaSystemPrompt } from '@/lib/eterna/systemPrompt';
import { getPropertyPresentationCloseDelay } from '@/lib/eterna/propertyPresentationTiming';
import {
  determineOfferingMode,
  determineOperation,
  determinePropertyType,
} from '@/lib/eterna/searchIntentResolution';
import { resolveCatalogPriceRequest } from '@/lib/eterna/actions/CatalogPriceActions';
import { resolvePropertyVisualAnswer } from '@/lib/eterna/actions/PropertyVisualActions';
import {
  clearAuthenticatedGreeting,
  consumeAuthenticatedGreeting,
  consumePropertySummaryPresentation,
  getConfirmedEternaUserName,
  getEternaFirstName,
} from '@/lib/eterna/sessionExperience';
// ────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────

import { useEternaVoice } from '@/features/eterna/hooks/useEternaVoice';
import { useMicrophonePermission } from '@/features/eterna/hooks/useMicrophonePermission';
import {
  ETERNA_SESSION_TTL_MS,
  useEternaSessionState,
} from '@/features/eterna/hooks/useEternaSessionState';
import { useThinkingContext } from '@/hooks/useThinkingContext';

type ThinkingContext = 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general';

const ETERNA_CONVERSATION_SESSION_KEY = 'eterna_conversation_session_v2';
const ETERNA_HOME_INTRO_SESSION_KEY = 'eterna_home_intro_v4';

const dispatchPropertyVisual = (
  propertyId: string,
  section: EternaPropertyVisualSection,
) => {
  window.dispatchEvent(new CustomEvent(ETERNA_SHOW_PROPERTY_VISUAL_EVENT, {
    detail: { propertyId, section },
  }));
};

const closePropertyVisual = (
  propertyId: string,
  section?: EternaPropertyVisualSection,
) => {
  window.dispatchEvent(new CustomEvent(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, {
    detail: { propertyId, section },
  }));
};

export default function EternaConcierge() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isExplorePage = pathname === '/explore';
  const isPropertyPage = pathname?.startsWith('/property/') === true;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { properties, swaps, currentUser, authProfileReady, messages, reviews, travelDetails, activeSearch, setActiveSearch } = useSwap();
  const { t, language } = useTranslation();
  const confirmedUserName = getConfirmedEternaUserName(authProfileReady, currentUser?.name);
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
  const [isPropertyVisualActive, setIsPropertyVisualActive] = useState(false);
  const [conciergeMode, setConciergeMode] = useState<'avatar' | 'chat'>('avatar');
  const touchStartY = useRef<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const [typedInput, setTypedInput] = useState('');
  const lastHandledPromptRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const mortgageConversationRef = useRef<MortgageConversationContext | null>(null);
  const {
    chatHistory,
    chatHistoryRef,
    geminiActive,
    isHydrated,
    setChatHistory,
  } = useEternaSessionState();


  const shouldBeCompactOnMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return pathname !== '/' && !pathname.startsWith('/property/');
  }, [pathname]);

  useEffect(() => {
    if (!isPropertyPage) {
      setIsPropertyVisualActive(false);
      return;
    }

    const propertyId = liveContext.property?.id;
    const handleShow = (event: Event) => {
      const detail = (event as CustomEvent<EternaShowPropertyVisualDetail>).detail;
      if (detail?.propertyId === propertyId) setIsPropertyVisualActive(true);
    };
    const handleClose = (event: Event) => {
      const detail = (event as CustomEvent<EternaClosePropertyVisualDetail>).detail;
      if (detail?.propertyId !== propertyId) return;
      setIsPropertyVisualActive(false);
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setConciergeMode('avatar');
        setIsCompact(false);
        setIsOpen(true);
      }
    };

    window.addEventListener(ETERNA_SHOW_PROPERTY_VISUAL_EVENT, handleShow);
    window.addEventListener(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, handleClose);
    return () => {
      window.removeEventListener(ETERNA_SHOW_PROPERTY_VISUAL_EVENT, handleShow);
      window.removeEventListener(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, handleClose);
    };
  }, [isPropertyPage, liveContext.property?.id]);

  // Eterna Search Concierge State



  // Conversational State Machine
  const [conversationalSession, setConversationalSession] = useState<ConversationSession>({
    activeIntent: ConversationIntent.NONE,
    status: ConversationStatus.IDLE,
    step: 'operation',
    memory: {},
    createdAt: 0,
    updatedAt: 0
  });

  const exploreRouteHasFilters = useMemo(() => {
    if (!isExplorePage) return false;
    const hasValue = (key: string) => Boolean(searchParams.get(key)?.trim());
    const offering = searchParams.get('offering')?.toUpperCase();
    const category = searchParams.get('category')?.toLowerCase();

    return Boolean(
      hasValue('search')
      || hasValue('start')
      || hasValue('end')
      || hasValue('guests')
      || (offering && offering !== 'ALL')
      || (category && category !== 'all')
      || hasValue('tier')
      || hasValue('budget')
      || hasValue('minBudget')
      || hasValue('rooms')
      || hasValue('amenity')
      || hasValue('view')
      || hasValue('age')
    );
  }, [isExplorePage, searchParams]);

  // A browser Back navigation can return to a clean explorer route while the
  // shared Eterna search session still contains the previous city/budget.
  // Treat a filter-free explorer URL as a deliberate fresh search context.
  useEffect(() => {
    if (!isExplorePage || exploreRouteHasFilters) return;

    setActiveSearch(null);
    setExploreFilters({
      category: 'All',
      offeringTab: 'ALL',
      query: '',
      guests: 0,
      swapType: 'All',
      sortBy: 'match',
    });
    setConversationalSession((previous) => {
      if (previous.activeIntent === ConversationIntent.NONE && Object.keys(previous.memory).length === 0) {
        return previous;
      }

      const resetSession: ConversationSession = {
        activeIntent: ConversationIntent.NONE,
        status: ConversationStatus.IDLE,
        step: 'operation',
        memory: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      try {
        sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
      } catch {
        // Ignore storage restrictions; in-memory state is still reset.
      }
      return resetSession;
    });
  }, [exploreRouteHasFilters, isExplorePage, setActiveSearch, setExploreFilters]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isExplorePage && !exploreRouteHasFilters) {
        sessionStorage.removeItem(ETERNA_CONVERSATION_SESSION_KEY);
        return;
      }

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
  }, [exploreRouteHasFilters, isExplorePage]);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(false);
  
  // Greeting state
  const greetingTriggeredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Gemini API REST Abort Controller Ref
  const geminiAbortControllerRef = useRef<AbortController | null>(null);
  const homeSearchAbortControllerRef = useRef<AbortController | null>(null);
  const lastPropertySummaryRef = useRef<string | null>(null);
  // Tracks navigation initiated by Eterna without bypassing the per-property
  // session rule: an automatic summary is still shown only once per tab.
  const pendingPropertyPresentationRef = useRef<string | null>(null);
  const previousAuthenticatedUserIdRef = useRef<string | null>(null);
  const authGreetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyPresentationStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyPresentationSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [propertyPresentation, setPropertyPresentation] = useState<EternaPropertyPresentation | null>(null);
  
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
    isAvatarSpeaking,
    partialTranscript,
    speechRecognitionSupported,
    handleVoiceButtonClick,
    speak,
    startVoiceMode,
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

  const openEternaChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const {
    activate: handleMicButtonClickWithPermission,
    addDebugLog,
    checking: isCheckingMicPermission,
    closeHelp: closeMicrophoneHelp,
    continueWithText: continueWithTextChat,
    dialogOpen: micPermissionDeniedOpen,
    guide: mobileBrowserGuide,
    issue: micPermissionIssue,
    recheck: recheckMicrophonePermission,
    retry: retryMicrophonePermission,
    showInstructions,
    toggleInstructions: toggleMicrophoneInstructions,
  } = useMicrophonePermission({
    geminiActive,
    inputRef,
    isConnected,
    language: language === 'es' ? 'es' : 'en',
    onOpenChat: openEternaChat,
    onStartVoiceMode: startVoiceMode,
    onVoiceButtonClick: handleVoiceButtonClick,
    simulatedStatus,
    voiceMode,
    websocketStatus: wsStatus,
  });

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

        // Keep the permission request in this same click/tap call stack. Home
        // controls call this function directly instead of deferring through a
        // React effect, which is required by several mobile browsers.
        setIsOpen(true);
        void handleMicButtonClickWithPermission();
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__eternaStartVoice;
      }
    };
  }, [voiceMode, speechRecognitionSupported, addDebugLog, handleMicButtonClickWithPermission]);

  // Re-check microphone permission when the page regains focus or visibility (returning from browser Settings)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRecheckPermission = async () => {
      await recheckMicrophonePermission();
    };

    document.addEventListener("visibilitychange", handleRecheckPermission);
    window.addEventListener("focus", handleRecheckPermission);

    return () => {
      document.removeEventListener("visibilitychange", handleRecheckPermission);
      window.removeEventListener("focus", handleRecheckPermission);
    };
  }, [recheckMicrophonePermission]);

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

  // The compact drawer is useful as a passive voice indicator, but it leaves
  // the actual conversation with too little room. Entering Chat always opens
  // the complete conversation and composer, including on narrow phones.
  useEffect(() => {
    if (isOpen && conciergeMode === 'chat' && isCompact) {
      setIsCompact(false);
    }
  }, [conciergeMode, isCompact, isOpen]);

  const latestPropertySales = useMemo(() => {
    for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
      const message = chatHistory[index];
      if (message.role === 'assistant' && message.propertySales) {
        return message.propertySales;
      }
    }
    return null;
  }, [chatHistory]);

  const clearPropertyPresentationTimers = useCallback(() => {
    if (propertyPresentationStartTimerRef.current) {
      clearTimeout(propertyPresentationStartTimerRef.current);
      propertyPresentationStartTimerRef.current = null;
    }
    if (propertyPresentationSafetyTimerRef.current) {
      clearTimeout(propertyPresentationSafetyTimerRef.current);
      propertyPresentationSafetyTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearPropertyPresentationTimers();
    if (authGreetingTimerRef.current) {
      clearTimeout(authGreetingTimerRef.current);
      authGreetingTimerRef.current = null;
    }
  }, [clearPropertyPresentationTimers]);

  const closeEternaCompletely = useCallback(() => {
    clearPropertyPresentationTimers();
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
    setPropertyPresentation(null);
    setIsOpen(false);
  }, [clearPropertyPresentationTimers, interrupt, interruptVoice, isConnected, stopVoiceMode]);

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
      userName: confirmedUserName || 'Usuario',
      swaps,
      properties,
      currentUser,
      messages,
      reviews,
      travelDetails: travelDetails || [],
    };
  }, [properties, swaps, messages, reviews, currentUser, confirmedUserName, travelDetails]);

  const contextBridgeJSON = useMemo(() => {
    const myProps = properties.filter(p => p.hostId === currentUser?.id);
    const activeTrips = swaps.filter(s =>
      ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status) &&
      (s.senderId === currentUser?.id || s.receiverId === currentUser?.id)
    );
    const myReviews = reviews.filter(r => r.reviewedUserId === currentUser?.id);

    return JSON.stringify({
      user: confirmedUserName || 'Usuario',
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
  }, [properties, swaps, reviews, currentUser, confirmedUserName, intentContext]);

  // 1. Zero-Configuration RAG Auto-Syncing disabled for LOCAL ONLY MODE
  useEffect(() => {
    // RAG and FastAPI are frozen in Local Only Mode.
  }, []);

  // 1.5 Robust Auto-connection disabled for LOCAL ONLY MODE
  // WebSockets and FastAPI are frozen. Operating in Local Only Mode.



  // ────────────────────────────────────────────────
  // CONTEXT-AWARE SYSTEM PROMPT (with Context Bridge)
  // ────────────────────────────────────────────────

  const systemPrompt = useMemo(() => buildEternaSystemPrompt({
    contextBridgeJson: contextBridgeJSON,
    currentPage: pathname || '/',
    language: language === 'es' ? 'es' : 'en',
    userName: confirmedUserName,
  }), [confirmedUserName, contextBridgeJSON, language, pathname]);



  // ────────────────────────────────────────────────
  // INTENT ROUTER — Resolves actions without LLM
  // ────────────────────────────────────────────────

  const resolveIntent = useCallback((prompt: string): IntentResult => {
    return pureResolveIntent(prompt, intentContext, language);
  }, [intentContext, language]);

  // Greet an authenticated user once per login session, after leaving the
  // login screen. The name comes from the live Supabase profile/session and
  // the marker is cleared on logout so the next login receives a new welcome.
  useEffect(() => {
    const previousUserId = previousAuthenticatedUserIdRef.current;

    if (!currentUser) {
      if (authGreetingTimerRef.current) {
        clearTimeout(authGreetingTimerRef.current);
        authGreetingTimerRef.current = null;
      }
      if (previousUserId) {
        clearAuthenticatedGreeting(sessionStorage, previousUserId);
      }
      previousAuthenticatedUserIdRef.current = null;
      return;
    }

    previousAuthenticatedUserIdRef.current = currentUser.id;
    if (!authProfileReady) return;
    if (pathname === '/login' || isPropertyPage) return;
    if (!consumeAuthenticatedGreeting(sessionStorage, currentUser.id)) return;

    const firstName = getEternaFirstName(currentUser.name, currentUser.email);
    const greeting = language === 'es'
      ? `Hola${firstName ? ` ${firstName}` : ''}. Soy Eterna y estoy lista para acompañarte a encontrar, comparar o revisar una propiedad. ¿Qué te gustaría hacer primero?`
      : `Hi${firstName ? ` ${firstName}` : ''}. I’m Eterna, ready to help you find, compare, or review a property. What would you like to do first?`;

    setChatHistory((previous) => [
      ...previous,
      { role: 'assistant', content: greeting },
    ]);
    setConciergeMode('avatar');

    authGreetingTimerRef.current = setTimeout(() => {
      authGreetingTimerRef.current = null;
      setSimulatedStatus('talking');
      speak(greeting, () => setSimulatedStatus('idle'));
    }, 450);
  }, [
    authProfileReady,
    currentUser,
    isPropertyPage,
    language,
    pathname,
    setChatHistory,
    speak,
  ]);

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
  }, [chatHistoryRef, currentUser?.id, systemPrompt.content]);
  // Present each property as a short guided arrival. The route/language key
  // prevents Strict Mode and nearby-place refreshes from replaying the speech.
  useEffect(() => {
    const activeProperty = liveContext.property;
    const presentationKey = activeProperty
      ? `${activeProperty.id}:${language === 'es' ? 'es' : 'en'}`
      : null;

    if (isPropertyPage && activeProperty && presentationKey) {
      const isPendingNavigation = pendingPropertyPresentationRef.current === activeProperty.id;
      if (lastPropertySummaryRef.current === presentationKey && !isPendingNavigation) {
        return;
      }

      clearPropertyPresentationTimers();
      lastPropertySummaryRef.current = presentationKey;
      if (isPendingNavigation) {
        pendingPropertyPresentationRef.current = null;
      }

      if (!consumePropertySummaryPresentation(sessionStorage, activeProperty.id)) {
        clearPropertyPresentationTimers();
        lastPropertySummaryRef.current = presentationKey;
        pendingPropertyPresentationRef.current = null;
        setPropertyPresentation(null);
        closePropertyVisual(activeProperty.id, 'summary');
        return;
      }

      const presentation = buildPropertyPresentation(
        activeProperty,
        language === 'es' ? 'es' : 'en',
        0,
      );
      let audibleSpeechStartedAt: number | null = null;
      const finishPresentation = () => {
        if (lastPropertySummaryRef.current !== presentationKey) return;
        clearPropertyPresentationTimers();
        closePropertyVisual(activeProperty.id, 'summary');
        setIsCompact(false);
        setPropertyPresentation(null);
      };
      const finishAfterSpeechAttempt = () => {
        if (lastPropertySummaryRef.current !== presentationKey) return;

        const delayMs = getPropertyPresentationCloseDelay({
          audibleSpeechStartedAt,
          endedAt: Date.now(),
        });

        // `speak` also ends when both audio engines are unavailable. In that
        // case keep the visual summary readable instead of closing it as if a
        // narration had completed successfully.
        if (propertyPresentationSafetyTimerRef.current) {
          clearTimeout(propertyPresentationSafetyTimerRef.current);
        }
        propertyPresentationSafetyTimerRef.current = setTimeout(finishPresentation, delayMs);
      };

      dispatchPropertyVisual(activeProperty.id, 'summary');
      setPropertyPresentation(presentation);
      setConciergeMode('avatar');
      setShowTooltip(false);
      setIsCompact(false);
      setIsOpen(window.matchMedia('(min-width: 1024px)').matches);
      setChatHistory((previous) => (
        previous.some((message) => message.role === 'assistant' && message.content === presentation.speech)
          ? previous
          : [...previous, { role: 'assistant', content: presentation.speech }]
      ));

      propertyPresentationStartTimerRef.current = setTimeout(() => {
        speak(presentation.speech, finishAfterSpeechAttempt, {
          onStart: () => {
            audibleSpeechStartedAt = Date.now();
          },
        });
      }, 650);

      // Browser speech events are not perfectly reliable. Never leave the
      // presentation blocking the listing if an engine omits its end event.
      propertyPresentationSafetyTimerRef.current = setTimeout(finishPresentation, 36_000);
    } else if (!isPropertyPage) {
      clearPropertyPresentationTimers();
      lastPropertySummaryRef.current = null;
      setPropertyPresentation(null);
    }
  }, [
    clearPropertyPresentationTimers,
    isPropertyPage,
    language,
    liveContext.property,
    setChatHistory,
    speak,
  ]);

  // ────────────────────────────────────────────────
  // PERSONALIZED AUTO-GREETING on panel open
  // ────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && authProfileReady && !greetingTriggeredRef.current && chatHistory.length === 0 && currentUser) {
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
  }, [authProfileReady, chatHistory.length, chatHistoryRef, currentUser, intentContext, isOpen, language, setChatHistory, speak]);

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
      setChatHistory(prev => [...prev, { role: 'assistant', content: textResponse }]);
    }
  }, [isConnected, setChatHistory, textResponse, wsStatus]);

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
    if (currentUser && authProfileReady && pending) {
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
  }, [authProfileReady, currentUser, getCatalogMessage, language, liveContext.eterna.pendingIntent, router, setActiveGuidedFlow, setChatHistory, setPendingIntent, speak]);

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
    const promptHistory = conversationalSession.activeIntent === ConversationIntent.NONE
      ? userPrompt
      : chatHistory.filter(h => h.role === 'user').map(h => h.content).join(' ') + ' ' + userPrompt;
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
      sort: searchMemory.sort?.value || 'best_match',
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
      if (appliedFilters.sort === 'price_asc' || appliedFilters.sort === 'price_desc') {
        url += `&sort=${appliedFilters.sort}`;
      }
      return url;
    };

    const navigateToExplore = (appliedFilters: PropertySearchFilters) => {
      setExploreFilters({
        category: type || 'All',
        offeringTab: offeringMode,
        query: appliedFilters.city || city,
        guests: 0,
        swapType: 'All',
        sortBy: appliedFilters.sort === 'price_asc' || appliedFilters.sort === 'price_desc'
          ? appliedFilters.sort
          : 'match',
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
    // Mantén el acuse visible, pero sintetiza una sola locución cuando ya
    // conozcamos el resultado. Dos llamadas seguidas cancelaban el primer
    // audio de Fish y obligaban a generar la respuesta completa dos veces.
    setSimulatedStatus('thinking');

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
      const exactResults = searchResult.results || [];
      const exactMatchCount = exactResults.length;
      let results = exactResults;
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
      if (exactMatchCount > 0) {
        const resultLabel = language === 'es'
          ? (exactMatchCount === 1 ? 'una propiedad' : `${exactMatchCount} propiedades`)
          : (exactMatchCount === 1 ? 'one property' : `${exactMatchCount} properties`);
        const priceCondition = minBudgetVal !== undefined && budgetVal !== undefined
          ? (language === 'es' ? ' dentro del rango de precio que indicaste' : ' within your requested price range')
          : minBudgetVal !== undefined
          ? (language === 'es' ? ' por encima del presupuesto mínimo que indicaste' : ' above your requested minimum budget')
          : budgetVal !== undefined
          ? (language === 'es' ? ' dentro de tu presupuesto máximo' : ' within your maximum budget')
          : '';

        if (isHome) {
          // Home keeps the welcoming catalog handoff instead of sounding like
          // a property-page navigation acknowledgement.
          searchMsg = language === 'es'
            ? `Aquí están las propuestas que encontré en ${city || 'el catálogo'}: ${resultLabel}${priceCondition}. Te las muestro en el explorador.`
            : `Here are the listings I found in ${city || 'the catalog'}: ${resultLabel}${priceCondition}. I am showing them in the explorer.`;
        } else {
          searchMsg = language === 'es'
            ? `Encontré ${resultLabel} en ${city || 'el catálogo'}${priceCondition}. Te muestro las coincidencias en el explorador.`
            : `I found ${resultLabel} in ${city || 'the catalog'}${priceCondition}. I am showing the matches in the explorer.`;
        }
      } else if (hasResults && isAlternative) {
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
        searchMsg = language === 'es'
          ? `No he encontrado coincidencias para tu búsqueda en ${city}, pero te mostraré algunas alternativas en el explorador.`
          : `I did not find matches for your search in ${city}, but I will show you some alternatives in the explorer.`;
      }

      const continuousSearchMsg = ensureConversationContinues(
        searchMsg,
        language === 'es' ? 'es' : 'en',
        'search',
      );
      if (continuousSearchMsg !== immediateSearchMessage) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: continuousSearchMsg,
          suggestedReplies: getConversationSuggestions(language === 'es' ? 'es' : 'en', 'search'),
        }]);
      }
      setSimulatedStatus('talking');
      speak(continuousSearchMsg, () => setSimulatedStatus('idle'));

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
      const searchErrorMessage = language === 'es'
        ? 'No pude consultar el catálogo en este instante. Ya abrí el explorador para que puedas continuar y puedo intentarlo de nuevo contigo.'
        : 'I could not query the catalog right now. I opened the explorer so you can continue, and I can try again with you.';
      setChatHistory(previous => [...previous, {
        role: 'assistant',
        content: searchErrorMessage,
        suggestedReplies: language === 'es' ? ['Intentar de nuevo'] : ['Try again'],
      }]);
      setSimulatedStatus('talking');
      speak(searchErrorMessage, () => setSimulatedStatus('idle'));
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
    isHome,
    language,
    chatHistory,
    conversationalSession,
    setThinkingContext,
    setChatHistory,
    setSimulatedStatus,
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
  }, [chatHistoryRef, currentUser?.id]);

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

      const propertyRouteMatch = route.match(/^\/property\/([^/?#]+)/);
      if (propertyRouteMatch) {
        pendingPropertyPresentationRef.current = decodeURIComponent(propertyRouteMatch[1]);
      }

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

    if (action.type === 'open_property_location') {
      if (!liveContext.property) return { status: 'not_found' as const, target: 'property location' };
      dispatchPropertyVisual(liveContext.property.id, 'location');
      setConciergeMode('avatar');
      setIsCompact(false);
      setIsOpen(window.matchMedia('(min-width: 1024px)').matches);
      return { status: 'completed' as const, target: 'property location' };
    }

    if (action.type === 'open_property_video') {
      const property = liveContext.property;
      const hasVideo = property?.media?.some((media) => (
        ['VIDEO', 'YOUTUBE', 'VIMEO', 'DRONE'].includes(media.mediaType)
      ));
      if (!property || !hasVideo) return { status: 'not_found' as const, target: 'property video' };

      window.dispatchEvent(new CustomEvent(ETERNA_OPEN_PROPERTY_VIDEO_EVENT, {
        detail: { propertyId: property.id },
      }));
      setIsOpen(false);
      return { status: 'completed' as const, target: 'property video' };
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
    if (window.innerWidth < 768 && !isPropertyPage && result.status === 'completed') {
      setIsCompact(true);
      setIsOpen(true);
    }
    return result;
  }, [
    currentUser,
    isPropertyPage,
    liveContext.property,
    navigateToRoute,
    openPropertyContact,
    pathname,
    router,
    searchParams,
    setActiveGuidedFlow,
    setConciergeMode,
    setIsCompact,
    setIsOpen,
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

    // A browser recognition restart or a duplicated custom event can deliver
    // the same prompt twice. Ignore only exact repeats inside a short window;
    // repeating a question later remains fully supported.
    const normalizedPrompt = prompt
      .toLocaleLowerCase('es-MX')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const promptNow = Date.now();
    if (
      normalizedPrompt
      && normalizedPrompt === lastHandledPromptRef.current.text
      && promptNow - lastHandledPromptRef.current.at < 3_500
    ) {
      console.warn('[Eterna] Prompt duplicado ignorado:', prompt);
      return;
    }
    lastHandledPromptRef.current = { text: normalizedPrompt, at: promptNow };

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

    // Publishing is a navigation command, not a request to search listings
    // whose commercial operation happens to be "sale". Resolve it before
    // property references, the fast search planner and the general AI agent.
    if (isPropertyPublishingTrigger(prompt)) {
      setThinkingContext('publish_property');
      if (currentUser) {
        const responseMsg = language === 'es'
          ? 'Perfecto. Vamos a publicar tu propiedad; abriré el registro guiado para acompañarte paso a paso.'
          : 'Perfect. Let’s publish your property; I’ll open the guided form and walk you through it step by step.';
        setChatHistory(prev => [...prev, { role: 'assistant', content: responseMsg }]);
        setSimulatedStatus('talking');
        speak(responseMsg, () => setSimulatedStatus('idle'));
      }
      navigateToRoute('/dashboard?tab=properties', prompt, 'publish_property');
      return;
    }

    const searchCandidates = activeSearch?.results?.length
      ? activeSearch.results
      : properties;
    const referencedProperty = findPropertyByReference(properties, prompt)
      // Natural references are resolved only from the Explorer. This keeps
      // Home's catalog-search response (“Aquí están las propuestas…”) intact,
      // while allowing “ese de Tres Ríos”, “me gusta el departamento” and
      // ordinal selections to open the matching visible card directly.
      || (isExplorePage
        ? findPropertyByNaturalReference(properties, prompt, searchCandidates)
        : undefined);
    if (referencedProperty) {
      const reference = referencedProperty.internalCode || referencedProperty.shortCode || referencedProperty.id;
      const location = formatPropertyLocation(referencedProperty.location, referencedProperty.country);
      const reply = language === 'es'
        ? `Encontré el folio ${reference}: “${referencedProperty.title}”, en ${location}. Voy a abrir la propiedad para que la revisemos juntos.`
        : `I found reference ${reference}: “${referencedProperty.title}” in ${location}. I’ll open the listing so we can review it together.`;

      pendingPropertyPresentationRef.current = referencedProperty.id;
      // From the explorer, the arrival presentation is the response. Avoid
      // speaking a navigation acknowledgement immediately before the property
      // page starts its own guided summary; otherwise the two voices overlap
      // and the first sentence is cut off.
      if (!isExplorePage) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: reply,
          route: `/property/${referencedProperty.id}`,
        }]);
        speak(reply, () => setSimulatedStatus('idle'));
      }
      router.push(`/property/${referencedProperty.id}`);
      return;
    }

    // ── LOCAL PROPERTY QA ROUTER ──
    const activeProperty = liveContext.property;
    const activePropertyVideos = activeProperty?.media?.filter((media) => (
      ['VIDEO', 'YOUTUBE', 'VIMEO', 'DRONE'].includes(media.mediaType)
    )) || [];
    const currentPropertyId = activeProperty?.id || liveContext.propertyPage?.propertyId || null;

    // Property answers should be visible as well as spoken. This local router
    // opens the matching evidence panel immediately, before any network/model
    // response completes. Only the summary is dismissed when speech ends.
    const requestedVisualSection = activeProperty
      ? resolvePropertyVisualSection(prompt, [
          ...(activeProperty.amenities || []),
          ...((activeProperty.metadata?.customAmenities as string[] | undefined) || []),
        ])
      : null;
    if (activeProperty && requestedVisualSection) {
      dispatchPropertyVisual(activeProperty.id, requestedVisualSection);
      setConciergeMode('avatar');
      setIsCompact(false);
      setIsOpen(window.matchMedia('(min-width: 1024px)').matches);
    }

    const activePropertyTitle = activeProperty
      ? t(`properties.${activeProperty.id}.title`, undefined, activeProperty.title)
      : null;

    const activePropertyDescription = activeProperty
      ? t(`properties.${activeProperty.id}.description`, undefined, activeProperty.description)
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
        multimedia: {
          cantidadVideos: activePropertyVideos.length,
          tiposVideo: activePropertyVideos.map((media) => media.mediaType),
        },
        entornoGoogle: selectEternaNearbyHighlights(activeProperty.nearbyPlaces || []).map((place) => ({
          categoria: place.category,
          nombre: place.name,
          tiempoEnAutoMinutos: place.drivingMinutes,
        })),
        expedienteJuridico: legalStatus,
        modalidadesYMetodosPago: paymentMethods,
        responsableComercial: {
          nombre: activeProperty.hostName || "Responsable de la propiedad",
          verificado: activeProperty.hostVerified,
          tipo: activeProperty.legalOwnerType || "No especificado",
          horarioPreferido: activeProperty.ownerContactTime || "No especificado",
        },
        estimacionAutomatizadaTowers: getEternaValuationDossier(activeProperty),
      }, null, 2);
    }

    // High-confidence catalog searches do not need a round trip to the LLM.
    // This preserves context across turns and makes the most common flow feel
    // immediate, while Gemini remains responsible for nuanced conversation,
    // property advice and page actions.
    if (!activeProperty) {
      // Price comparisons on the Explorer are resolved against the exact
      // visible result set. This prevents the language model from claiming it
      // cannot see prices that are already present in the catalog and keeps
      // lowest/highest/range answers auditable.
      if (isExplorePage && activeSearch?.results?.length) {
        const catalogPriceAnswer = resolveCatalogPriceRequest({
          prompt,
          properties: activeSearch.results,
          catalogProperties: properties,
          operation: activeSearch.filters.operation,
          language: language === 'es' ? 'es' : 'en',
        });

        if (catalogPriceAnswer) {
          if (catalogPriceAnswer.orderedPropertyIds.length > 0) {
            const order = new Map(
              catalogPriceAnswer.orderedPropertyIds.map((propertyId, index) => [propertyId, index]),
            );
            setActiveSearch((previous) => previous ? {
              ...previous,
              filters: catalogPriceAnswer.sort
                ? { ...previous.filters, sort: catalogPriceAnswer.sort }
                : previous.filters,
              results: [...previous.results].sort((left, right) => (
                (order.get(left.id) ?? Number.MAX_SAFE_INTEGER)
                - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
              )),
            } : previous);
          }
          if (catalogPriceAnswer.sort) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('sort', catalogPriceAnswer.sort);
            router.replace(`/explore?${params.toString()}`);
            if (liveContext.explore) {
              setExploreFilters({
                ...liveContext.explore,
                sortBy: catalogPriceAnswer.sort,
              });
            }
          }

          setThinkingContext('property_search');
          setChatHistory((previous) => [...previous, {
            role: 'assistant',
            content: catalogPriceAnswer.reply,
            suggestedReplies: catalogPriceAnswer.suggestedReplies,
          }]);
          setSimulatedStatus('talking');
          speak(catalogPriceAnswer.speech, () => setSimulatedStatus('idle'));
          return;
        }
      }

      const plannerMemory: ConversationMemory = { ...conversationalSession.memory };
      if (isExplorePage && activeSearch) {
        if (!plannerMemory.city && activeSearch.filters.city) {
          plannerMemory.city = { value: activeSearch.filters.city, confidence: 1 };
        }
        if (!plannerMemory.operation && activeSearch.filters.operation) {
          plannerMemory.operation = { value: activeSearch.filters.operation, confidence: 1 };
        }
        if (!plannerMemory.propertyType && activeSearch.filters.type) {
          const normalizedType = activeSearch.filters.type.toLocaleLowerCase('es-MX');
          if (normalizedType.includes('casa')) {
            plannerMemory.propertyType = { value: 'casa', confidence: 1 };
          } else if (normalizedType.includes('departamento')) {
            plannerMemory.propertyType = { value: 'departamento', confidence: 1 };
          }
        }
        if (!plannerMemory.budget) {
          const minimum = activeSearch.filters.minBudget;
          const maximum = activeSearch.filters.budget;
          if (minimum && maximum) {
            plannerMemory.budget = { value: `entre ${minimum} y ${maximum}`, confidence: 1 };
          } else if (minimum) {
            plannerMemory.budget = { value: `desde ${minimum}`, confidence: 1 };
          } else if (maximum) {
            plannerMemory.budget = { value: `hasta ${maximum}`, confidence: 1 };
          }
        }
        if (!plannerMemory.rooms && activeSearch.filters.rooms) {
          plannerMemory.rooms = { value: activeSearch.filters.rooms, confidence: 1 };
        }
      }

      const fastSearchPlan = planFastPropertySearch({
        prompt,
        currentMemory: plannerMemory,
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

    const cleanPropertyPrompt = normalizedPrompt;
    const requestsVideoExperience = Boolean(
      activeProperty
      && (
        /\b(?:muestrame|ensename|quiero ver|abre|abrir|reproduce|reproducir|pon|ver)\b.*\b(?:video|videos|tour en video|recorrido en video)\b/.test(cleanPropertyPrompt)
        || /\b(?:video|videos|tour en video|recorrido en video)\b.*\b(?:muestrame|ensename|abre|abrir|reproduce|reproducir|pon|ver)\b/.test(cleanPropertyPrompt)
        || /\b(?:show|open|play|watch)\b.*\b(?:video|videos|video tour)\b/.test(cleanPropertyPrompt)
      )
    );

    if (activeProperty && requestsVideoExperience) {
      const hasVideo = activePropertyVideos.length > 0;
      const videoReply = hasVideo
        ? (language === 'es'
            ? `El expediente incluye ${activePropertyVideos.length === 1 ? 'un recorrido publicado' : `${activePropertyVideos.length} recorridos publicados`} para que observes mejor la distribución y los acabados. Puedes reproducirlo y cerrar el visor cuando quieras. ¿Quieres que después revisemos la ubicación o las amenidades?`
            : `The listing includes ${activePropertyVideos.length === 1 ? 'one published tour' : `${activePropertyVideos.length} published tours`} so you can examine the layout and finishes more closely. You can play it and close the viewer whenever you want. Would you like to review the location or amenities afterward?`)
        : (language === 'es'
            ? 'Esta propiedad no tiene videos publicados por ahora. La galería de fotografías sí permite revisar sus espacios y acabados, y el mapa muestra el entorno disponible. Puedo abrir cualquiera de esas dos secciones sin perder esta conversación. ¿Prefieres ver las fotos o la ubicación?'
            : 'This property does not have any published videos yet. Its photo gallery still lets you review the spaces and finishes, while the map shows the available neighborhood context. I can open either section without losing this conversation. Would you prefer the photos or the location?');

      setThinkingContext('property_detail');
      setChatHistory((previous) => [...previous, {
        role: 'assistant',
        content: videoReply,
        suggestedReplies: hasVideo
          ? (language === 'es' ? ['Ver ubicación', 'Revisar amenidades'] : ['View location', 'Review amenities'])
          : (language === 'es' ? ['Ver fotos', 'Ver ubicación'] : ['View photos', 'View location']),
      }]);
      setSimulatedStatus('talking');
      if (hasVideo) {
        window.dispatchEvent(new CustomEvent(ETERNA_OPEN_PROPERTY_VIDEO_EVENT, {
          detail: { propertyId: activeProperty.id },
        }));
        setIsOpen(false);
      }
      speak(videoReply, () => setSimulatedStatus('idle'));
      return;
    }

    const requestsLocationExperience = Boolean(
      activeProperty
      && (
        /\b(?:muestrame|ensename|quiero ver|abre|abrir|ver)\b.*\b(?:ubicacion|mapa|entorno|lugares cercanos|alrededores)\b/.test(cleanPropertyPrompt)
        || /\b(?:ubicacion|mapa|lugares cercanos|alrededores)\b.*\b(?:muestrame|ensename|abre|abrir|ver)\b/.test(cleanPropertyPrompt)
      )
    );

    if (activeProperty && requestsLocationExperience) {
      const nearbyHighlights = selectEternaNearbyHighlights(activeProperty.nearbyPlaces || []).slice(0, 2);
      const nearbySentence = nearbyHighlights.length > 0
        ? (language === 'es'
            ? `Como referencias verificadas aparecen ${nearbyHighlights.map((place) => `${place.name}, a ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minuto' : 'minutos'} en auto`).join(', y ')}.`
            : `Verified nearby references include ${nearbyHighlights.map((place) => `${place.name}, ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minute' : 'minutes'} by car`).join(', and ')}.`)
        : (language === 'es'
            ? 'El mapa conserva la ubicación publicada y permite explorar visualmente el entorno disponible.'
            : 'The map preserves the published location and lets you explore the available neighborhood context visually.');
      const locationReply = language === 'es'
        ? `${nearbySentence} Así puedes valorar la conectividad de la zona sin salir de la ficha. ¿Quieres que revisemos escuelas, servicios o algún punto del entorno en particular?`
        : `${nearbySentence} This lets you assess the area's connectivity without leaving the listing. Would you like to review schools, services, or a specific nearby place?`;
      setThinkingContext('property_detail');
      setChatHistory((previous) => [...previous, {
        role: 'assistant',
        content: locationReply,
        suggestedReplies: language === 'es'
          ? ['Hospitales cercanos', 'Escuelas cercanas', 'Supermercados cercanos']
          : ['Nearby hospitals', 'Nearby schools', 'Nearby supermarkets'],
      }]);
      setSimulatedStatus('talking');
      dispatchPropertyVisual(activeProperty.id, 'location');
      setConciergeMode('avatar');
      setIsCompact(false);
      setIsOpen(window.matchMedia('(min-width: 1024px)').matches);
      speak(locationReply, () => setSimulatedStatus('idle'));
      return;
    }

    // Core valuation figures are deterministic and auditable. Answer them
    // before Gemini so the model can never confuse the listing price with the
    // Towers estimate, improvise a range, or describe an automated estimate as
    // an official appraisal. A separate speech string keeps %, m² and currency
    // notation natural for TTS without changing the visual chat response.
    if (activeProperty) {
      const valuationAnswer = resolveValuationQuestion(
        prompt,
        activeProperty,
        language === 'es' ? 'es' : 'en',
      );

      if (valuationAnswer) {
        let valuationReply = valuationAnswer.reply;
        let valuationSpeech = valuationAnswer.speech;
        const asksForEvidence = /metodolog|fuentes?|datos oficiales|shf|inegi|c[oó]mo (?:se )?calcul/i.test(prompt);

        if (asksForEvidence) {
          try {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 3_500);
            const response = await fetch('/api/valuation/knowledge', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: prompt, limit: 4 }),
              signal: controller.signal,
            });
            window.clearTimeout(timeout);
            const payload = await response.json() as {
              sources?: Array<{ name?: unknown }>;
            };
            const sourceNames = [...new Set((payload.sources || [])
              .map((source) => typeof source.name === 'string' ? source.name.trim() : '')
              .filter(Boolean))]
              .slice(0, 2);
            if (sourceNames.length > 0) {
              const evidenceSentence = language === 'es'
                ? ` La base documental consultada incluye ${sourceNames.join(' y ')}.`
                : ` The retrieved official evidence includes ${sourceNames.join(' and ')}.`;
              const insertBeforeLastQuestion = (value: string): string => {
                const questionIndex = Math.max(value.lastIndexOf(' ¿'), value.lastIndexOf(' Would'));
                return questionIndex > 0
                  ? `${value.slice(0, questionIndex).trim()}${evidenceSentence}${value.slice(questionIndex)}`
                  : `${value}${evidenceSentence}`;
              };
              valuationReply = insertBeforeLastQuestion(valuationReply);
              valuationSpeech = insertBeforeLastQuestion(valuationSpeech);
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
              console.warn('[Eterna Concierge] Official valuation knowledge unavailable.', error);
            }
          }
        }

        setThinkingContext('property_detail');
        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: valuationReply,
          suggestedReplies: valuationAnswer.suggestedReplies,
        }]);
        setSimulatedStatus('talking');
        speak(valuationSpeech, () => setSimulatedStatus('idle'));
        return;
      }
    }

    // Mortgage questions are deterministic and must run before the general AI
    // agent so the figure is immediate, auditable, and identical to the UI.
    if (activeProperty) {
      const mortgageAnswer = resolveMortgageQuestion(
        prompt,
        activeProperty,
        language === 'es' ? 'es' : 'en',
        mortgageConversationRef.current,
      );

      if (mortgageAnswer) {
        const mortgageReply = ensureConversationContinues(
          mortgageAnswer.reply,
          language === 'es' ? 'es' : 'en',
          'property',
        );
        mortgageConversationRef.current = mortgageAnswer.scenario;
        window.dispatchEvent(new CustomEvent(MORTGAGE_SIMULATION_EVENT, {
          detail: mortgageAnswer.scenario,
        }));
        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: mortgageReply,
          suggestedReplies: mortgageAnswer.suggestedReplies,
        }]);
        setSimulatedStatus('talking');
        speak(mortgageReply, () => setSimulatedStatus('idle'));
        return;
      }
    }

    // Visual property sections are backed by structured listing data. Resolve
    // their overview locally so the panel and Fish Audio can start together,
    // instead of waiting for a second AI round trip before narration begins.
    // Specialized video, location, valuation, and mortgage flows above still
    // take precedence whenever their richer deterministic action applies.
    if (activeProperty && requestedVisualSection) {
      const visualAnswer = resolvePropertyVisualAnswer({
        language: language === 'es' ? 'es' : 'en',
        prompt,
        property: activeProperty,
        section: requestedVisualSection,
      });

      if (visualAnswer) {
        setThinkingContext('property_detail');
        setChatHistory((previous) => [...previous, {
          role: 'assistant',
          content: visualAnswer.reply,
          suggestedReplies: visualAnswer.suggestedReplies,
        }]);
        setSimulatedStatus('talking');
        speak(visualAnswer.speech, () => setSimulatedStatus('idle'));
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

        const pageContext = {
          ...captureEternaPageSnapshot({
            route: liveContext.currentUrl,
            dashboard: liveContext.dashboard,
            wizard: liveContext.wizard,
            explore: liveContext.explore,
            exploreCatalog: activeSearch
              ? {
                  filters: activeSearch.filters,
                  results: activeSearch.results.slice(0, 12).map((property) => {
                    const price = getPropertyPriceSnapshot(property, activeSearch.filters.operation);
                    return {
                      id: property.id,
                      title: property.title,
                      type: property.type,
                      location: property.location,
                      city: property.city,
                      operation: property.primaryOperation,
                      priceAmount: price?.amount ?? null,
                      currency: price?.currency ?? null,
                      offeringMode: price?.mode ?? null,
                      billingPeriod: price?.billingPeriod ?? null,
                    };
                  }),
                }
              : null,
            propertyPage: liveContext.propertyPage,
            auth: liveContext.auth,
            activeGuidedFlow: liveContext.eterna.activeGuidedFlow,
            accountSummary: contextBridgeJSON,
            currentPropertyDossier: activePropertyDossier,
            currentSearchMemory: conversationalSession.memory,
          }),
          requestedPropertyVisualSection: requestedVisualSection,
        };
        const rawPageDecision = await requestPageAgentResponse(prompt, pageContext);
        const continuationContext = activeProperty
          ? 'property'
          : rawPageDecision.intent === 'property_search'
          ? 'search'
          : 'general';
        const pageDecision: PageAgentResponse = {
          ...rawPageDecision,
          reply: ensureConversationContinues(
            rawPageDecision.reply,
            language === 'es' ? 'es' : 'en',
            continuationContext,
          ),
          suggestedReplies: rawPageDecision.suggestedReplies.length > 0
            ? rawPageDecision.suggestedReplies
            : getConversationSuggestions(language === 'es' ? 'es' : 'en', continuationContext),
        };
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

        const isDirectPropertyNavigationFromExplore = Boolean(
          isExplorePage
          && pageDecision.action.type === 'navigate'
          && /^\/property\/[a-zA-Z0-9-]+(?:[/?].*)?$/.test(pageDecision.action.route),
        );

        if (!isDirectPropertyNavigationFromExplore) {
          setChatHistory((previous) => [...previous, {
            role: 'assistant',
            content: pageDecision.reply,
            propertySales,
            suggestedReplies: propertySales ? undefined : pageDecision.suggestedReplies,
          }]);
          setSimulatedStatus('talking');
          speak(pageDecision.reply, () => setSimulatedStatus('idle'));
        }

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
        ? 'En Towers México te ayudamos a estimar el valor de tu propiedad analizando los precios del mercado en tu zona. Puedes ver los detalles en tu panel de control.'
        : 'At Towers México, we help you estimate your property value by analyzing market prices in your area. You can see the details in your dashboard.';

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
  const handleSendEvent = useEffectEvent((text?: string) => {
    void handleSend(text);
  });

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
      handleSendEvent(text);
    };
    const handleOpenCard = () => {
      setIsOpen(true);
      if (isPropertyPage) {
        setIsCompact(false);
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
  }, [isConnected, interrupt, stopVoiceMode, interruptVoice, voiceMode, isPropertyPage]);

  // Synchronize local states to LiveContext (Theme/Chat sync)
  useEffect(() => {
    const isCollectingPropertySearch = (
      conversationalSession.activeIntent === ConversationIntent.PROPERTY_SEARCH
      && conversationalSession.status === ConversationStatus.COLLECTING
    );
    const memory = conversationalSession.memory;
    const filters = activeSearch?.filters;
    const preferences = [
      memory.pool?.value ? (language === 'es' ? 'Alberca' : 'Pool') : null,
      memory.garden?.value ? (language === 'es' ? 'Jardín' : 'Garden') : null,
      memory.pets?.value ? (language === 'es' ? 'Acepta mascotas' : 'Pet friendly') : null,
      memory.oceanView?.value ? (language === 'es' ? 'Vista al mar' : 'Ocean view') : null,
      memory.preferences?.value,
      memory.extras?.value,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    setEternaChatState({
      isOpen,
      isListening,
      voiceMode,
      isVoiceStarting: isCheckingMicPermission,
      isAvatarSpeaking,
      status: activeStatus,
      chatHistory,
      searchBrief: {
        status: activeSearch?.loading
          ? 'searching'
          : isCollectingPropertySearch
            ? 'collecting'
            : activeSearch?.error
              ? 'error'
              : activeSearch
                ? 'ready'
                : 'idle',
        operation: isCollectingPropertySearch
          ? memory.operation?.value
          : filters?.operation || memory.operation?.value,
        city: isCollectingPropertySearch
          ? memory.zone?.value || memory.city?.value
          : filters?.city || memory.zone?.value || memory.city?.value,
        propertyType: isCollectingPropertySearch
          ? memory.propertyType?.value
          : filters?.type || memory.propertyType?.value,
        budget: isCollectingPropertySearch
          ? memory.budget?.value
          : filters?.budget ?? memory.budget?.value,
        minBudget: isCollectingPropertySearch ? undefined : filters?.minBudget,
        rooms: isCollectingPropertySearch
          ? memory.rooms?.value
          : filters?.rooms ?? memory.rooms?.value,
        preferences,
        resultCount: isCollectingPropertySearch ? 0 : activeSearch?.results.length || 0,
      },
    });
  }, [
    activeSearch,
    activeStatus,
    chatHistory,
    conversationalSession.activeIntent,
    conversationalSession.memory,
    conversationalSession.status,
    isAvatarSpeaking,
    isCheckingMicPermission,
    isListening,
    isOpen,
    language,
    setEternaChatState,
    voiceMode,
  ]);

  // Automatic welcome greeting presentation flow (Phase 6)
  useEffect(() => {
    if (pathname !== '/') return;
    if (currentUser) return;

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

      const welcomeMsg = language === 'es'
        ? "Hola, soy Eterna. Puedes hablarme como le hablarías a una asesora. Por ejemplo: “busco una casa en Guadalajara de hasta tres millones”. Yo encontraré opciones y te ayudaré con el siguiente paso."
        : "Hi, I’m Eterna. You can talk to me just as you would talk to a real estate advisor. For example: “I’m looking for a home in Guadalajara under three million pesos.” I’ll find options and help you with the next step.";

      // Add to chat history
      setChatHistory(prev => {
        if (prev.some(msg => msg.content === welcomeMsg)) return prev;
        return [...prev, { role: 'assistant', content: welcomeMsg }];
      });

      let welcomeBecameAudible = false;
      const welcomeSpeechOptions = {
        onStart: () => {
          welcomeBecameAudible = true;
        },
      };

      // Generate and play the welcome as one stream. Splitting it previously
      // caused two /api/voz calls, a gap between phrases and an unnecessary
      // second TTS startup on every first home visit.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: true }));
      }
      speak(welcomeMsg, () => {
        if (typeof window !== 'undefined') {
          if (welcomeBecameAudible) {
            sessionStorage.setItem(ETERNA_HOME_INTRO_SESSION_KEY, 'true');
          }
          window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
        }
        setSimulatedStatus('idle');
      }, welcomeSpeechOptions);

      safetyTimer = setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('eterna-highlight-actions', { detail: false }));
          }
      }, 12_000);

    }, 1800);

    return () => {
      clearTimeout(timer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [chatHistory.length, chatHistoryRef, currentUser, language, pathname, setChatHistory, setSimulatedStatus, speak]);

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
        handleSendEvent(payload);
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
      handleMicButtonClickWithPermission();
    } else if (type === 'send') {
      if (isHome || conciergeMode === 'avatar') {
        if (!voiceMode) {
          handleVoiceButtonClick();
        }
      }
      handleSendEvent(payload);
      setIsOpen(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && shouldBeCompactOnMobile) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
    }

    clearEternaCommand();
  }, [eternaCommand, voiceMode, handleVoiceButtonClick, handleMicButtonClickWithPermission, clearEternaCommand, shouldBeCompactOnMobile, closeEternaCompletely, isHome, isPropertyPage, conciergeMode]);

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

  if (pathname === '/reset-password') {
    return null;
  }

  const isEternaSpeaking = activeStatus === 'talking';
  const voiceActionLabel = isEternaSpeaking
    ? (language === 'es' ? 'Interrumpir' : 'Interrupt')
    : voiceMode
      ? (language === 'es' ? 'Finalizar' : 'Finish')
      : (language === 'es' ? 'Hablar' : 'Talk');
  const voiceActionAriaLabel = isEternaSpeaking
    ? (language === 'es' ? 'Interrumpir a Eterna' : 'Interrupt Eterna')
    : voiceMode
      ? (language === 'es' ? 'Finalizar conversación por voz' : 'End voice conversation')
      : (language === 'es' ? 'Hablar con Eterna' : 'Talk to Eterna');
  const voiceActionTone = isEternaSpeaking
    ? 'bg-rose-500 hover:bg-rose-600'
    : voiceMode
      ? 'bg-sky-500 hover:bg-sky-600'
      : 'bg-emerald-500 hover:bg-emerald-600';
  const voiceAction = {
    ariaLabel: voiceActionAriaLabel,
    isSpeaking: isEternaSpeaking,
    isVoiceMode: voiceMode,
    label: voiceActionLabel,
    tone: voiceActionTone,
  };
  const statusMessage = isListening
    ? (language === 'es' ? '● Escuchando...' : '● Listening...')
    : activeStatus === 'thinking'
      ? `● ${getThinkingMessage()}`
      : activeStatus === 'talking'
        ? (language === 'es' ? '● Respondiendo...' : '● Responding...')
        : voiceMode
          ? (language === 'es' ? '● Escuchando...' : '● Listening...')
          : (language === 'es' ? '● Micrófono desactivado' : '● Microphone disabled');
  const avatarStatusMessage = propertyPresentation
    ? (language === 'es' ? '● Presentando propiedad...' : '● Presenting property...')
    : statusMessage;
  const chatContextLabel = conciergeMode === 'chat' && voiceState !== 'disabled'
    ? (language === 'es'
        ? `Contexto: ${getConversationContextLabel()}`
        : `Context: ${getConversationContextLabel()}`)
    : undefined;
  const activeProperty = liveContext.property;

  const handleOpenLauncher = () => {
    setIsOpen(true);
    if (isPropertyPage) setIsCompact(false);
    setShowTooltip(false);
  };

  const handleNavigateChatMessage = (message: EternaChatMessage) => {
    if (!message.route) return;

    let intentKey = 'view_dashboard';
    if (message.route.includes('tab=properties')) {
      intentKey = 'view_properties';
    } else if (message.route.includes('tab=trips')) {
      intentKey = 'view_trips';
    } else if (message.route.includes('tab=swaps')) {
      intentKey = 'view_swaps';
    } else if (message.route.includes('messages')) {
      intentKey = 'view_messages';
    } else if (message.route.includes('profile')) {
      intentKey = 'edit_profile';
    }

    const propertyRouteMatch = message.route.match(/^\/property\/([^/?#]+)/);
    if (propertyRouteMatch) {
      pendingPropertyPresentationRef.current = decodeURIComponent(propertyRouteMatch[1]);
    }
    navigateToRoute(message.route, message.content, intentKey);
  };

  const handleSignIn = () => {
    router.push('/login?tab=login');
    setIsOpen(false);
  };

  const handleRegister = () => {
    router.push('/login?tab=register');
    setIsOpen(false);
  };

  const handlePublishProperty = () => {
    window.dispatchEvent(new CustomEvent('open-property-wizard'));
  };

  const handleSubmitChat = () => {
    setSimulatedStatus('thinking');
    void handleSend();
  };

  return (
    <>
      <EternaLauncher
        model={{
          activeStatus,
          isDiscrete,
          isHydrated,
          isListening,
          isPropertyPage,
          language,
          partialTranscript,
          showTooltip,
          userName: currentUser?.name,
          visible: showOrb && !isOpen && !isHome,
          voiceAction,
        }}
        actions={{
          onOpen: handleOpenLauncher,
          onVoiceAction: handleMicButtonClickWithPermission,
        }}
      />

      <EternaDrawer
        inputRef={inputRef}
        model={{
          activeStatus,
          avatar: {
            activeStatus,
            hasActiveProperty: Boolean(activeProperty),
            isCompact,
            isAvatarSpeaking,
            isListening,
            isMuted,
            isPresentingProperty: Boolean(propertyPresentation),
            isPropertyPage,
            language,
            propertySales: latestPropertySales,
            propertyTitle: activeProperty?.title,
            statusMessage: avatarStatusMessage,
            voiceAction,
          },
          chatHeader: {
            activeStatus,
            contextLabel: chatContextLabel,
            isHome,
            isListening,
            isMuted,
            language,
            statusMessage,
          },
          chatHistory: {
            activeStatus,
            chatHistory,
            geminiActive,
            hasActiveProperty: Boolean(activeProperty),
            isCompact,
            isConnected,
            isHome,
            isListening,
            language,
            partialTranscript,
            propertyTitle: activeProperty?.title,
            simulatedStatus,
            simulatedText,
            translate: t,
            userName: currentUser?.name,
            websocketStatus: wsStatus,
            websocketText: textResponse,
          },
          chatInput: {
            activeStatus,
            isCompact,
            isHome,
            isListening,
            translate: t,
            typedInput,
            voiceAction,
          },
          isCompact,
          isHome,
          isListening,
          isPropertyPage,
          isPropertyVisualActive,
          mode: conciergeMode,
          visible: isOpen && !isHome,
        }}
        textEndRef={textEndRef}
        actions={{
          onAvatarSurfaceClick: handleMicButtonClickWithPermission,
          onClose: closeEternaCompletely,
          onContact: openPropertyContact,
          onInputChange: setTypedInput,
          onMuteToggle: () => setIsMuted((current) => !current),
          onNavigateMessage: handleNavigateChatMessage,
          onPublishProperty: handlePublishProperty,
          onRegister: handleRegister,
          onSend: (message) => {
            void handleSend(message);
          },
          onShowAvatar: () => setConciergeMode('avatar'),
          onShowChat: () => {
            setConciergeMode('chat');
            setIsCompact(false);
          },
          onSignIn: handleSignIn,
          onSubmit: handleSubmitChat,
          onToggleCompact: () => setIsCompact((current) => !current),
          onTouchEnd: handleTouchEnd,
          onTouchStart: handleTouchStart,
          onVoiceAction: handleMicButtonClickWithPermission,
        }}
      />
      {/* C. MOBILE-AWARE MICROPHONE PERMISSION HELP */}
      <MicrophonePermissionDialog
        open={micPermissionDeniedOpen}
        language={language === 'es' ? 'es' : 'en'}
        issue={micPermissionIssue}
        guide={mobileBrowserGuide}
        showInstructions={showInstructions}
        checking={isCheckingMicPermission}
        onClose={closeMicrophoneHelp}
        onRetry={() => void retryMicrophonePermission()}
        onWrite={continueWithTextChat}
        onToggleInstructions={toggleMicrophoneInstructions}
      />

    </>
  );
}
