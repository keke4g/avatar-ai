import { useState, useCallback } from 'react';

export type ThinkingContext = 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general';

interface UseThinkingContextProps {
  language: 'es' | 'en';
}

export function useThinkingContext({ language }: UseThinkingContextProps) {
  const [thinkingContext, setThinkingContext] = useState<ThinkingContext>('general');

  const getThinkingMessage = useCallback(() => {
    const isEs = language === 'es';
    switch (thinkingContext) {
      case 'property_search':
        return isEs ? 'Buscando propiedades...' : 'Searching properties...';
      case 'property_detail':
        return isEs ? 'Analizando esta propiedad...' : 'Analyzing this property...';
      case 'publish_property':
        return isEs ? 'Preparando publicación...' : 'Preparing listing...';
      case 'swap':
        return isEs ? 'Buscando intercambios...' : 'Searching exchanges...';
      case 'navigation':
        return isEs ? 'Abriendo sección...' : 'Opening section...';
      case 'general':
      default:
        return isEs ? 'Analizando tu solicitud...' : 'Analyzing your request...';
    }
  }, [language, thinkingContext]);

  const getConversationContextLabel = useCallback(() => {
    const isEs = language === 'es';

    switch (thinkingContext) {
      case 'property_search':
        return isEs ? 'Buscando propiedades' : 'Searching properties';
      case 'publish_property':
        return isEs ? 'Publicando propiedad' : 'Publishing property';
      case 'property_detail':
        return isEs ? 'Analizando propiedad' : 'Analyzing property';
      case 'swap':
        return isEs ? 'Buscando intercambios' : 'Searching exchanges';
      case 'navigation':
        return isEs ? 'Navegando' : 'Navigating';
      case 'general':
      default:
        return isEs ? 'Conversación general' : 'General conversation';
    }
  }, [language, thinkingContext]);

  return {
    thinkingContext,
    setThinkingContext,
    getThinkingMessage,
    getConversationContextLabel
  };
}
