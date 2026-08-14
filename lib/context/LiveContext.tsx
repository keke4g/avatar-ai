"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSwap } from './SwapContext';
import { Property } from '../types';

export interface PendingIntent {
  intent: string;
  route: string;
  originalPrompt: string;
  timestamp: number;
  status:
    | 'awaiting_auth_choice'
    | 'authenticated'
    | 'navigated'
    | 'guided_flow_active'
    | 'completed';
}

export interface LiveContextPayload {
  currentUrl: string;

  dashboard: {
    activeTab: string | null;
  };

  wizard: {
    isOpen: boolean;
    step: number | null;
    mode: 'SWAP' | 'SHORT_RENT' | 'MONTHLY_RENT' | 'SALE' | null;
    isEditing: boolean;
    propertyTitle: string | null;
  };

  explore: {
    category: string;
    offeringTab: string;
    query: string;
    guests: number;
    swapType: string;
    sortBy: string;
  } | null;

  propertyPage: {
    propertyId: string;
    title: string;
    city: string;
    country: string;
    type: string;
  } | null;

  property: Property | null;

  auth: {
    isAuthenticated: boolean;
  };

  eterna: {
    pendingIntent: PendingIntent | null;
    activeGuidedFlow: string | null;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  showAuthButtons?: boolean;
  showPublishButton?: boolean;
  suggestedReplies?: string[];
}

export type EternaSearchBriefStatus = 'idle' | 'collecting' | 'searching' | 'ready' | 'error';

export interface EternaSearchBrief {
  status: EternaSearchBriefStatus;
  operation?: 'sale' | 'rent' | 'swap';
  city?: string;
  propertyType?: string;
  budget?: string | number;
  minBudget?: number;
  rooms?: number;
  preferences: string[];
  resultCount: number;
}

export interface EternaChatState {
  isOpen: boolean;
  isListening: boolean;
  voiceMode: boolean;
  isVoiceStarting: boolean;
  isAvatarSpeaking: boolean;
  status: string;
  chatHistory: ChatMessage[];
  searchBrief: EternaSearchBrief;
}

export interface EternaCommand {
  type: 'open' | 'close' | 'startVoice' | 'send';
  payload?: any;
  timestamp: number;
}

interface LiveContextType {
  liveContext: LiveContextPayload;
  setDashboardTab: (tab: string | null) => void;
  setWizardState: (state: Partial<LiveContextPayload['wizard']>) => void;
  setExploreFilters: (filters: LiveContextPayload['explore']) => void;
  setPendingIntent: (intent: PendingIntent | null) => void;
  setActiveGuidedFlow: (flowId: string | null) => void;
  resetWizardState: () => void;
  resetExploreFilters: () => void;
  setActiveProperty: (property: Property | null) => void;
  clearActiveProperty: () => void;

  // Eterna homepage integrations
  eternaChatState: EternaChatState;
  setEternaChatState: (state: Partial<EternaChatState>) => void;
  eternaCommand: EternaCommand | null;
  openChat: (initialPrompt?: string) => void;
  closeChat: () => void;
  startVoice: () => void;
  sendPrompt: (text: string) => void;
  clearEternaCommand: () => void;
}

const defaultWizardState: LiveContextPayload['wizard'] = {
  isOpen: false,
  step: null,
  mode: null,
  isEditing: false,
  propertyTitle: null,
};

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export function LiveContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, properties } = useSwap();

  // 1. Local states for interactive visual components (excluding URL-derived states)
  const [wizardState, setWizardStateInternal] = useState<LiveContextPayload['wizard']>(defaultWizardState);
  const [exploreFilters, setExploreFilters] = useState<LiveContextPayload['explore']>(null);
  const [pendingIntent, setPendingIntentState] = useState<PendingIntent | null>(null);
  const [activeGuidedFlow, setActiveGuidedFlowState] = useState<string | null>(null);
  const [activeProperty, setActivePropertyState] = useState<Property | null>(null);

  // Eterna chat context states for homepage integration
  const [eternaChatState, setEternaChatStateInternal] = useState<EternaChatState>({
    isOpen: false,
    isListening: false,
    voiceMode: false,
    isVoiceStarting: false,
    isAvatarSpeaking: false,
    status: 'disconnected',
    chatHistory: [],
    searchBrief: {
      status: 'idle',
      preferences: [],
      resultCount: 0,
    },
  });
  const [eternaCommand, setEternaCommand] = useState<EternaCommand | null>(null);

  const setEternaChatState = useCallback((state: Partial<EternaChatState>) => {
    setEternaChatStateInternal(prev => ({
      ...prev,
      ...state
    }));
  }, []);

  const openChat = useCallback((initialPrompt?: string) => {
    setEternaCommand({ type: 'open', payload: initialPrompt, timestamp: Date.now() });
  }, []);

  const closeChat = useCallback(() => {
    setEternaCommand({ type: 'close', timestamp: Date.now() });
  }, []);

  const startVoice = useCallback(() => {
    if (typeof window !== 'undefined') {
      const voiceWindow = window as Window & {
        __eternaStartVoice?: () => void | Promise<void>;
      };

      if (voiceWindow.__eternaStartVoice) {
        void voiceWindow.__eternaStartVoice();
        return;
      }
    }

    setEternaCommand({ type: 'startVoice', timestamp: Date.now() });
  }, []);

  const sendPrompt = useCallback((prompt: string) => {
    setEternaCommand({ type: 'send', payload: prompt, timestamp: Date.now() });
  }, []);

  const clearEternaCommand = useCallback(() => {
    setEternaCommand(null);
  }, []);

  // 2. Derive dashboard activeTab directly from searchParams (URL is the single source of truth)
  const dashboardTab = useMemo(() => {
    if (pathname === '/dashboard') {
      return searchParams.get('tab') || 'swaps';
    }
    return null;
  }, [pathname, searchParams]);

  // 3. Synchronize url parameter directly from Next.js router
  const currentUrl = useMemo(() => {
    const params = searchParams.toString();
    return pathname + (params ? `?${params}` : '');
  }, [pathname, searchParams]);

  // 4. Symmetrical listeners to restore states on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Restore pending intent
      const storedIntent = localStorage.getItem('pending_eterna_intent');
      if (storedIntent) {
        try {
          const parsed = JSON.parse(storedIntent);
          if (parsed && Date.now() - parsed.timestamp < 10 * 60 * 1000) {
            queueMicrotask(() => setPendingIntentState(parsed));
          } else {
            localStorage.removeItem('pending_eterna_intent');
          }
        } catch {
          localStorage.removeItem('pending_eterna_intent');
        }
      }

      // Restore active guided flow
      const storedFlow = localStorage.getItem('active_guided_flow');
      if (storedFlow) {
        queueMicrotask(() => setActiveGuidedFlowState(storedFlow));
      }
    }
  }, []);

  useEffect(() => {
    console.log('[WIZARD CLOSE] activeGuidedFlow changed:', activeGuidedFlow);
  }, [activeGuidedFlow]);

  useEffect(() => {
    console.log('[WIZARD CLOSE] wizard.isOpen changed:', wizardState.isOpen);
  }, [wizardState.isOpen]);

  // 5. Global Event Listener for Property Wizard Steps (Fully decoupled React state sync)
  useEffect(() => {
    const handleStepChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setWizardStateInternal({
        isOpen: detail.isOpen,
        step: detail.step,
        mode: detail.mode,
        isEditing: detail.isEditing,
        propertyTitle: detail.propertyTitle,
      });
    };
    window.addEventListener('auraswap:wizard-step', handleStepChange);
    return () => window.removeEventListener('auraswap:wizard-step', handleStepChange);
  }, []);

  // 6. Dynamic derivation of authenticated status
  const isAuthenticated = !!currentUser;
  const auth = useMemo(() => ({
    isAuthenticated,
  }), [isAuthenticated]);

  // 7. Dynamic derivation of active property page details
  const propertyPage = useMemo(() => {
    if (pathname.startsWith('/property/')) {
      const propertyId = pathname.split('/').pop() || '';
      const matched = properties.find(p => p.id === propertyId);
      if (matched) {
        return {
          propertyId,
          title: matched.title,
          city: matched.location,
          country: matched.country,
          type: matched.type,
        };
      }
    }
    return null;
  }, [pathname, properties]);

  // 8. Navigation Actions
  const setDashboardTab = useCallback((tab: string | null) => {
    if (tab) {
      router.push(`/dashboard?tab=${tab}`);
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  // 9. Caching Setter for Pending Intent
  const setPendingIntent = useCallback((payload: PendingIntent | null) => {
    setPendingIntentState(payload);
    if (typeof window !== 'undefined') {
      if (payload) {
        localStorage.setItem('pending_eterna_intent', JSON.stringify(payload));
      } else {
        localStorage.removeItem('pending_eterna_intent');
      }
    }
  }, []);

  // 10. Caching Setter for Active Guided Flow
  const setActiveGuidedFlow = useCallback((flowId: string | null) => {
    console.trace('[ACTIVE FLOW WRITE]', flowId);
    setActiveGuidedFlowState(flowId);
    if (typeof window !== 'undefined') {
      if (flowId) {
        localStorage.setItem('active_guided_flow', flowId);
      } else {
        localStorage.removeItem('active_guided_flow');
      }
    }
  }, []);

  const setWizardState = useCallback((state: Partial<LiveContextPayload['wizard']>) => {
    setWizardStateInternal(prev => ({
      ...prev,
      ...state,
    }));
  }, []);

  const resetWizardState = useCallback(() => {
    setWizardStateInternal(defaultWizardState);
  }, []);

  const resetExploreFilters = useCallback(() => {
    setExploreFilters(null);
  }, []);

  const setActiveProperty = useCallback((prop: Property | null) => {
    setActivePropertyState(prop);
  }, []);

  const clearActiveProperty = useCallback(() => {
    setActivePropertyState(null);
  }, []);

  // 11. Consolidate payload
  const liveContext: LiveContextPayload = useMemo(() => ({
    currentUrl,
    dashboard: {
      activeTab: dashboardTab,
    },
    wizard: wizardState,
    explore: exploreFilters,
    propertyPage,
    property: activeProperty,
    auth,
    eterna: {
      pendingIntent,
      activeGuidedFlow,
    },
  }), [currentUrl, dashboardTab, wizardState, exploreFilters, propertyPage, activeProperty, auth, pendingIntent, activeGuidedFlow]);

  return (
    <LiveContext.Provider
      value={{
        liveContext,
        setDashboardTab,
        setWizardState,
        setExploreFilters,
        setPendingIntent,
        setActiveGuidedFlow,
        resetWizardState,
        resetExploreFilters,
        setActiveProperty,
        clearActiveProperty,
        eternaChatState,
        setEternaChatState,
        eternaCommand,
        openChat,
        closeChat,
        startVoice,
        sendPrompt,
        clearEternaCommand,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLiveContext() {
  const context = useContext(LiveContext);
  if (context === undefined) {
    throw new Error('useLiveContext must be used within a LiveContextProvider');
  }
  return context;
}
