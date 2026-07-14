import { useCallback, MutableRefObject } from 'react';
import { IntentContext } from '../IntentRouter';
import { ChatMessage, Review, User } from '../../types';
import {
  EternaChatMessage,
  parsePropertySalesResponse,
} from '../propertySales';

interface GeneralActionsDeps {
  language: string;
  currentUser: User | null;
  chatHistory: EternaChatMessage[];
  systemPrompt: { role: string; content: string };
  messages: ChatMessage[];
  reviews: Review[];
  intentContext: IntentContext;
  geminiAbortControllerRef: MutableRefObject<AbortController | null>;
  setThinkingContext: (ctx: 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general') => void;
  setSimulatedStatus: (status: 'disconnected' | 'connected' | 'listening' | 'thinking' | 'talking' | 'idle') => void;
  setSimulatedText: (txt: string) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<EternaChatMessage[]>>;
  speak: (text: string, onEnd?: () => void) => void;
}

export function useGeneralActions({
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
}: GeneralActionsDeps) {

  const runIntelligentFallback = useCallback((prompt: string) => {
    console.log("[Eterna-Gemini] Ejecutando fallback sin conexión (offline mode) para prompt:", prompt);
    setThinkingContext('general');
    setSimulatedStatus('thinking');
    setSimulatedText(language === 'es' ? 'Pensando...' : 'Thinking...');

    setTimeout(() => {
      try {
        setSimulatedStatus('talking');
        let reply = '';
        const clean = prompt.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        console.log("[Eterna Audit] runIntelligentFallback: Normalized clean prompt is", JSON.stringify(clean));

        // Data-aware responses using intentContext
        if (language === 'es') {
          if (clean.includes('quien') || clean.includes('who') || clean.includes('remitente')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'who wrote me' keywords.");
            const externalMsgs = messages.filter((m) => m.senderId !== currentUser?.id);
            if (externalMsgs.length === 0) {
              reply = 'Nadie te ha escrito ningún mensaje en tu buzón todavía.';
            } else {
              const senderCounts = new Map<string, number>();
              externalMsgs.forEach((m) => {
                const name = m.senderName || 'Otro usuario';
                senderCounts.set(name, (senderCounts.get(name) || 0) + 1);
              });
              const partsES: string[] = [];
              senderCounts.forEach((count, name) => {
                if (count === 1) {
                  partsES.push(`${name} te escribió un mensaje`);
                } else {
                  partsES.push(`${name} te escribió ${count} mensajes`);
                }
              });
              reply = `${partsES.join(' y ')}.`;
            }
          } else if (clean.includes('cuantas propiedades') || clean.includes('mis propiedades')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'properties' keywords.");
            reply = intentContext.myPropertiesCount > 0
              ? (intentContext.myPropertiesCount === 1
                  ? 'Tienes una propiedad publicada en AuraSwap.'
                  : `Tienes ${intentContext.myPropertiesCount} propiedades publicadas en AuraSwap.`)
              : 'Aún no tienes propiedades publicadas. ¿Te gustaría publicar tu primera propiedad?';
          } else if ((clean.includes('mensajes') || clean.includes('sin leer') || clean.includes('nuevos mensajes')) && !clean.includes('quien') && !clean.includes('who') && !clean.includes('remitente')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'messages' keywords.");
            reply = intentContext.unreadMessages > 0
              ? (intentContext.unreadMessages === 1
                  ? 'Tienes un mensaje sin leer en tu buzón.'
                  : `Tienes ${intentContext.unreadMessages} mensajes sin leer en tu buzón.`)
              : 'No tienes mensajes pendientes. Tu buzón está al día.';
          } else if (clean.includes('reseñas') || clean.includes('calificacion') || clean.includes('rating') || clean.includes('valoracion')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'reviews' keywords.");
            const myReviews = reviews.filter((r) => r.reviewedUserId === currentUser?.id);
            const avg = myReviews.length > 0 ? (myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length).toFixed(1) : null;
            const reviewsCountStr = myReviews.length === 1 ? 'una reseña' : `${myReviews.length} reseñas`;
            const pendingReviewsStr = intentContext.pendingReviews === 1
              ? 'Tienes una reseña pendiente por escribir.'
              : `Tienes ${intentContext.pendingReviews} reseñas pendientes por escribir.`;
            reply = avg
              ? `Tu calificación promedio es ${avg} estrellas con ${reviewsCountStr}. ${intentContext.pendingReviews > 0 ? pendingReviewsStr : ''}`
              : 'Aún no tienes reseñas. Completa un intercambio para comenzar a recibir valoraciones.';
          } else if (clean.includes('hola') || clean.includes('buenos') || clean.includes('tardes') || clean.includes('noches')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'greeting' keywords.");
            reply = `¡Hola ${intentContext.userName.split(' ')[0]}! Soy Eterna, tu Concierge de Inteligencia Artificial. ¿En qué puedo asistirte hoy?`;
          } else if (clean.includes('como funciona') || clean.includes('intercambio') || clean.includes('tarifa') || clean.includes('comision')) {
            console.log("[Eterna Audit] runIntelligentFallback: Matched 'aura swap details' keywords.");
            reply = 'AuraSwap permite intercambiar y rentar propiedades de forma directa. Solo cobramos un 1% por intercambio exitoso, lo cual incluye un seguro premium de hasta 1 millón de euros.';
          } else {
            console.log("[Eterna Audit] runIntelligentFallback: Matched NO keywords. Falling back to default offline message.");
            reply = `Disculpa ${intentContext.userName.split(' ')[0]}, en este momento opero en modo offline. Activa la conexión con el servidor para obtener respuestas más detalladas. ¿Puedo ayudarte con algo más?`;
          }
        } else {
          if (clean.includes('quien') || clean.includes('who') || clean.includes('remitente') || clean.includes('sender') || clean.includes('wrote')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'who wrote me' keywords.");
            const externalMsgs = messages.filter((m) => m.senderId !== currentUser?.id);
            if (externalMsgs.length === 0) {
              reply = 'Nobody has written any messages in your inbox yet.';
            } else {
              const senderCounts = new Map<string, number>();
              externalMsgs.forEach((m) => {
                const name = m.senderName || 'Another user';
                senderCounts.set(name, (senderCounts.get(name) || 0) + 1);
              });
              const partsEN: string[] = [];
              senderCounts.forEach((count, name) => {
                if (count === 1) {
                  partsEN.push(`${name} wrote you one message`);
                } else {
                  partsEN.push(`${name} wrote you ${count} messages`);
                }
              });
              reply = `${partsEN.join(' and ')}.`;
            }
          } else if (clean.includes('how many properties') || clean.includes('my properties')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'properties' keywords.");
            reply = intentContext.myPropertiesCount > 0
              ? (intentContext.myPropertiesCount === 1
                  ? 'You have one published property on AuraSwap.'
                  : `You have ${intentContext.myPropertiesCount} published properties on AuraSwap.`)
              : "You don't have any published properties yet. Would you like to list your first one?";
          } else if ((clean.includes('messages') || clean.includes('unread') || clean.includes('new messages')) && !clean.includes('who') && !clean.includes('sender') && !clean.includes('wrote')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'messages' keywords.");
            reply = intentContext.unreadMessages > 0
              ? (intentContext.unreadMessages === 1
                  ? 'You have one unread message in your inbox.'
                  : `You have ${intentContext.unreadMessages} unread messages in your inbox.`)
              : 'No pending messages. Your inbox is all caught up.';
          } else if (clean.includes('reviews') || clean.includes('rating')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'reviews' keywords.");
            const myReviews = reviews.filter((r) => r.reviewedUserId === currentUser?.id);
            const avg = myReviews.length > 0 ? (myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length).toFixed(1) : null;
            const reviewsCountStr = myReviews.length === 1 ? 'one review' : `${myReviews.length} reviews`;
            const pendingReviewsStr = intentContext.pendingReviews === 1
              ? 'You have one pending review to write.'
              : `You have ${intentContext.pendingReviews} pending reviews to write.`;
            reply = avg
              ? `Your average rating is ${avg} stars with ${reviewsCountStr}. ${intentContext.pendingReviews > 0 ? pendingReviewsStr : ''}`
              : "You don't have reviews yet. Complete an exchange to start receiving ratings.";
          } else if (clean.includes('hello') || clean.includes('hi') || clean.includes('morning') || clean.includes('afternoon') || clean.includes('evening')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'greeting' keywords.");
            reply = `Hello ${intentContext.userName.split(' ')[0]}! I am Eterna, your AI Concierge. How can I assist you today?`;
          } else if (clean.includes('how it works') || clean.includes('exchange') || clean.includes('fee') || clean.includes('commission')) {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched 'aura swap details' keywords.");
            reply = 'AuraSwap lets you exchange premium properties or lease them directly. We charge a 1% service fee per successful swap, which includes premium damage protection up to 1 million euros.';
          } else {
            console.log("[Eterna Audit] runIntelligentFallback (EN): Matched NO keywords. Falling back to default offline message.");
            reply = `Sorry ${intentContext.userName.split(' ')[0]}, I'm currently operating in offline mode. Activate the server connection for more detailed responses. Can I help with something else?`;
          }
        }

        console.log("[Eterna Audit] runIntelligentFallback: Generated response:", JSON.stringify(reply));
        setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
        setSimulatedText('');

        speak(reply, () => {
          setSimulatedStatus('idle');
        });
      } catch (err: unknown) {
        const errorObj = err as Error;
        console.error("Error in runIntelligentFallback:", err);
        setSimulatedStatus('idle');
        setThinkingContext('general');
        const fallbackErrorMsg = language === 'es'
          ? `Error en el modo sin conexión: ${errorObj.message || 'Error desconocido'}`
          : `Error in offline mode: ${errorObj.message || 'Unknown error'}`;
        setChatHistory(prev => [...prev, { role: 'assistant', content: fallbackErrorMsg }]);
      }
    }, 800);
  }, [language, currentUser, messages, reviews, intentContext, setThinkingContext, setSimulatedStatus, setSimulatedText, setChatHistory, speak]);

  const callGeminiAvatarAPI = useCallback(async (
    prompt: string,
    currentPropertyId?: string | null,
    activePropertyTitle?: string | null,
    activePropertyDescription?: string | null,
    activePropertyDossier?: string | null
  ) => {
    console.log("[Eterna-Gemini] Iniciando consulta a Gemini API con prompt:", prompt, "currentPropertyId:", currentPropertyId);
    // 1. Cancelar petición Gemini previa si está en curso
    if (geminiAbortControllerRef.current) {
      geminiAbortControllerRef.current.abort();
    }

    // Crear un nuevo AbortController y asociarlo al ref
    const controller = new AbortController();
    geminiAbortControllerRef.current = controller;

    // Controlar si el aborto es por timeout
    let didTimeout = false;

    // Configurar timeout estricto de 25 segundos
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 25000);

    // Cambiar estado a "pensando" con el contexto adecuado
    setThinkingContext(currentPropertyId ? 'property_detail' : 'general');
    setSimulatedStatus('thinking');
    setSimulatedText(language === 'es' ? 'Pensando...' : 'Thinking...');

    try {
      // Optimización de contexto: últimos 20 mensajes normalizados
      const acotadoHistory = chatHistory
        .slice(-20)
        .map(h => ({
          role: h.role === 'user' ? 'user' as const : 'assistant' as const,
          content: h.content
        }));

      if (currentPropertyId) {
        acotadoHistory.unshift({
          role: 'user' as const,
          content: `[System Metadata] El usuario está visualizando el siguiente expediente de propiedad:\n${activePropertyDossier || `ID: ${currentPropertyId}. Título: "${activePropertyTitle || ''}". Descripción: "${activePropertyDescription || ''}".`}`
        });
      }

      let customSystemPrompt = systemPrompt?.content || '';
      if (currentPropertyId) {
        customSystemPrompt += `\n\n---\n[System Metadata - ACTIVE PROPERTY DOSSIER]\nEl usuario está visualizando la siguiente propiedad. Utiliza este expediente para responder sus dudas legales, financieras y comerciales:\n${activePropertyDossier || `ID: ${currentPropertyId}\nTítulo: ${activePropertyTitle || 'Sin título'}\nDescripción: ${activePropertyDescription || 'Sin descripción'}`}`;
      }

      const payload = {
        message: prompt,
        userId: currentUser?.id,
        conversationHistory: acotadoHistory,
        systemPrompt: customSystemPrompt,
        responseMode: currentPropertyId ? 'property_sales' : 'standard',
      };

      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseError = await response.json().catch(() => null) as {
          error?: string;
          code?: string;
          retryable?: boolean;
        } | null;
        const apiError = new Error(
          responseError?.error
          || (language === 'es'
            ? 'Eterna no pudo responder en este momento.'
            : 'Eterna could not respond right now.'),
        ) as Error & { status?: number; code?: string; retryable?: boolean };
        apiError.status = response.status;
        apiError.code = responseError?.code;
        apiError.retryable = responseError?.retryable;
        throw apiError;
      }

      const data = await response.json();

      // Validación de data.reply
      if (!data || typeof data.reply !== 'string' || data.reply.trim() === '') {
        throw new Error("Respuesta de Gemini inválida o vacía.");
      }

      const propertySales = currentPropertyId ? parsePropertySalesResponse(data) : null;

      // Inserción nativa en el historial visual
      console.log("[Eterna-Gemini] Respuesta recibida de la API de Gemini:", data.reply);
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          propertySales: propertySales || undefined,
        },
      ]);

      // Limpiar texto provisional para evitar burbuja duplicada en la UI
      setSimulatedText('');

      // Cambiar estado a "hablando"
      setSimulatedStatus('talking');
      
      // Reproducir voz localmente
      speak(data.reply, () => {
        setSimulatedStatus('idle');
      });

    } catch (error: unknown) {
      const err = error as {
        name?: string;
        message?: string;
        status?: number;
        code?: string;
        retryable?: boolean;
      };
      clearTimeout(timeoutId);
      setSimulatedStatus('idle');

      if (err.name === 'AbortError') {
        if (didTimeout) {
          console.warn("[Eterna-Gemini] Tiempo de espera agotado (25s) para prompt:", prompt);
          const errorMsg = language === 'es'
            ? "Ocurrió un error al comunicarse con Eterna: Tiempo de espera agotado"
            : "An error occurred while communicating with Eterna: Timeout";
          setChatHistory(prev => [...prev, { role: 'assistant', content: errorMsg }]);
          runIntelligentFallback(prompt);
        } else {
          console.log("[Eterna-Gemini] Petición Gemini abortada (nueva petición).");
        }
      } else {
        console.error("[Eterna-Gemini] Error al consultar Gemini REST API:", error);
        if (currentPropertyId) {
          const errorMsg = language === 'es'
            ? (err.retryable || err.status === 503
              ? 'Estoy recibiendo una alta demanda temporal al consultar el expediente. Inténtalo nuevamente en unos segundos; conservaré el contexto de esta propiedad.'
              : 'No pude consultar el expediente en este momento. No quiero darte información legal sin verificar; inténtalo nuevamente en unos segundos.')
            : (err.retryable || err.status === 503
              ? 'I am experiencing temporarily high demand while reviewing the dossier. Please try again in a few seconds; I will keep this property context.'
              : 'I could not review the dossier right now. I do not want to provide unverified legal information; please try again in a few seconds.');
          setChatHistory(prev => [...prev, { role: 'assistant', content: errorMsg }]);
          setSimulatedText('');
          speak(errorMsg, () => setSimulatedStatus('idle'));
          return;
        }

        console.warn('[Eterna-Gemini] Activando asistencia local.', {
          status: err.status,
          code: err.code,
        });
        runIntelligentFallback(prompt);
      }
    } finally {
      if (geminiAbortControllerRef.current === controller) {
        geminiAbortControllerRef.current = null;
      }
    }
  }, [language, currentUser, chatHistory, systemPrompt, geminiAbortControllerRef, setThinkingContext, setSimulatedStatus, setSimulatedText, setChatHistory, speak, runIntelligentFallback]);

  return {
    runIntelligentFallback,
    callGeminiAvatarAPI
  };
}
