"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EMPTY_SEARCH_BRIEF, SearchBrief } from '../auraswap2/decision';
import { useSwap } from './SwapContext';

export interface ComfortPreferences {
  textSize: 'normal' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  simpleView: boolean;
  voiceCaptions: boolean;
  voiceSpeed: number;
}

export interface DecisionContact {
  id: string;
  propertyId: string;
  propertyTitle: string;
  channel: 'message' | 'call' | 'whatsapp' | 'visit';
  status: 'sent' | 'seen' | 'responded' | 'visit_proposed' | 'visit_confirmed' | 'closed';
  createdAt: string;
}

export interface SavedSearchAlert {
  id: string;
  label: string;
  brief: SearchBrief;
  createdAt: string;
  active: boolean;
}

interface AuraV2ContextValue {
  brief: SearchBrief;
  comparisonIds: string[];
  notes: Record<string, string>;
  comfort: ComfortPreferences;
  contacts: DecisionContact[];
  alerts: SavedSearchAlert[];
  hydrated: boolean;
  journeyStage: 'DEFINE' | 'EXPLORE' | 'COMPARE' | 'VALIDATE' | 'ACT';
  patchBrief: (patch: Partial<SearchBrief>) => void;
  resetBrief: () => void;
  toggleComparison: (propertyId: string) => { added: boolean; reason?: string };
  clearComparison: () => void;
  setPropertyNote: (propertyId: string, note: string) => void;
  updateComfort: (patch: Partial<ComfortPreferences>) => void;
  recordContact: (contact: Omit<DecisionContact, 'id' | 'createdAt' | 'status'> & { status?: DecisionContact['status'] }) => void;
  updateContactStatus: (id: string, status: DecisionContact['status']) => void;
  createAlert: (overrides?: Partial<SearchBrief>) => { created: boolean; reason?: string };
  removeAlert: (id: string) => void;
}

const STORAGE_KEY = 'auraswap2_decision_workspace';

const DEFAULT_COMFORT: ComfortPreferences = {
  textSize: 'normal',
  highContrast: false,
  reducedMotion: false,
  simpleView: false,
  voiceCaptions: true,
  voiceSpeed: 1,
};

const AuraV2Context = createContext<AuraV2ContextValue | undefined>(undefined);

export function AuraV2Provider({ children }: { children: React.ReactNode }) {
  const { activeSearch } = useSwap();
  const [brief, setBrief] = useState<SearchBrief>(EMPTY_SEARCH_BRIEF);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [comfort, setComfort] = useState<ComfortPreferences>(DEFAULT_COMFORT);
  const [contacts, setContacts] = useState<DecisionContact[]>([]);
  const [alerts, setAlerts] = useState<SavedSearchAlert[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setBrief({ ...EMPTY_SEARCH_BRIEF, ...(parsed.brief || {}) });
          setComparisonIds(Array.isArray(parsed.comparisonIds) ? parsed.comparisonIds.slice(0, 3) : []);
          setNotes(parsed.notes || {});
          setComfort({ ...DEFAULT_COMFORT, ...(parsed.comfort || {}) });
          setContacts(Array.isArray(parsed.contacts) ? parsed.contacts : []);
          setAlerts(Array.isArray(parsed.alerts) ? parsed.alerts : []);
        }
      } catch (error) {
        console.warn('[AuraSwap2] No se pudo recuperar la carpeta de decisión.', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ brief, comparisonIds, notes, comfort, contacts, alerts }));
  }, [brief, comparisonIds, notes, comfort, contacts, alerts, hydrated]);

  useEffect(() => {
    if (!activeSearch?.filters) return;
    const filters = activeSearch.filters;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setBrief((current) => ({
        ...current,
        city: filters.city || current.city,
        budget: filters.budget || current.budget,
        bedrooms: filters.rooms ?? current.bedrooms,
        goal: filters.operation === 'sale' ? 'BUY' : filters.operation === 'rent' ? 'RENT' : current.goal,
      }));
    });
    return () => { cancelled = true; };
  }, [activeSearch?.id, activeSearch?.filters]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.auraText = comfort.textSize;
    root.dataset.auraContrast = comfort.highContrast ? 'high' : 'normal';
    root.dataset.auraMotion = comfort.reducedMotion ? 'reduced' : 'normal';
    root.dataset.auraSimple = comfort.simpleView ? 'true' : 'false';
  }, [comfort]);

  const patchBrief = useCallback((patch: Partial<SearchBrief>) => {
    setBrief((current) => ({ ...current, ...patch }));
    window.dispatchEvent(new CustomEvent('auraswap2:brief-updated', { detail: patch }));
  }, []);

  const resetBrief = useCallback(() => setBrief(EMPTY_SEARCH_BRIEF), []);

  const toggleComparison = useCallback((propertyId: string) => {
    let result: { added: boolean; reason?: string } = { added: false };
    setComparisonIds((current) => {
      if (current.includes(propertyId)) {
        result = { added: false };
        return current.filter((id) => id !== propertyId);
      }
      if (current.length >= 3) {
        result = { added: false, reason: 'Puedes comparar hasta tres propiedades a la vez.' };
        return current;
      }
      result = { added: true };
      return [...current, propertyId];
    });
    return result;
  }, []);

  const clearComparison = useCallback(() => setComparisonIds([]), []);

  const setPropertyNote = useCallback((propertyId: string, note: string) => {
    setNotes((current) => ({ ...current, [propertyId]: note }));
  }, []);

  const updateComfort = useCallback((patch: Partial<ComfortPreferences>) => {
    setComfort((current) => ({ ...current, ...patch }));
  }, []);

  const recordContact = useCallback((contact: Omit<DecisionContact, 'id' | 'createdAt' | 'status'> & { status?: DecisionContact['status'] }) => {
    setContacts((current) => [
      {
        ...contact,
        id: `contact-${Date.now()}`,
        status: contact.status || 'sent',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  }, []);

  const updateContactStatus = useCallback((id: string, status: DecisionContact['status']) => {
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, status } : contact));
  }, []);

  const createAlert = useCallback((overrides: Partial<SearchBrief> = {}) => {
    const alertBrief = { ...brief, ...overrides };
    if (!alertBrief.city && !alertBrief.budget) return { created: false, reason: 'Define al menos ciudad o presupuesto para crear una alerta.' };
    const fingerprint = JSON.stringify({ city: alertBrief.city, budget: alertBrief.budget, bedrooms: alertBrief.bedrooms, goal: alertBrief.goal, mustHaves: alertBrief.mustHaves });
    if (alerts.some((alert) => JSON.stringify({ city: alert.brief.city, budget: alert.brief.budget, bedrooms: alert.brief.bedrooms, goal: alert.brief.goal, mustHaves: alert.brief.mustHaves }) === fingerprint)) {
      return { created: false, reason: 'Esta búsqueda ya tiene una alerta activa.' };
    }
    setAlerts((current) => [{
      id: `alert-${Date.now()}`,
      label: `${alertBrief.city || 'Cualquier ciudad'}${alertBrief.budget ? ` · Hasta ${alertBrief.currency} $${alertBrief.budget.toLocaleString('es-MX')}` : ''}`,
      brief: { ...alertBrief, mustHaves: [...alertBrief.mustHaves] },
      createdAt: new Date().toISOString(),
      active: true,
    }, ...current]);
    return { created: true };
  }, [alerts, brief]);

  const removeAlert = useCallback((id: string) => setAlerts((current) => current.filter((alert) => alert.id !== id)), []);

  const journeyStage = useMemo<AuraV2ContextValue['journeyStage']>(() => {
    if (!brief.city || !brief.budget) return 'DEFINE';
    if (comparisonIds.length === 0) return 'EXPLORE';
    if (comparisonIds.length < 2) return 'COMPARE';
    if (contacts.length === 0) return 'VALIDATE';
    return 'ACT';
  }, [brief.city, brief.budget, comparisonIds.length, contacts.length]);

  const value = useMemo<AuraV2ContextValue>(() => ({
    brief,
    comparisonIds,
    notes,
    comfort,
    contacts,
    alerts,
    hydrated,
    journeyStage,
    patchBrief,
    resetBrief,
    toggleComparison,
    clearComparison,
    setPropertyNote,
    updateComfort,
    recordContact,
    updateContactStatus,
    createAlert,
    removeAlert,
  }), [
    brief,
    comparisonIds,
    notes,
    comfort,
    contacts,
    alerts,
    hydrated,
    journeyStage,
    patchBrief,
    resetBrief,
    toggleComparison,
    clearComparison,
    setPropertyNote,
    updateComfort,
    recordContact,
    updateContactStatus,
    createAlert,
    removeAlert,
  ]);

  return <AuraV2Context.Provider value={value}>{children}</AuraV2Context.Provider>;
}

export function useAuraV2() {
  const context = useContext(AuraV2Context);
  if (!context) throw new Error('useAuraV2 debe utilizarse dentro de AuraV2Provider.');
  return context;
}
