"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { EternaChatMessage } from '@/lib/eterna/propertySales';

const ETERNA_CHAT_SESSION_KEY = 'eterna_chat_history_v4';
const LEGACY_ETERNA_LOCAL_KEYS = [
  'eterna_chat_history_v3',
  'eterna_conversation_session',
] as const;
const MAX_PERSISTED_MESSAGES = 30;

export const ETERNA_SESSION_TTL_MS = 30 * 60 * 1000;

interface PersistedChatHistory {
  messages?: EternaChatMessage[];
  updatedAt?: number;
}

const subscribeToHydration = () => () => {};

export function useEternaSessionState() {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [chatHistory, setChatHistory] = useState<EternaChatMessage[]>([]);
  const [geminiActive, setGeminiActive] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('auraswap_gemini_active') !== 'false';
  });
  const chatHistoryRestoredRef = useRef(false);
  const chatHistoryRef = useRef(chatHistory);

  useEffect(() => {
    let active = true;
    let restoredMessages: EternaChatMessage[] | null = null;
    try {
      LEGACY_ETERNA_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
      const stored = sessionStorage.getItem(ETERNA_CHAT_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PersistedChatHistory;
        const fresh = Boolean(
          parsed.updatedAt
          && Date.now() - parsed.updatedAt < ETERNA_SESSION_TTL_MS
          && Array.isArray(parsed.messages),
        );
        if (fresh && parsed.messages) {
          restoredMessages = parsed.messages.slice(-MAX_PERSISTED_MESSAGES);
        } else {
          sessionStorage.removeItem(ETERNA_CHAT_SESSION_KEY);
        }
      }
    } catch (error) {
      console.warn('[Eterna] No fue posible restaurar la conversación.', error);
      try {
        sessionStorage.removeItem(ETERNA_CHAT_SESSION_KEY);
      } catch {
        // Private browsing can block session storage entirely.
      }
    }

    queueMicrotask(() => {
      if (!active) return;
      if (restoredMessages) setChatHistory(restoredMessages);
      chatHistoryRestoredRef.current = true;
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
    if (!chatHistoryRestoredRef.current) return;

    try {
      sessionStorage.setItem(ETERNA_CHAT_SESSION_KEY, JSON.stringify({
        updatedAt: Date.now(),
        messages: chatHistory.slice(-MAX_PERSISTED_MESSAGES),
      }));
    } catch (error) {
      console.warn('[Eterna] No fue posible guardar la conversación.', error);
    }
  }, [chatHistory]);

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      if (typeof detail?.active === 'boolean') {
        setGeminiActive(detail.active);
      }
    };
    window.addEventListener('auraswap:gemini-active-changed', handleEvent);
    return () => window.removeEventListener('auraswap:gemini-active-changed', handleEvent);
  }, []);

  return {
    chatHistory,
    chatHistoryRef,
    geminiActive,
    isHydrated,
    setChatHistory,
  };
}
