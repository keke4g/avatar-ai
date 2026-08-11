"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../translations';

export type LanguageType = 'es' | 'en';

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (
    path: string,
    replacements?: Record<string, string | number>,
    fallback?: string,
  ) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const reportedMissingTranslations = new Set<string>();

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>('es'); // Default to Latin American Spanish
  // Initialize language from localStorage or default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auraswap_language') as LanguageType;
      queueMicrotask(() => {
        if (stored === 'es' || stored === 'en') {
          setLanguageState(stored);
        }
      });
    }
  }, []);

  // Update localStorage when state changes
  const setLanguage = useCallback((lang: LanguageType) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auraswap_language', lang);
    }
  }, []);

  // Advanced type-safe key retriever supporting nested paths (e.g. "details.requestSwapBtn")
  // and dynamic parameter replacements (e.g. {count} or {host}). User-generated
  // content can provide a fallback so it is never mistaken for a static key.
  const t = useCallback((
    path: string,
    replacements?: Record<string, string | number>,
    fallback?: string,
  ): string => {
    const keys = path.split('.');
    const dictionary = translations[language] as any;
    
    let result = dictionary;
    for (const key of keys) {
      if (result && Object.prototype.hasOwnProperty.call(result, key)) {
        result = result[key];
      } else {
        const warningKey = `${language}:${path}`;
        if (
          fallback === undefined
          && process.env.NODE_ENV !== 'production'
          && !reportedMissingTranslations.has(warningKey)
        ) {
          reportedMissingTranslations.add(warningKey);
          console.warn(`[i18n] Translation path not found: "${path}" in language "${language}"`);
        }
        return fallback ?? path;
      }
    }

    if (typeof result !== 'string') {
      return fallback ?? path;
    }

    // Apply parameter replacements if provided
    let translatedString = result;
    if (replacements) {
      Object.entries(replacements).forEach(([param, value]) => {
        translatedString = translatedString.replace(new RegExp(`{${param}}`, 'g'), String(value));
      });
    }

    return translatedString;
  }, [language]);

  const contextValue = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
