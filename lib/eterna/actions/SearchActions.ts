import { useCallback } from 'react';
import { PropertySearchIntent } from '../IntentRouter';

interface SearchActionsDeps {
  language: string;
  router: { push: (url: string) => void };
  speak: (text: string, onEnd?: () => void) => void;
  setSearchIntent: React.Dispatch<React.SetStateAction<PropertySearchIntent | null>>;
  setSearchQuestionsCount: React.Dispatch<React.SetStateAction<number>>;
  setExploreFilters: (filters: Record<string, unknown>) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; content: string; route?: string }[]>>;
  setSimulatedStatus: (status: 'idle' | 'thinking' | 'talking' | 'listening' | 'disconnected') => void;
  setIsOpen: (isOpen: boolean) => void;
  setIsCompact: (isCompact: boolean) => void;
}

export function useSearchActions({
  language,
  router,
  speak,
  setSearchIntent,
  setSearchQuestionsCount,
  setExploreFilters,
  setChatHistory,
  setSimulatedStatus,
  setIsOpen,
  setIsCompact,
}: SearchActionsDeps) {

  const buildConciergeExploreUrl = useCallback((intent: PropertySearchIntent): string => {
    const params = new URLSearchParams();
    if (intent.destination) params.set('search', intent.destination);
    if (intent.guests && intent.guests > 0) params.set('guests', String(intent.guests));
    if (intent.category) params.set('category', intent.category);
    if (intent.offering) params.set('offering', intent.offering);
    if (intent.tier) params.set('tier', intent.tier);
    return `/explore?${params.toString()}`;
  }, []);

  const respondLocally = useCallback((text: string) => {
    setChatHistory(prev => [...prev, { role: 'assistant', content: text }]);
    setSimulatedStatus('talking');
    speak(text, () => {
      setSimulatedStatus('idle');
    });
  }, [speak, setChatHistory, setSimulatedStatus]);

  const performSearchRedirect = useCallback((intent: PropertySearchIntent) => {
    const url = buildConciergeExploreUrl(intent);
    
    setSearchIntent(null);
    setSearchQuestionsCount(0);
    
    setExploreFilters({
      category: intent.category || 'All',
      offeringTab: intent.offering === 'SALE' ? 'SALE' : (intent.offering === 'SWAP' ? 'SWAP' : (intent.offering ? 'RENT' : 'ALL')),
      query: intent.destination || '',
      guests: intent.guests || 0,
      swapType: intent.tier || 'All',
      sortBy: 'match',
    });

    const response = language === 'es'
      ? 'Perfecto. Encontré varias opciones que coinciden con lo que buscas. Te llevaré a los resultados.'
      : 'Perfect. I found several options matching your search. I\'ll take you to the results.';
      
    setChatHistory(prev => [...prev, { role: 'assistant', content: response, route: url }]);
    setSimulatedStatus('talking');
    speak(response, () => {
      setSimulatedStatus('idle');
    });

    router.push(url);
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileScreen) {
      setIsCompact(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [buildConciergeExploreUrl, language, speak, router, setExploreFilters, setSearchIntent, setSearchQuestionsCount, setChatHistory, setSimulatedStatus, setIsCompact, setIsOpen]);

  const checkNextSearchStep = useCallback((intent: PropertySearchIntent, questionsCount: number) => {
    const hasSufficientInfo = intent.offering && intent.destination;
    
    if (hasSufficientInfo || questionsCount >= 3) {
      performSearchRedirect(intent);
      return;
    }

    if (!intent.offering) {
      const question = language === 'es'
        ? (intent.isPropertyMode ? '¿La buscas para vivir o como inversión?' : '¿La buscas para compra, renta o intercambio?')
        : (intent.isPropertyMode ? 'Are you looking to live in it or as an investment?' : 'Are you looking for purchase, rent, or exchange?');
      setSearchIntent(intent);
      respondLocally(question);
      return;
    }

    if (!intent.destination) {
      const question = language === 'es'
        ? (intent.offering === 'SALE' 
            ? 'Perfecto. ¿En qué ciudad te gustaría comprar la propiedad?' 
            : '¿En qué ciudad o zona estás buscando?')
        : (intent.offering === 'SALE'
            ? 'Perfect. In which city would you like to buy the property?'
            : 'Which city or area are you looking in?');
      setSearchIntent(intent);
      respondLocally(question);
      return;
    }

    if (!intent.guests) {
      const question = language === 'es'
        ? (intent.isPropertyMode ? '¿Para cuántas personas la necesitas?' : '¿Para cuántas personas necesitas el alojamiento?')
        : (intent.isPropertyMode ? 'How many people is it for?' : 'For how many guests do you need the accommodation?');
      setSearchIntent(intent);
      respondLocally(question);
      return;
    }

    if (!intent.category) {
      const question = language === 'es'
        ? (intent.isPropertyMode ? '¿Prefieres casa, departamento o cualquier tipo de propiedad?' : '¿Qué tipo de propiedad prefieres? (Villa, Departamento, Cabaña, Loft, Penthouse, Casa de Playa)')
        : (intent.isPropertyMode ? 'Do you prefer a house, apartment, or any other type of property?' : 'What type of property do you prefer? (Villa, Apartment, Cabin, Loft, Penthouse, Beach House)');
      setSearchIntent(intent);
      respondLocally(question);
      return;
    }

    performSearchRedirect(intent);
  }, [language, respondLocally, performSearchRedirect, setSearchIntent]);

  return {
    buildConciergeExploreUrl,
    respondLocally,
    performSearchRedirect,
    checkNextSearchStep
  };
}
export type { PropertySearchIntent };
