"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Send, ArrowRightLeft, ShieldCheck, Check, X,
  MessageCircleCode, ChevronRight, MessageSquare,
  Bot, Sparkles, Mic, MicOff, Wifi, WifiOff, Volume2, VolumeX,
  Activity, Award, ArrowUpRight, AlertCircle, Landmark, Minimize2
} from 'lucide-react';
import { launchConfetti } from '@/components/runtime/launchConfetti';
import { VideoAvatar } from '../../components/VideoAvatar';
import { useWebSocketStream, StreamStatus } from '../../hooks/useWebSocketStream';
import {
  DEFAULT_ETERNA_VOICE_ENGINE,
  ETERNA_VOICE_ENGINE_EVENT,
  ETERNA_VOICE_ENGINE_STORAGE_KEY,
  EternaVoiceEngine,
  getEternaVoiceEngine,
  loadGlobalEternaVoiceSettings,
} from '../../lib/eterna/voiceConfig';
import { normalizeEternaSpeechText } from '../../lib/eterna/speechText';
import {
  createBrowserAudioContext,
  ETERNA_FIRST_AUDIO_TIMEOUT_MS,
  getPcmSampleRate,
  playPcmStream,
  stopPcmSources,
} from '@/features/eterna/audio/pcmStreamPlayer';

import AuthGuard from '../../components/AuthGuard';

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSwapParam = searchParams ? searchParams.get('swapId') : null;
  const { t, language } = useTranslation();
  
  const { 
    currentUser, 
    swaps, 
    properties, 
    myProperties, 
    messages, 
    sendChatMessage, 
    updateSwapStatus,
    markMessagesAsRead,
    users,
    archivedSwapIds,
    archiveConversation,
    unarchiveConversation
  } = useSwap();

  const [activeSwapId, setActiveSwapId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'archived'>('inbox');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Eterna Dedicated Conversation Thread States
  const [eternaChatMessages, setEternaChatMessages] = useState<any[]>([
    {
      id: 'eterna-msg-init',
      senderId: 'eterna',
      senderName: 'Eterna IA',
      content: t('messages.initialWelcome', { name: currentUser?.name ? currentUser.name.split(' ')[0] : 'Viajero' }),
      createdAt: new Date().toISOString()
    }
  ]);

  // Sync initial Eterna welcome message when language changes
  useEffect(() => {
    queueMicrotask(() => {
      setEternaChatMessages(prev => {
        return prev.map(msg => {
          if (msg.id === 'eterna-msg-init') {
            return {
              ...msg,
              content: t('messages.initialWelcome', { name: currentUser?.name ? currentUser.name.split(' ')[0] : 'Viajero' })
            };
          }
          return msg;
        });
      });
    });
  }, [t, currentUser?.name]);

  // Eterna Real-Time Voice/Video Streaming Hook
  const {
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendMessage: wsSendMessage,
    interrupt: wsInterrupt,
    status: wsStatus,
    textResponse,
    isConnected
  } = useWebSocketStream();

  // Local simulated states (for offline robust fallback)
  const [simulatedStatus, setSimulatedStatus] = useState<StreamStatus>('disconnected');
  const [simulatedText, setSimulatedText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesVoiceEngineRef = useRef<EternaVoiceEngine>(DEFAULT_ETERNA_VOICE_ENGINE);
  const messagesVoiceRequestRef = useRef<AbortController | null>(null);
  const messagesPcmContextRef = useRef<AudioContext | null>(null);
  const messagesPcmSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopMessagesVoice = useCallback(() => {
    messagesVoiceRequestRef.current?.abort();
    messagesVoiceRequestRef.current = null;
    stopPcmSources(messagesPcmSourcesRef.current);
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const speakMessagesReply = useCallback(async (reply: string, onEnd: () => void) => {
    if (typeof window === 'undefined' || isMuted || !reply.trim()) {
      onEnd();
      return;
    }

    stopMessagesVoice();
    const engine = messagesVoiceEngineRef.current;
    const speechText = normalizeEternaSpeechText(reply, language === 'es' ? 'es' : 'en');

    const playWithBrowser = () => {
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'es-MX';
      utterance.rate = 1.02;
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.speak(utterance);
    };

    if (engine === 'browser') {
      playWithBrowser();
      return;
    }

    const controller = new AbortController();
    messagesVoiceRequestRef.current = controller;
    let firstAudioTimedOut = false;
    let fallbackStarted = false;
    const firstAudioTimer = window.setTimeout(() => {
      firstAudioTimedOut = true;
      controller.abort();
    }, ETERNA_FIRST_AUDIO_TIMEOUT_MS);
    try {
      const response = await fetch('/api/voz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: speechText,
          engine,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`El motor ${engine} respondió ${response.status}`);

      if (getPcmSampleRate(response)) {
        const context = messagesPcmContextRef.current || createBrowserAudioContext();
        messagesPcmContextRef.current = context;
        await context.resume().catch(() => {});
        await playPcmStream({
          response,
          context,
          signal: controller.signal,
          sources: messagesPcmSourcesRef.current,
          onFirstAudioScheduled: () => {
            window.clearTimeout(firstAudioTimer);
            console.log(`[Messages Voice] reproducción progresiva confirmada con ${engine}`);
          },
          onPlaybackEnded: onEnd,
        });
        return;
      }

      throw new Error(`El motor ${engine} no devolvió audio PCM progresivo`);
    } catch (error) {
      if (controller.signal.aborted && !firstAudioTimedOut) return;
      if (fallbackStarted) return;
      fallbackStarted = true;
      console.error(`[Messages Voice] ${engine} no disponible; usando navegador:`, error);
      playWithBrowser();
    } finally {
      window.clearTimeout(firstAudioTimer);
      if (messagesVoiceRequestRef.current === controller) messagesVoiceRequestRef.current = null;
    }
  }, [isMuted, language, stopMessagesVoice]);

  useEffect(() => {
    const syncEngine = (event?: Event | StorageEvent) => {
      if (event instanceof StorageEvent && event.key !== ETERNA_VOICE_ENGINE_STORAGE_KEY) return;
      const selected = event instanceof CustomEvent
        ? (event as CustomEvent<{ engine?: EternaVoiceEngine }>).detail?.engine
        : undefined;
      messagesVoiceEngineRef.current = selected || getEternaVoiceEngine();
    };

    syncEngine();
    void loadGlobalEternaVoiceSettings().then((settings) => {
      messagesVoiceEngineRef.current = settings.engine;
    }).catch((error) => {
      console.warn('[Messages Voice] No se pudo cargar la configuración global.', error);
    });
    window.addEventListener(ETERNA_VOICE_ENGINE_EVENT, syncEngine);
    window.addEventListener('storage', syncEngine);
    return () => {
      window.removeEventListener(ETERNA_VOICE_ENGINE_EVENT, syncEngine);
      window.removeEventListener('storage', syncEngine);
      stopMessagesVoice();
    };
  }, [stopMessagesVoice]);

  useEffect(() => {
    if (isMuted) stopMessagesVoice();
  }, [isMuted, stopMessagesVoice]);

  // Sync activeSwapId with search query param on load (default to Eterna Concierge for the wow factor!)
  useEffect(() => {
    queueMicrotask(() => setActiveSwapId(activeSwapParam || 'eterna-concierge'));
  }, [activeSwapParam]);

  // Mark messages as read when activeSwapId changes or new messages are loaded
  useEffect(() => {
    if (activeSwapId && activeSwapId !== 'eterna-concierge') {
      markMessagesAsRead(activeSwapId);
    }
  }, [activeSwapId, messages, markMessagesAsRead]);


  // Scroll to top of the window on mount to prevent downward offset displacements
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  // Scroll to bottom of chat internally, avoiding parent window scroll displacement
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, eternaChatMessages, activeSwapId, textResponse, simulatedText]);

  // Sync simulated status when WebSocket is active
  const activeStatus = isConnected ? wsStatus : simulatedStatus;

  // Selected Swap Model (for standard hosts)
  const activeSwap = useMemo(() => {
    if (activeSwapId === 'eterna-concierge') return null;
    return swaps.find((s) => s.id === activeSwapId) || null;
  }, [swaps, activeSwapId]);

  // Filter messages for active swap thread
  const activeMessages = useMemo(() => {
    if (!activeSwapId || activeSwapId === 'eterna-concierge') return [];
    return messages.filter((m) => m.swapRequestId === activeSwapId);
  }, [messages, activeSwapId]);

  // Extract host details for conversation list
  const conversationList = useMemo(() => {
    if (!currentUser) return [];

    // Filter swaps list based on activeFolder
    const filteredSwaps = swaps.filter((swap) => {
      const isArchived = archivedSwapIds.includes(swap.id);
      return activeFolder === 'archived' ? isArchived : !isArchived;
    });

    const list = filteredSwaps.map((swap) => {
      const isSender = swap.senderId === currentUser.id;
      const partnerPropertyId = isSender ? swap.receiverPropertyId : swap.senderPropertyId;
      const partnerProperty = properties.find((p) => p.id === partnerPropertyId);
      
      const partnerId = isSender ? swap.receiverId : swap.senderId;
      const partnerUser = users.find((u) => u.id === partnerId);
      
      let partnerName = 'Verified Host';
      let partnerAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
      
      if (partnerUser) {
        partnerName = partnerUser.name;
        partnerAvatar = partnerUser.avatar;
      } else if (partnerProperty) {
        partnerName = partnerProperty.hostName;
        partnerAvatar = partnerProperty.hostAvatar;
      }

      const threadMsgs = messages.filter((m) => m.swapRequestId === swap.id);
      const lastMsg = threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1].content : (language === 'es' ? 'Oferta de swap' : 'Swap proposal');
      const unreadCount = threadMsgs.filter((m) => m.senderId !== currentUser.id && !m.isRead).length;

      return {
        swapId: swap.id,
        partnerName,
        partnerAvatar,
        propertyTitle: partnerProperty?.title || (language === 'es' ? 'Espacio exclusivo' : 'Exclusive space'),
        lastMessage: lastMsg,
        status: swap.status,
        dateRange: `${swap.startDate} ${t('details.proposedEnd').toLowerCase()} ${swap.endDate}`,
        unreadCount
      };
    });

    // Prepend Eterna IA Concierge at the top of the Inbox list only
    if (activeFolder === 'inbox') {
      const eternaItem = {
        swapId: 'eterna-concierge',
        partnerName: t('messages.eternaTitle'),
        partnerAvatar: '/avatar.png',
        propertyTitle: t('messages.smartRecommendations'),
        lastMessage: isConnected 
          ? (textResponse || t('messages.realtimeChannelOpen')) 
          : (simulatedText || t('messages.statusIdle')),
        status: 'APPROVED' as const,
        dateRange: t('nav.hostPro'),
      };
      return [eternaItem, ...list];
    }

    return list;
  }, [swaps, messages, properties, currentUser, isConnected, textResponse, simulatedText, t, language, users, archivedSwapIds, activeFolder]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    // Stop speaking if talking
    if (activeStatus === 'talking') {
      if (isConnected) {
        wsInterrupt();
      } else {
        stopMessagesVoice();
        setSimulatedStatus('idle');
      }
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Toggle WS connection inside Consultation Console
  const handleConnectToggle = () => {
    if (isConnected) {
      wsDisconnect();
      setSimulatedStatus('disconnected');
    } else {
      wsConnect('ws://localhost:8000/api/stream').catch(() => {
        setSimulatedStatus('idle');
      });
      setSimulatedStatus('idle');
    }
  };

  // Dynamic Prompt Injection for Messages console
  const systemPrompt = useMemo(() => {
    return {
      role: 'system',
      content: `Eres Eterna, la Concierge IA de Lujo oficial de Towers México.
Estás en la pantalla del "Messages Consulting Dashboard" conversando cara a cara con Mateo Valenzuela.
Instrucciones lingüísticas:
1. Responde strictly en ESPAÑOL neutro, cálido, formal y sofisticado.
2. Mantén las respuestas extremadamente cortas (1-3 oraciones fluidas) óptimas para voz.
3. Sugiere y promueve el catálogo de villas y penthouses de forma interactiva.
REGLAS DE INTERCAMBIO:
* Renta: 0€ (Intercambio recíproco libre de renta).
* Tarifa: 1% único de tarifa de servicio.
* Seguro de daños premium incluido de hasta 1 millón de euros.
* 100% de propietarios verificados.`
    };
  }, []);

  // Offline Conversation Simulator for Messages console
  const runMessagesSimulator = useCallback((prompt: string) => {
    setSimulatedStatus('thinking');
    setSimulatedText('Pensando...');

    setTimeout(() => {
      setSimulatedStatus('talking');
      let reply = 'Lo lamento Mateo, el motor de streaming en tiempo real se encuentra en simulación offline local. ¿Te gustaría saber cómo solicitar un swap gratuito?';
      
      const clean = prompt.toLowerCase();
      
      if (clean.includes('hola') || clean.includes('buenos') || clean.includes('tardes') || clean.includes('noches')) {
        reply = '¡Hola Mateo! Soy Eterna. Qué placer saludarte en tu consola de consultoría premium. Estoy aquí para recomendarte los mejores lofts en París, villas en Cancún o guiarte en tu swap. ¿A dónde deseas viajar?';
      } else if (clean.includes('recomiend') || clean.includes('casa') || clean.includes('villa') || clean.includes('cancun') || clean.includes('paris') || clean.includes('bali')) {
        reply = 'Te recomiendo la "Modernist Concrete Villa" en Cancún (98% Match, Luxury) con piscina infinita y playa privada, o el romántico "17th-Century Marais Loft" en París. Haz clic en las tarjetas de recomendación abajo a la derecha para verlas.';
      } else if (clean.includes('gratis') || clean.includes('comision') || clean.includes('tarifa') || clean.includes('precio') || clean.includes('costo')) {
        reply = 'En Towers México el coste de alquiler es exactamente de 0€. Cobramos un fee fijo del 1% por swap completado para financiar tu seguro premium contra daños de 1 millón de euros y la validación de perfiles.';
      } else if (clean.includes('llaves') || clean.includes('llegar') || clean.includes('check')) {
        reply = 'Los check-ins son autónomos mediante códigos digitales que el anfitrión te enviará en una guía en formato PDF unos días antes de tu viaje.';
      } else if (clean.includes('wifi') || clean.includes('internet') || clean.includes('velocidad')) {
        reply = 'Todas nuestras propiedades verificadas garantizan conexiones simétricas de fibra óptica de más de 100 Mbps, idóneo para videoconferencias y trabajo remoto.';
      }

      setSimulatedText(reply);
      setEternaChatMessages(prev => [...prev, {
        id: `eterna-msg-${Date.now()}`,
        senderId: 'eterna',
        senderName: 'Eterna IA',
        content: reply,
        createdAt: new Date().toISOString()
      }]);

      if (!isMuted) {
        void speakMessagesReply(reply, () => {
          setSimulatedStatus('idle');
          setSimulatedText('');
        });
      } else {
        setSimulatedStatus('idle');
        setSimulatedText('');
      }
    }, 1200);
  }, [isMuted, speakMessagesReply]);

  // Sync streaming WebSocket chunk to chat history when WS ends speaking
  useEffect(() => {
    if (isConnected && textResponse && wsStatus === 'idle') {
      queueMicrotask(() => {
        setEternaChatMessages(prev => [...prev, {
          id: `eterna-msg-${crypto.randomUUID()}`,
          senderId: 'eterna',
          senderName: 'Eterna IA',
          content: textResponse,
          createdAt: new Date().toISOString()
        }]);
      });
    }
  }, [wsStatus, isConnected, textResponse]);

  // Handle Send Prompt
  const handleSendPrompt = useCallback((textToSend?: string) => {
    const prompt = textToSend || typedMessage;
    if (!prompt.trim()) return;

    // Interrupt current speech
    if (activeStatus === 'talking') {
      if (isConnected) {
        wsInterrupt();
      } else {
        stopMessagesVoice();
        setSimulatedStatus('idle');
      }
    }

    // Add user message
    const userMsg = {
      id: `user-msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: prompt,
      createdAt: new Date().toISOString()
    };
    setEternaChatMessages(prev => [...prev, userMsg]);
    setTypedMessage('');

    if (isConnected) {
      // Send message to WebSockets server
      wsSendMessage(prompt, [systemPrompt, ...eternaChatMessages.map(m => ({
        role: m.senderId === currentUser.id ? 'user' : 'assistant',
        content: m.content
      }))]);
    } else {
      // Offline fallback
      runMessagesSimulator(prompt);
    }
  }, [
    activeStatus,
    currentUser.id,
    currentUser.name,
    eternaChatMessages,
    isConnected,
    runMessagesSimulator,
    stopMessagesVoice,
    systemPrompt,
    typedMessage,
    wsInterrupt,
    wsSendMessage,
  ]);

  // Web Speech API Voice Recognition inside Messages Console. This lives
  // after handleSendPrompt so the callback always closes over the current handler.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        queueMicrotask(() => setSpeechRecognitionSupported(true));
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'es-MX';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          if (resultText) handleSendPrompt(resultText);
        };
        recognitionRef.current = rec;
      }
    }
  }, [handleSendPrompt]);

  // Standard Messages handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeSwapId === 'eterna-concierge') {
      handleSendPrompt();
      return;
    }

    if (!activeSwapId || !typedMessage.trim() || !activeSwap) return;

    // Send user message
    sendChatMessage(activeSwapId, typedMessage, currentUser.id);
    const sentText = typedMessage;
    setTypedMessage('');

    // Simulate standard host response
    const partnerId = activeSwap.senderId === currentUser.id ? activeSwap.receiverId : activeSwap.senderId;
    
    setTimeout(() => {
      let mockReply = language === 'es'
        ? `¡Gracias por tu mensaje! Estoy entusiasmado de coordinar todos los detalles para nuestro intercambio en ${activeSwap.startDate.split('-')[0]}.`
        : `Thanks for your message! Looking forward to aligning details for our swap in ${activeSwap.startDate.split('-')[0]}.`;
      
      const lowerText = sentText.toLowerCase();
      if (lowerText.includes('key') || lowerText.includes('check') || lowerText.includes('arrive') || lowerText.includes('llav') || lowerText.includes('lleg')) {
        mockReply = language === 'es'
          ? `¡Excelente pregunta! Suelo dejar el código de la cerradura inteligente en un cofre digital en la entrada privada. ¡Te enviaré una guía en PDF unos días antes con los códigos!`
          : `Excellent question. I usually leave the smart lock code in a secure lockbox at the private entrance. I will send you a full PDF guest guide with all access codes, parking slots, and wifi passwords a few days before check-in!`;
      } else if (lowerText.includes('wifi') || lowerText.includes('work') || lowerText.includes('internet') || lowerText.includes('red')) {
        mockReply = language === 'es'
          ? `Sí, ¡el wifi vuela! Tengo conexión simétrica de fibra óptica y normalmente alcanza unos 150 Mbps de velocidad. Hay un escritorio de trabajo dedicado super cómodo.`
          : `Yes, the wifi is blazing fast! I have high-speed optic fiber connection, regularly getting around 150 Mbps download. There's a dedicated workspace with an ergonomic chair and a solid oak desk.`;
      } else if (lowerText.includes('pet') || lowerText.includes('dog') || lowerText.includes('cat') || lowerText.includes('masco') || lowerText.includes('perr') || lowerText.includes('gat')) {
        mockReply = language === 'es'
          ? `El espacio es pet-friendly siempre que estén bien educadas. ¡Solo pido que por favor no suban a las sábanas de hilo!`
          : `The space is pet-friendly as long as they are well-behaved. I just ask that they stay off the linen furniture!`;
      } else if (lowerText.includes('recommend') || lowerText.includes('food') || lowerText.includes('restaurant') || lowerText.includes('recomiend') || lowerText.includes('comer') || lowerText.includes('restauran')) {
        mockReply = language === 'es'
          ? `Te sugiero altamente la pequeña panadería local que está a dos esquinas. Su pan de masa madre y croissants de la mañana son increíbles. ¡Te dejaré una lista escrita con mis lugares preferidos!`
          : `I would highly recommend the small local bakery just two blocks down. Their sourdough and morning pastries are incredible. I'll make sure to leave a handwritten list of my absolute favorite spots!`;
      }

      sendChatMessage(activeSwapId, mockReply, partnerId);
    }, 1500);
  };

  const handleAcceptProposal = () => {
    if (!activeSwapId) return;
    updateSwapStatus(activeSwapId, 'APPROVED');
    
    // Shower confetti
    launchConfetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.5 }
    });
  };

  const handleDeclineProposal = () => {
    if (!activeSwapId) return;
    updateSwapStatus(activeSwapId, 'DECLINED');
  };

  // Resolve properties involved in the current active swap
  const activeSwapDetails = useMemo(() => {
    if (!activeSwap || !currentUser) return null;
    
    const isSender = activeSwap.senderId === currentUser.id;
    const userPropId = isSender ? activeSwap.senderPropertyId : activeSwap.receiverPropertyId;
    const partnerPropId = isSender ? activeSwap.receiverPropertyId : activeSwap.senderPropertyId;
    
    const userProp = myProperties.find((p) => p.id === userPropId) || properties.find((p) => p.id === userPropId);
    const partnerProp = properties.find((p) => p.id === partnerPropId) || myProperties.find((p) => p.id === partnerPropId);

    return {
      userProp,
      partnerProp,
      isIncoming: activeSwap.receiverId === currentUser.id,
    };
  }, [activeSwap, myProperties, properties, currentUser]);

  if (!currentUser) {
    return <AuthGuard />;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24">
      <div className="flex flex-col lg:flex-row bg-white border border-brand-gray-200/80 rounded-3xl overflow-hidden shadow-premium min-h-[550px] lg:h-[700px] items-stretch">
        
        {/* COLUMN 1: CONVERSATIONS LIST (LEFT) */}
        <div className="w-full lg:w-80 border-r border-brand-gray-200/80 flex flex-col bg-brand-gray-50/50 shrink-0">
          <div className="p-4 border-b border-brand-gray-200/80">
            <h2 className="text-sm font-black text-brand-black tracking-tight flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-accent animate-pulse" />
              <span>{t('messages.inboxNegotiations')}</span>
            </h2>
            <div className="flex gap-2 mt-3 bg-brand-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('inbox');
                  setActiveSwapId('eterna-concierge'); // reset to Eterna on inbox switch
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeFolder === 'inbox'
                    ? 'bg-white text-brand-black shadow-sm'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                {t('messages.folderInbox')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFolder('archived');
                  setActiveSwapId(null); // Reset when switching to archived
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeFolder === 'archived'
                    ? 'bg-white text-brand-black shadow-sm'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                {t('messages.folderArchived')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-brand-gray-200/40">
            {conversationList.length > 0 ? (
              conversationList.map((conv) => {
                const isActive = conv.swapId === activeSwapId;
                const isEterna = conv.swapId === 'eterna-concierge';
                return (
                  <button
                    key={conv.swapId}
                    onClick={() => {
                      setActiveSwapId(conv.swapId);
                      router.replace(`/messages?swapId=${conv.swapId}`);
                    }}
                    className={`w-full p-4 text-left flex gap-3 transition-colors outline-none cursor-pointer border-l-4 ${
                      isActive 
                        ? isEterna 
                          ? 'bg-indigo-50/40 border-l-brand-accent' 
                          : 'bg-white border-l-brand-accent' 
                        : 'hover:bg-brand-gray-100/50 border-l-transparent'
                    }`}
                  >
                    {isEterna ? (
                      <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent shrink-0 shadow-sm relative">
                        <Bot className="w-5 h-5 animate-pulse" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-brand-accent rounded-full border border-white flex items-center justify-center">
                          <Sparkles className="w-1.5 h-1.5 text-white" />
                        </span>
                      </div>
                    ) : (
                      <Image
                        src={conv.partnerAvatar || '/avatar-placeholder.svg'}
                        alt={conv.partnerName}
                        width={40}
                        height={40}
                        sizes="40px"
                        unoptimized
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-brand-gray-200 shadow-sm"
                      />
                    )}
                    
                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs font-bold truncate ${isEterna ? 'text-brand-accent' : 'text-brand-black'}`}>
                            {conv.partnerName}
                          </span>
                          {!isEterna && (conv as any).unreadCount > 0 && (
                            <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shrink-0 shadow-sm animate-pulse">
                              {(conv as any).unreadCount}
                            </span>
                          )}
                        </div>
                        {isEterna ? (
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-brand-accent text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                            {t('messages.statusLive')}
                          </span>
                        ) : (
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            conv.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                            conv.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-brand-gray-100 text-brand-gray-400'
                          }`}>
                             {conv.status === 'PENDING' ? t('dashboard.statusPending').split(' ')[0] :
                              conv.status === 'APPROVED' ? t('dashboard.statusApproved').split(' ')[0] :
                              t('dashboard.statusDeclined').split(' ')[0]}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-brand-gray-500 font-semibold truncate mb-1">
                        {conv.propertyTitle}
                      </p>
                      
                      <p className="text-xs text-brand-gray-500 truncate font-normal">
                        {conv.lastMessage}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-brand-gray-500 flex flex-col items-center gap-2">
                <AlertCircle className="w-6 h-6 text-brand-gray-300 shrink-0" />
                <span>
                  {activeFolder === 'archived'
                    ? t('messages.emptyArchived')
                    : t('messages.emptyMailbox')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: ACTIVE CHAT SCREEN (CENTER) */}
        <div className="flex-grow flex flex-col min-w-0 bg-white">
          {activeSwapId === 'eterna-concierge' ? (
            <>
              {/* Eterna IA Active Banner */}
              <div className="p-4 border-b border-brand-gray-200/80 flex items-center justify-between bg-indigo-50/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent shadow-sm border border-brand-accent/20">
                    <Bot className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-brand-black flex items-center gap-1">
                      <span>{t('messages.eternaTitle')}</span>
                      <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                    </h3>
                    <p className="text-[10px] text-brand-gray-500 font-medium">
                      {isConnected ? t('messages.realtimeChannelOpen') : t('messages.offlineSimulatorActive')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat messages feed for Eterna */}
              <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 bg-brand-gray-50/10">
                {eternaChatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                    >
                      <div className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed font-semibold ${
                        isMe
                          ? 'bg-brand-accent text-white rounded-tr-none'
                          : 'bg-white border border-indigo-100 text-brand-black rounded-tl-none border-l-4 border-l-brand-accent'
                      }`}>
                        <span className={`text-[8px] font-bold uppercase tracking-wider block mb-1 opacity-75 ${
                          isMe ? 'text-indigo-200' : 'text-brand-accent'
                        }`}>
                          {isMe ? t('messages.typing') : 'Eterna Concierge'}
                        </span>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Real-time Streaming WebSockets text response */}
                {isConnected && textResponse && wsStatus === 'talking' && (
                  <div className="flex justify-start animate-pulse">
                    <div className="max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed font-semibold bg-white border border-brand-gray-200 text-brand-black rounded-tl-none border-l-4 border-l-brand-accent">
                      <span className="text-[8px] font-bold uppercase tracking-wider block mb-1 text-brand-accent">
                        {t('messages.eternaTalking')}
                      </span>
                      <p>{textResponse}</p>
                    </div>
                  </div>
                )}

                {/* Real-time Simulation text response */}
                {!isConnected && simulatedText && simulatedStatus === 'talking' && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed font-semibold bg-white border border-brand-gray-200 text-brand-black rounded-tl-none border-l-4 border-l-brand-accent">
                      <span className="text-[8px] font-bold uppercase tracking-wider block mb-1 text-brand-accent">
                        {t('messages.eternaSimulating')}
                      </span>
                      <p>{simulatedText}</p>
                    </div>
                  </div>
                )}

                {/* Thinking bubble indicator */}
                {activeStatus === 'thinking' && (
                  <div className="flex justify-start">
                    <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-2xl px-4 py-2.5 flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input for Eterna IA */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-brand-gray-200/80 bg-white">
                <div className="flex gap-2 bg-brand-gray-50 border border-brand-gray-200 p-1.5 rounded-2xl focus-within:border-brand-accent transition-colors">
                  <input
                    type="text"
                    placeholder={isListening ? t('messages.listeningVoice') : t('messages.askEternaPlaceholder')}
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    disabled={isListening}
                    className="flex-grow pl-3 py-2 outline-none text-xs font-semibold bg-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!typedMessage.trim() && activeStatus !== 'talking'}
                    className={`p-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer ${
                      typedMessage.trim()
                        ? 'bg-brand-accent text-white hover:scale-105 active:scale-95'
                        : activeStatus === 'talking'
                        ? 'bg-brand-gray-800 text-white hover:scale-105 active:scale-95'
                        : 'bg-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {activeStatus === 'talking' && !typedMessage.trim() ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <span className="text-[9px] text-brand-gray-500 mt-2 block pl-2 font-medium">
                  {t('messages.popularQuestions')} <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(t('messages.howWorksPrompt'))}>{t('messages.questionHowWorks')}</span>, <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(t('messages.beachVillaPrompt'))}>{t('messages.questionBeachVilla')}</span>, o <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(t('messages.feesInsurancePrompt'))}>{t('messages.questionInsurance')}</span>.
                </span>
              </form>
            </>
          ) : activeSwap ? (
            <>
              {/* Active Conversation Partner Banner */}
              <div className="p-4 border-b border-brand-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Image
                    src={conversationList.find((c) => c.swapId === activeSwapId)?.partnerAvatar || '/avatar-placeholder.svg'}
                    alt="Active Partner"
                    width={36}
                    height={36}
                    sizes="36px"
                    unoptimized
                    className="w-9 h-9 rounded-full object-cover border border-brand-gray-100 shadow-sm"
                  />
                  <div>
                    <h3 className="text-xs font-extrabold text-brand-black">
                      {conversationList.find((c) => c.swapId === activeSwapId)?.partnerName}
                    </h3>
                    <p className="text-[10px] text-brand-gray-500 font-medium">
                      {t('messages.directMessagingActive')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (activeFolder === 'archived') {
                        unarchiveConversation(activeSwapId!);
                        setActiveSwapId(null);
                      } else {
                        archiveConversation(activeSwapId!);
                        setActiveSwapId('eterna-concierge');
                      }
                    }}
                    className="px-3.5 py-2 bg-brand-gray-50 hover:bg-brand-gray-100 rounded-xl text-brand-gray-500 hover:text-brand-black border border-brand-gray-200 transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <span>{activeFolder === 'archived' ? t('messages.unarchiveBtn') : t('messages.archiveBtn')}</span>
                  </button>
                </div>
              </div>

              {/* Chat messages feed */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-brand-gray-50/20">
                {activeMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  const isSystem = msg.senderId === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="w-full flex justify-center my-2">
                        <span className="bg-brand-gray-100 text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 px-3 py-1 rounded-full border border-brand-gray-200">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                    >
                      <div className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed font-medium ${
                        isMe
                          ? 'bg-brand-accent text-white rounded-tr-none'
                          : 'bg-white border border-brand-gray-200 text-brand-black rounded-tl-none'
                      }`}>
                        <span className={`text-[8px] font-bold uppercase tracking-wider block mb-1 opacity-75 ${
                          isMe ? 'text-white' : 'text-brand-accent'
                        }`}>
                          {msg.senderName.split(' ')[0]}
                        </span>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input sending drawer bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-brand-gray-200/80 bg-white">
                <div className="flex gap-2 bg-brand-gray-50 border border-brand-gray-200 p-1.5 rounded-2xl focus-within:border-brand-accent transition-colors">
                  <input
                    type="text"
                    placeholder={t('messages.writeFriendlyReply', { name: conversationList.find((c) => c.swapId === activeSwapId)?.partnerName || '' })}
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    className="flex-grow pl-3 py-2 outline-none text-xs font-semibold bg-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!typedMessage.trim()}
                    className={`p-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer ${
                      typedMessage.trim()
                        ? 'bg-brand-accent text-white hover:scale-105 active:scale-95'
                        : 'bg-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[9px] text-brand-gray-500 mt-2 block pl-2 font-medium">
                  {t('messages.tryAskingAbout')} <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(language === 'es' ? "¿Cuáles son los detalles del código de acceso?" : "What is the check-in lock code details?")}>{t('messages.keysDetails')}</span>, <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(language === 'es' ? "¿Tienen conexión a internet wifi rápida?" : "Is there reliable fast wifi internet connection?")}>{t('messages.wifiDetails')}</span>, o <span className="underline hover:text-brand-black cursor-pointer" onClick={() => setTypedMessage(language === 'es' ? "¿Alguna recomendación de panadería o restaurante cerca?" : "Do you have any good bakery recommendations?")}>{t('messages.bakeryDetails')}</span>!
                </span>
              </form>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
              <MessageCircleCode className="w-12 h-12 text-brand-gray-300 mb-3 animate-pulse" />
              <h3 className="font-bold text-brand-black text-sm mb-1">{t('messages.selectNegotiation')}</h3>
              <p className="text-xs text-brand-gray-500 max-w-xs">
                {t('messages.selectNegotiationDesc')}
              </p>
            </div>
          )}
        </div>

        {/* COLUMN 3: SWAP DETAILS (LEFT) & ETERNA VISUAL CONSULTATION DASHBOARD (RIGHT) */}
        {activeSwapId === 'eterna-concierge' ? (
          /* ETERNA REALTIME CONSULTATION PANEL */
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-brand-gray-200/80 flex flex-col p-5 bg-brand-gray-50/50 justify-between shrink-0 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-black text-brand-black tracking-tight uppercase pb-2 border-b border-brand-gray-200 flex items-center justify-between">
                <span>{t('messages.visualConsultation')}</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                </span>
              </h3>

              {/* Large Eterna Canvas Stream Viewport */}
              <div className="bg-slate-900 rounded-3xl p-3 flex flex-col items-center border border-indigo-150 shadow-inner relative overflow-hidden h-[240px]">
                <div className="scale-[0.55] origin-center -my-36 h-[430px] flex items-center justify-center">
                  <VideoAvatar status={activeStatus} />
                </div>

                {/* Toggles for connect / mic inside console */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-30">
                  <button
                    onClick={handleConnectToggle}
                    className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md border transition-all cursor-pointer ${
                      isConnected
                        ? 'bg-emerald-500/90 text-white border-emerald-400 hover:scale-102'
                        : 'bg-brand-gray-800/90 text-white border-brand-gray-600 hover:scale-102'
                    }`}
                  >
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    <span>{isConnected ? t('messages.statusConnected') : t('messages.statusDisconnected')}</span>
                  </button>

                  <div className="flex gap-1">
                    {speechRecognitionSupported && (
                      <button
                        onClick={toggleListening}
                        className={`p-2 rounded-full border shadow-md cursor-pointer transition-all ${
                          isListening
                            ? 'bg-brand-rose text-white border-brand-rose animate-pulse'
                            : 'bg-white/90 border-brand-gray-200 text-brand-gray-600 hover:bg-white'
                        }`}
                        title={isListening ? t('messages.muteMic') : t('messages.talkMic')}
                      >
                        {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      </button>
                    )}

                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-2 rounded-full border shadow-md cursor-pointer transition-all ${
                        isMuted
                          ? 'bg-brand-rose/90 text-white border-brand-rose hover:bg-brand-rose'
                          : 'bg-white/90 border-brand-gray-200 text-brand-gray-600 hover:bg-white'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* RAG & Latency Diagnostics */}
              <div className="bg-white border border-indigo-50 shadow-sm rounded-2xl p-3 flex flex-col gap-2">
                <span className="text-[8px] uppercase tracking-widest text-brand-gray-400 font-bold block mb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-brand-accent" />
                  <span>{t('messages.realtimeEngineDiagnostics')}</span>
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-brand-gray-500">
                  <div className="bg-brand-gray-50 p-2 rounded-lg border border-brand-gray-100">
                    <p className="text-[8px] uppercase text-brand-gray-400">{t('messages.pipelineLatency')}</p>
                    <p className="text-brand-black font-extrabold mt-0.5">~180ms TTFT</p>
                  </div>
                  <div className="bg-brand-gray-50 p-2 rounded-lg border border-brand-gray-100">
                    <p className="text-[8px] uppercase text-brand-gray-400">{t('messages.audioJitter')}</p>
                    <p className="text-brand-black font-extrabold mt-0.5">200ms Guard</p>
                  </div>
                  <div className="bg-brand-gray-50 p-2 rounded-lg border border-brand-gray-100">
                    <p className="text-[8px] uppercase text-brand-gray-400">{t('messages.vectorSearch')}</p>
                    <p className="text-brand-black font-extrabold mt-0.5">MiniLM-L6-v2</p>
                  </div>
                  <div className="bg-brand-gray-50 p-2 rounded-lg border border-brand-gray-100">
                    <p className="text-[8px] uppercase text-brand-gray-400">{t('messages.ttsSynthesis')}</p>
                    <p className="text-brand-black font-extrabold mt-0.5">ElevenLabs V2</p>
                  </div>
                </div>
              </div>

              {/* Interactive property suggestions based on dialog */}
              <div className="flex flex-col gap-2">
                <span className="text-[8px] uppercase tracking-widest text-brand-gray-400 font-bold block flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-brand-accent" />
                  <span>{t('messages.eternaPropertyGuides')}</span>
                </span>

                <div className="flex flex-col gap-2">
                  {properties.slice(0, 2).map((prop) => (
                    <div 
                      key={prop.id}
                      onClick={() => window.open(`/property/${prop.id}`, '_blank')}
                      className="bg-white border border-brand-gray-200 hover:border-brand-accent p-2.5 rounded-2xl flex gap-2.5 cursor-pointer shadow-xs hover:shadow-sm transition-all"
                      title={t('messages.openInNewTab')}
                    >
                      <Image
                        src={prop.images[0] || '/property-placeholder.svg'}
                        alt={prop.title}
                        width={40}
                        height={40}
                        sizes="40px"
                        unoptimized
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div className="overflow-hidden flex-1 relative">
                        <p className="text-[9px] font-black text-brand-black truncate pr-4">{prop.title}</p>
                        <p className="text-[8px] text-brand-gray-500 font-semibold">{prop.location}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] bg-brand-accent/5 text-brand-accent font-extrabold px-1 py-0.25 rounded">
                            {prop.auraScore}% Match
                          </span>
                          <span className="text-[8px] bg-emerald-50 text-emerald-600 font-extrabold px-1 py-0.25 rounded uppercase">
                            {prop.valueRating}
                          </span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-brand-gray-400 absolute right-0 top-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-brand-gray-200 pt-3 text-[10px] text-brand-gray-500 font-medium leading-relaxed bg-white/40 p-2.5 rounded-2xl border border-white/50">
              <span className="flex items-center gap-1 font-bold text-brand-black mb-0.5">
                <Award className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                <span>{t('messages.eternaTitle').split(' ')[0]}</span>
              </span>
              {language === 'es' 
                ? 'Eterna guía tus swaps, detalla las normas contractuales y sugiere residencias analizando tus gustos vacacionales en tiempo real.' 
                : 'Eterna guides your swaps, details contract rules, and suggests properties by analyzing your vacation tastes in real time.'}
            </div>
          </div>
        ) : activeSwap && activeSwapDetails ? (
          /* STANDARD SWAP NEGOTIATION CONTROLS */
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-brand-gray-200/80 flex flex-col p-5 bg-brand-gray-50/50 justify-between shrink-0">
            <div>
              <h3 className="text-xs font-black text-brand-black tracking-tight uppercase mb-4 pb-2 border-b border-brand-gray-200">
                {language === 'es' ? 'Estado del Acuerdo de Swap' : 'Swap Agreement Status'}
              </h3>

              <div className="flex items-center gap-1.5 mb-6 text-[10px] font-bold justify-between">
                <span className="text-brand-accent">1. {language === 'es' ? 'Propuesto' : 'Proposed'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-brand-gray-400" />
                <span className={activeSwap.status === 'APPROVED' ? 'text-brand-accent' : 'text-brand-gray-400'}>2. {language === 'es' ? 'Confirmado' : 'Confirmed'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-brand-gray-400" />
                <span className="text-brand-gray-400">3. {language === 'es' ? 'Viaje' : 'Travel'}</span>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="p-3 bg-white border border-brand-gray-200 rounded-2xl">
                  <p className="text-[8px] uppercase tracking-widest text-brand-gray-400 font-bold mb-1">{t('messages.checklistHost')}</p>
                  <div className="flex gap-2.5 items-center">
                    <Image
                      src={activeSwapDetails.partnerProp?.images[0] || '/property-placeholder.svg'}
                      alt="Partner Home"
                      width={40}
                      height={40}
                      sizes="40px"
                      unoptimized
                      className="w-10 h-10 rounded-xl object-cover border border-brand-gray-100"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-brand-black truncate">{activeSwapDetails.partnerProp?.title}</p>
                      <p className="text-[10px] text-brand-gray-500 truncate">{activeSwapDetails.partnerProp?.location}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center my-0.5">
                  <div className="p-1.5 rounded-full bg-brand-accent/5 text-brand-accent border border-brand-accent/10">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="p-3 bg-white border border-brand-gray-200 rounded-2xl">
                  <p className="text-[8px] uppercase tracking-widest text-brand-gray-400 font-bold mb-1">{t('messages.checklistGuest')}</p>
                  <div className="flex gap-2.5 items-center">
                    <Image
                      src={activeSwapDetails.userProp?.images[0] || '/property-placeholder.svg'}
                      alt="User Home"
                      width={40}
                      height={40}
                      sizes="40px"
                      unoptimized
                      className="w-10 h-10 rounded-xl object-cover border border-brand-gray-100"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-brand-black truncate">{activeSwapDetails.userProp?.title}</p>
                      <p className="text-[10px] text-brand-gray-500 truncate">{activeSwapDetails.userProp?.location}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-brand-gray-200 rounded-2xl p-3 bg-white text-xs font-medium mb-6">
                <span className="text-[9px] uppercase tracking-widest text-brand-gray-400 font-bold block mb-1">{language === 'es' ? 'Calendario de Fechas' : 'Calendar Schedule'}</span>
                <span className="text-brand-black font-semibold text-xs">{activeSwap.startDate} {t('details.proposedEnd').toLowerCase()} {activeSwap.endDate}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-gray-200">
              {activeSwap.status === 'PENDING' ? (
                activeSwapDetails.isIncoming ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleAcceptProposal}
                      className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1 cursor-pointer transition-transform duration-200 hover:scale-[1.01]"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t('messages.acceptProposalBtn')}</span>
                    </button>
                    <button
                      onClick={handleDeclineProposal}
                      className="w-full py-3 border border-brand-gray-200 hover:bg-brand-rose/5 hover:border-brand-rose hover:text-brand-rose text-brand-gray-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>{t('messages.declineProposalBtn')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl text-center">
                    <p className="text-xs font-bold text-amber-800">{t('messages.proposalPendingReview')}</p>
                    <p className="text-[10px] text-amber-700/80 leading-relaxed mt-1">
                      {t('messages.proposalReviewDesc')}
                    </p>
                  </div>
                )
              ) : activeSwap.status === 'APPROVED' ? (
                <div className="bg-emerald-50 border border-emerald-200/50 p-4 rounded-2xl text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-emerald-800">{t('messages.swapConfirmed')}</p>
                  <p className="text-[10px] text-emerald-700/80 leading-relaxed mt-1">
                    {t('messages.swapConfirmedDesc')}
                  </p>
                </div>
              ) : (
                <div className="bg-brand-gray-100 border border-brand-gray-200 p-4 rounded-2xl text-center">
                  <p className="text-xs font-bold text-brand-gray-500">{t('dashboard.statusDeclined')}</p>
                  <p className="text-[10px] text-brand-gray-400 mt-1">
                    {language === 'es' 
                      ? 'Esta solicitud de intercambio ha sido declinada. Intenta proponer otro espacio o fechas.' 
                      : 'This exchange swap request has been declined. Try proposing another space or dates.'}
                  </p>
                </div>
              )}
            </div>

          </div>
        ) : null}

      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useTranslation();
  return (
    <React.Suspense fallback={
      <div className="max-w-7xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-brand-gray-500 text-sm font-semibold">{t('explore.loadingBtn')}</p>
      </div>
    }>
      <MessagesPageContent />
    </React.Suspense>
  );
}
