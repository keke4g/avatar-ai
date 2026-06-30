"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, TranslationDictionary } from '../translations';

export type LanguageType = 'es' | 'en';

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (path: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>('es'); // Default to Latin American Spanish
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize language from localStorage or default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auraswap_language') as LanguageType;
      if (stored === 'es' || stored === 'en') {
        setLanguageState(stored);
      }
      setIsLoaded(true);
    }
  }, []);

  // Update localStorage when state changes
  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auraswap_language', lang);
    }
  };

  // Advanced type-safe key retriever supporting nested paths (e.g. "details.requestSwapBtn")
  // and dynamic parameter replacements (e.g. {count} or {host})
  const t = (path: string, replacements?: Record<string, string | number>): string => {
    const keys = path.split('.');
    const dictionary = translations[language] as any;
    
    let result = dictionary;
    for (const key of keys) {
      if (result && Object.prototype.hasOwnProperty.call(result, key)) {
        result = result[key];
      } else {
        console.warn(`[i18n] Translation path not found: "${path}" in language "${language}"`);
        return path; // Fallback to raw key
      }
    }

    if (typeof result !== 'string') {
      return path;
    }

    // Apply parameter replacements if provided
    let translatedString = result;
    if (replacements) {
      Object.entries(replacements).forEach(([param, value]) => {
        translatedString = translatedString.replace(new RegExp(`{${param}}`, 'g'), String(value));
      });
    }

    return translatedString;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
