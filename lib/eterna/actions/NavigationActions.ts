import { useCallback } from 'react';
import { PendingIntent } from '../../context/LiveContext';
import { User } from '../../types';

interface NavigationActionsDeps {
  currentUser: User | null;
  language: string;
  router: { push: (url: string) => void };
  speak: (text: string, onEnd?: () => void) => void;
  setPendingIntent: (pending: PendingIntent | null) => void;
  setActiveGuidedFlow: (flow: string | null) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; content: string; route?: string; showAuthButtons?: boolean }[]>>;
  setIsOpen: (isOpen: boolean) => void;
  setSimulatedStatus: (status: 'idle' | 'thinking' | 'talking' | 'listening' | 'disconnected') => void;
  setIsCompact: (isCompact: boolean) => void;
}

export function useNavigationActions({
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
}: NavigationActionsDeps) {

  const getCatalogMessage = useCallback((intent: string, type: 'pre' | 'post', lang: 'es' | 'en'): string => {
    const catalog: Record<string, { pre: { es: string; en: string }; post: { es: string; en: string } }> = {
      publish_property: {
        pre: {
          es: "Para publicar una propiedad, primero necesitas iniciar sesión o registrarte. Te llevo a la página de ingreso.",
          en: "To list your property, you need to sign in or register first. Taking you to the login page."
        },
        post: {
          es: "Perfecto {name}. Ya estás en tu panel de propiedades. ¿Deseas que iniciemos el registro de una nueva propiedad?",
          en: "Perfect {name}. You are now in your properties panel. Would you like to start listing a new property?"
        }
      },
      view_properties: {
        pre: {
          es: "Para ver tus propiedades publicadas, necesitas ingresar a tu cuenta. Te llevo al acceso.",
          en: "To view your listings, you need to sign in first. Guiding you to the login page."
        },
        post: {
          es: "Bienvenido de vuelta, {name}. Aquí tienes tu panel con las propiedades que has registrado.",
          en: "Welcome back, {name}. Here is your dashboard with your registered properties."
        }
      },
      view_messages: {
        pre: {
          es: "Para leer tus mensajes y chats, primero debes iniciar sesión. Te dirijo al ingreso.",
          en: "To read your messages and chats, you must sign in first. Taking you there."
        },
        post: {
          es: "¡Hola, {name}! Te he traído a tu bandeja de entrada para que revises tus conversaciones pendientes.",
          en: "Hi {name}! I've brought you to your inbox to check your pending conversations."
        }
      },
      view_trips: {
        pre: {
          es: "Para consultar los detalles de tus viajes y reservas, necesitas ingresar. Te llevo a la página de acceso.",
          en: "To check your trips and bookings, you need to sign in first. Taking you to the login page."
        },
        post: {
          es: "Listo, {name}. Aquí puedes ver tus próximos viajes planificados y reservas confirmadas.",
          en: "Done, {name}. Here you can see your upcoming planned trips and confirmed bookings."
        }
      },
      view_swaps: {
        pre: {
          es: "Para revisar tus solicitudes de intercambio pendientes, debes autenticarte. Vamos a la pantalla de acceso.",
          en: "To review your pending swap requests, you need to authenticate. Let's go to the login screen."
        },
        post: {
          es: "Aquí tienes tus solicitudes de intercambio, {name}. Puedes aceptarlas o responder desde este panel.",
          en: "Here are your swap requests, {name}. You can accept them or reply from this panel."
        }
      },
      edit_profile: {
        pre: {
          es: "Para editar los detalles de tu perfil, es necesario iniciar sesión. Te dirijo al acceso.",
          en: "To edit your profile details, you must sign in first. Redirecting you to the login page."
        },
        post: {
          es: "Aquí puedes actualizar tu biografía, foto de perfil y detalles de tu cuenta, {name}.",
          en: "Here you can update your bio, profile picture, and account details, {name}."
        }
      },
      view_dashboard: {
        pre: {
          es: "Para ver tu panel de control general, necesitas iniciar sesión. Te llevo a la página de ingreso.",
          en: "To view your general control dashboard, you must sign in. Taking you to the login page."
        },
        post: {
          es: "Hola, {name}. Bienvenido a tu panel de control general de Towers México.",
          en: "Hello {name}. Welcome to your general Towers México control dashboard."
        }
      }
    };

    const match = catalog[intent] || catalog.view_dashboard;
    return lang === 'es' ? match[type].es : match[type].en;
  }, []);

  const navigateToRoute = useCallback((
    route: string,
    originalPrompt: string = '',
    intentKey: string = 'view_dashboard'
  ) => {
    const protectedPrefixes = ['/dashboard', '/messages', '/profile', '/admin', '/onboarding'];
    const isProtected = protectedPrefixes.some(prefix => route.startsWith(prefix));

    if (isProtected && !currentUser) {
      const pending: PendingIntent = {
        intent: intentKey,
        route,
        originalPrompt,
        timestamp: Date.now(),
        status: 'awaiting_auth_choice'
      };
      setPendingIntent(pending);

      const preLoginMsg = getCatalogMessage(intentKey, 'pre', language as 'es' | 'en');

      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: preLoginMsg }
      ]);

      setIsOpen(true);
      setSimulatedStatus('talking');
      speak(preLoginMsg, () => {
        setSimulatedStatus('idle');
        router.push('/login');
      });
      return;
    }

    setActiveGuidedFlow(intentKey);
    router.push(route);
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileScreen) {
      setIsCompact(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [currentUser, setPendingIntent, setActiveGuidedFlow, getCatalogMessage, language, router, speak, setChatHistory, setIsOpen, setSimulatedStatus, setIsCompact]);

  const completeActiveFlow = useCallback((flowName?: string | null, activeGuidedFlow?: string | null) => {
    const flow = flowName || activeGuidedFlow;
    setActiveGuidedFlow(null);
    
    let completionMsg = '';
    if (flow === 'publish_property') {
      completionMsg = language === 'es'
        ? "Excelente. Tu propiedad está lista para publicarse. Te recomiendo revisar fotografías, descripción y precios antes de activar el anuncio."
        : "Excellent. Your property is ready to be published. I recommend reviewing photos, description, and prices before activating the listing.";
    } else {
      completionMsg = language === 'es'
        ? "¡Perfecto! He completado el proceso contigo. ¿Deseas que te ayude con algo más?"
        : "Perfect! I have completed the process with you. Would you like me to help you with anything else?";
    }

    setChatHistory(prev => [...prev, { role: 'assistant', content: completionMsg }]);
    setIsOpen(true);
    setSimulatedStatus('talking');
    speak(completionMsg, () => {
      setSimulatedStatus('idle');
    });
  }, [language, speak, setActiveGuidedFlow, setChatHistory, setIsOpen, setSimulatedStatus]);

  return {
    getCatalogMessage,
    navigateToRoute,
    completeActiveFlow
  };
}
