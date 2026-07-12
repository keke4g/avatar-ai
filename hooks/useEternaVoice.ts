import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { StreamStatus } from './useWebSocketStream';
import {
  ETERNA_VOICE_ENGINE_EVENT,
  EternaVoiceEngine,
  getEternaVoiceEngine,
} from '../lib/eterna/voiceConfig';

export type VoiceModeState = 'disabled' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'COOLDOWN';

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const s2 = str2.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
     track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
     track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
     for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
           track[j][i - 1] + 1, // deletion
           track[j - 1][i] + 1, // insertion
           track[j - 1][i - 1] + indicator // substitution
        );
     }
  }
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return (maxLength - distance) / maxLength;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  showAuthButtons?: boolean;
  showPublishButton?: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
}

export interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onnomatch: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// Helper to select the premium female Spanish voice with specific priority order and trace selection reasons
const selectPremiumVoiceWithReason = (): { voice: SpeechSynthesisVoice | null, reason: string } => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { voice: null, reason: "SpeechSynthesis no está disponible en el objeto global window." };
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return { voice: null, reason: "SpeechSynthesis.getVoices() devolvió una lista vacía. Posible retraso en la carga del navegador." };
  }

  // 1. Prioridad absoluta solicitada: Google español de Estados Unidos.
  const esUS = voices.find(v => v.name === "Google español de Estados Unidos" || v.lang === "es-US" || v.lang === "es_US");
  if (esUS) {
    return { voice: esUS, reason: "Forzada: Google español de Estados Unidos (es-US)" };
  }

  // 2. Respaldo regional: voces femeninas nativas de México.
  const mexicanFemale = voices.find(v => {
    const name = v.name.toLowerCase();
    const isMexican = v.lang.toLowerCase().replace('_', '-').startsWith('es-mx');
    return isMexican && (name.includes('dalia') || name.includes('sabina') || name.includes('renata') || name.includes('larissa'));
  });
  if (mexicanFemale) {
    return { voice: mexicanFemale, reason: `Voz femenina nativa de México: ${mexicanFemale.name}` };
  }

  // 3. Google español (es-ES)
  const esES = voices.find(v => v.name === "Google español" || v.lang === "es-ES" || v.lang === "es-ES");
  if (esES) {
    return { voice: esES, reason: "Coincidencia secundaria: Google español (es-ES)" };
  }

  // Filter voices that have a Spanish language prefix
  const spanishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));

  // 4. Microsoft Elena
  const elena = spanishVoices.find(v => v.name.toLowerCase().includes('elena'));
  if (elena) return { voice: elena, reason: "Microsoft Elena (es-ES)" };

  // Helper to identify female voices based on name cues
  const isFemaleName = (name: string): boolean => {
    const n = name.toLowerCase();
    return n.includes('female') || n.includes('femenino') || n.includes('zira') || n.includes('dalia') || n.includes('elena') || n.includes('sabina') || n.includes('pilar') || n.includes('clara') || n.includes('helena') || n.includes('google') || n.includes('monica') || n.includes('luz');
  };

  // 6. Cualquier voz femenina es-MX
  const esMXFemale = spanishVoices.find(v => v.lang.toLowerCase().includes('mx') && isFemaleName(v.name));
  if (esMXFemale) return { voice: esMXFemale, reason: "Se encontró una voz identificada como femenina para la región es-MX." };

  // MX backup
  const esMXAny = spanishVoices.find(v => v.lang.toLowerCase().includes('mx'));
  if (esMXAny) return { voice: esMXAny, reason: "No se halló voz femenina en es-MX; se seleccionó la única voz es-MX disponible." };

  // 7. Cualquier voz femenina es-ES
  const esESFemale = spanishVoices.find(v => v.lang.toLowerCase().includes('es') && isFemaleName(v.name));
  if (esESFemale) return { voice: esESFemale, reason: "Se encontró una voz identificada como femenina para la región es-ES." };

  // ES backup
  const esESAny = spanishVoices.find(v => v.lang.toLowerCase().includes('es'));
  if (esESAny) return { voice: esESAny, reason: "No se halló voz femenina en es-ES; se seleccionó la única voz es-ES disponible." };

  // Fallback actual
  if (spanishVoices.length > 0) {
    return { voice: spanishVoices[0], reason: "Se seleccionó el primer recurso en idioma español de la lista." };
  }

  const defaultVoice = voices.find(v => v.default);
  if (defaultVoice) {
    return { voice: defaultVoice, reason: "No hay voces en español disponibles. Se seleccionó la voz predeterminada del sistema de fallback total." };
  }

  return { voice: voices[0] || null, reason: "No hay voces en español ni predeterminadas. Se seleccionó la primera voz absoluta devuelta por el sistema." };
};

interface UseEternaVoiceProps {
  language: 'es' | 'en';
  isConnected: boolean;
  interrupt: () => void;
  wsStatus: StreamStatus;
  isMuted: boolean;
  simulatedStatus: StreamStatus;
  setSimulatedStatus: Dispatch<SetStateAction<StreamStatus>>;
  setChatHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  onMessageSend: (text: string) => void;
  setThinkingContext: (ctx: 'property_search' | 'property_detail' | 'publish_property' | 'swap' | 'navigation' | 'general') => void;
  setSimulatedText: Dispatch<SetStateAction<string>>;
}

const addVoiceDebugLog = (msg: string) => {
  if (typeof window !== 'undefined') {
    if ((window as any).__eternaAddDebugLog) {
      (window as any).__eternaAddDebugLog(msg);
    } else {
      (window as any).__eternaDebugLogs = (window as any).__eternaDebugLogs || [];
      (window as any).__eternaDebugLogs.push({ time: new Date().toLocaleTimeString(), message: msg });
    }
  }
};

export function useEternaVoice({
  language,
  isConnected,
  interrupt,
  wsStatus,
  isMuted,
  simulatedStatus,
  setSimulatedStatus,
  setChatHistory,
  onMessageSend,
  setThinkingContext,
  setSimulatedText
}: UseEternaVoiceProps) {
  // Voice State Machine & Interruptions
  const [voiceState, setVoiceState] = useState<VoiceModeState>('disabled');
  const [speechRecognitionSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const SpeechRec = (
      window as unknown as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    );
    return !!(SpeechRec.SpeechRecognition || SpeechRec.webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const loggedSetVoiceMode = useCallback((val: boolean | ((prev: boolean) => boolean), reason: string) => {
    setVoiceMode((prev) => {
      const next = typeof val === 'function' ? (val as Function)(prev) : val;
      const stack = new Error().stack || 'n/a';
      const msg = `[VOICE MODE CHANGE] from: ${prev} to: ${next} reason: ${reason} stack: ${stack}`;
      console.log(msg);
      addVoiceDebugLog(msg);
      return next;
    });
  }, []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');

  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceInitializedRef = useRef<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isStoppingForSpeechRef = useRef<boolean>(false);
  const recognitionActiveRef = useRef<boolean>(false);
  const pendingSpeechStartRef = useRef<(() => void) | null>(null);
  const voiceEngineRef = useRef<EternaVoiceEngine>(getEternaVoiceEngine());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const lastSpokenTextRef = useRef<string>('');
  const lastSpokenTimestampRef = useRef<number>(0);
  const speechSessionActiveRef = useRef<boolean>(false);

  const voiceModeRef = useRef(false);
  const voiceStateRef = useRef<VoiceModeState>('disabled');

  const transitionToState = (newState: VoiceModeState) => {
    addVoiceDebugLog(`[CALL] transitionToState to: ${newState}`);
    setVoiceState(newState);
    voiceStateRef.current = newState;
    console.log(`[VOICE STATE] ${newState.toUpperCase()}`);
  };

  const enterListeningState = useCallback(() => {
    addVoiceDebugLog(`enterListeningState called. voiceMode: ${voiceModeRef.current}, recognition exists: ${!!recognitionRef.current}`);
    console.log("[MOBILE TAP] enterListeningState called. voiceMode =", voiceModeRef.current, "recognition exists =", !!recognitionRef.current);
    if (!voiceModeRef.current || !recognitionRef.current) return;
    
    if (voiceStateRef.current === 'LISTENING' && recognitionActiveRef.current) {
      addVoiceDebugLog("enterListeningState: already listening");
      console.log("[MOBILE TAP] enterListeningState: already listening");
      return;
    }

    addVoiceDebugLog("transitionToState('LISTENING')");
    transitionToState('LISTENING');

    if (!recognitionActiveRef.current) {
      try {
        console.log('[VOICE STATE] recognition started');
        addVoiceDebugLog("recognition.start() called");
        recognitionRef.current.start();
      } catch (e: any) {
        addVoiceDebugLog(`recognition.start() failed: ${e?.message || e}`);
        console.warn('[Eterna Voice] start failed:', e);
      }
    }
  }, []);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const speechRecognitionSupportedRef = useRef(false);

  const onMessageSendRef = useRef<(text: string) => void>(onMessageSend);
  const speakRef = useRef<((text: string, onEnd?: () => void) => void) | null>(null);
  const setChatHistoryRef = useRef<typeof setChatHistory | null>(null);
  const setSimulatedStatusRef = useRef<typeof setSimulatedStatus | null>(null);
  const isConnectedRef = useRef(isConnected);
  const interruptRef = useRef(interrupt);
  const wsStatusRef = useRef(wsStatus);
  const simulatedStatusRef = useRef(simulatedStatus);
  const languageRef = useRef(language);
  const isMutedRef = useRef(isMuted);
  const setThinkingContextRef = useRef(setThinkingContext);
  const setSimulatedTextRef = useRef(setSimulatedText);

  // Voice Initialization
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const initVoice = () => {
      if (voiceInitializedRef.current) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      const spanishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));
      console.log("[VOICES ES]");
      spanishVoices.forEach((v) => {
        console.log(`Nombre: ${v.name}\nIdioma: ${v.lang}`);
      });
      console.log(`Total voces españolas encontradas: ${spanishVoices.length}`);

      const { voice, reason } = selectPremiumVoiceWithReason();
      if (voice) {
        selectedVoiceRef.current = voice;
        voiceInitializedRef.current = true;

        if (voice.name === "Google español de Estados Unidos" || voice.lang === "es-US" || voice.lang === "es_US") {
          console.log(`[Eterna Voice] Forzada: Google español de Estados Unidos (es-US)`);
        } else if (voice.name === "Google español" || voice.lang === "es-ES" || voice.lang === "es-ES") {
          console.log(`[Eterna Voice] Seleccionada: Google español (es-ES)`);
        } else if (voice.name === "Microsoft Sabina - Spanish (Mexico)" || voice.name.toLowerCase().includes("sabina")) {
          console.log(`[Eterna Voice] Forzada: Microsoft Sabina - Spanish (Mexico)`);
        } else {
          console.log(`[Eterna Voice] Seleccionada: ${voice.name} - ${voice.lang}`);
        }

        const isFemaleName = (name: string): boolean => {
          const n = name.toLowerCase();
          return n.includes('female') || n.includes('femenino') || n.includes('zira') || n.includes('dalia') || n.includes('elena') || n.includes('sabina') || n.includes('pilar') || n.includes('clara') || n.includes('helena') || n.includes('google') || n.includes('monica') || n.includes('luz');
        };

        if (!isFemaleName(voice.name)) {
          console.log(`[Eterna Voice] Aviso: La voz seleccionada parece ser de tono masculino o género no especificado. Motivo de selección: ${reason}`);
        }
      }
    };

    initVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = initVoice;
    }
  }, []);

  useEffect(() => {
    const syncVoiceEngine = (event?: Event) => {
      const selected = (event as CustomEvent<{ engine?: EternaVoiceEngine }>)?.detail?.engine;
      voiceEngineRef.current = selected || getEternaVoiceEngine();
      addVoiceDebugLog(`[VOICE ENGINE] ${voiceEngineRef.current}`);
    };

    syncVoiceEngine();
    window.addEventListener(ETERNA_VOICE_ENGINE_EVENT, syncVoiceEngine);
    return () => window.removeEventListener(ETERNA_VOICE_ENGINE_EVENT, syncVoiceEngine);
  }, []);

  // Centralized, optimized SpeechSynthesis controller
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    // Cancel any ongoing speech synthesis first
    window.speechSynthesis?.cancel();
    pendingSpeechStartRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }

    // Check if recognition is running
    const wasRecognitionActive = recognitionRef.current && recognitionActiveRef.current;

    if (wasRecognitionActive && recognitionRef.current) {
      try {
        isStoppingForSpeechRef.current = true; // Flag to prevent onend from auto-restarting
        console.log('[VOICE STATE] recognition aborted');
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('[Eterna Voice] speak abort recognition failed:', e);
        isStoppingForSpeechRef.current = false;
      }
    }

    if (isMutedRef.current || !text.trim()) {
      setThinkingContextRef.current?.('general');
      setSimulatedStatusRef.current?.('idle');
      isStoppingForSpeechRef.current = false; // Reset the flag since we're not speaking
      if (voiceModeRef.current) {
        enterListeningState();
      }
      onEnd?.();
      return;
    }

    // Rule #2 & #6: Transition to SPEAKING state
    transitionToState('SPEAKING');

    // Rule #3 & #4: Update speech timestamps and text
    lastSpokenTextRef.current = text;
    lastSpokenTimestampRef.current = Date.now();

    setSimulatedStatusRef.current?.('talking');
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    console.log('[AUDIT] speechSessionActiveRef -> true');
    speechSessionActiveRef.current = true; // Mark speech session as active

    let isFinished = false;

    const handleEnd = () => {
      console.log(`[VOICE STATE] speech end`);
      console.log(
        '[VOICE FIX]',
        {
          speechSessionActive: speechSessionActiveRef.current,
          isSpeakingRef: isSpeakingRef.current
        }
      );
      if (isFinished) {
        console.log('[HANDLE END EXIT A]');
        return;
      }
      isFinished = true;

      speechRequestRef.current?.abort();
      speechRequestRef.current = null;
      audioRef.current = null;
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }

      // If we are no longer speaking (e.g. because we were interrupted), we should not transition back to idle
      // or restart recognition from here, because the interruption already handled it.
      if (!speechSessionActiveRef.current) {
        console.log('[HANDLE END EXIT B]');
        return;
      }
      console.trace('[AUDIT] speechSessionActiveRef -> false (handleEnd)');
      speechSessionActiveRef.current = false;

      setThinkingContextRef.current?.('general');
      setSimulatedStatusRef.current?.('idle');
      setSimulatedTextRef.current?.('');
      setIsSpeaking(false);
      if (onEnd) {
        setTimeout(onEnd, 0);
      }

      isStoppingForSpeechRef.current = false; // Reset the flag since speech has ended

      // Transition to COOLDOWN
      transitionToState('COOLDOWN');

      setTimeout(() => {
        if (voiceModeRef.current && voiceStateRef.current === 'COOLDOWN') {
          enterListeningState();
        }
      }, 2000);
      console.log('[HANDLE END EXIT C]');
    };

    const playWithBrowser = () => {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        handleEnd();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoiceRef.current) {
          utterance.voice = selectedVoiceRef.current;
          utterance.lang = selectedVoiceRef.current.lang;
        } else {
          utterance.lang = languageRef.current === 'es' ? 'es-MX' : 'en-US';
        }
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        utterance.onend = handleEnd;
        utterance.onerror = handleEnd;
        console.log('[VOICE STATE] browser speech start');
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[Eterna Voice] browser speech failed:', e);
        handleEnd();
      }
    };

    const playWithRemoteEngine = async (engine: Exclude<EternaVoiceEngine, 'browser'>) => {
      const controller = new AbortController();
      speechRequestRef.current = controller;
      let playbackGuard: number | null = null;
      let fallbackStarted = false;

      try {
        const response = await fetch('/api/voz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: text, engine }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Voice engine ${engine} returned ${response.status}`);

        const audioBlob = await response.blob();
        if (!speechSessionActiveRef.current || controller.signal.aborted) return;

        const objectUrl = URL.createObjectURL(audioBlob);
        audioObjectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audio.preload = 'auto';
        audio.volume = 1;
        audioRef.current = audio;
        let playbackConfirmed = false;
        const fallbackToBrowser = () => {
          if (fallbackStarted || !speechSessionActiveRef.current) return;
          fallbackStarted = true;
          audio.pause();
          audioRef.current = null;
          if (audioObjectUrlRef.current) {
            URL.revokeObjectURL(audioObjectUrlRef.current);
            audioObjectUrlRef.current = null;
          }
          addVoiceDebugLog(`[VOICE FALLBACK] ${engine} audio playback -> browser`);
          playWithBrowser();
        };
        playbackGuard = window.setTimeout(() => {
          if (!playbackConfirmed) fallbackToBrowser();
        }, 1500);
        audio.onplaying = () => {
          playbackConfirmed = true;
          if (playbackGuard !== null) window.clearTimeout(playbackGuard);
          console.log(`[VOICE STATE] ${engine} audible playback confirmed`);
        };
        audio.onended = () => {
          if (playbackGuard !== null) window.clearTimeout(playbackGuard);
          handleEnd();
        };
        audio.onerror = () => {
          if (playbackGuard !== null) window.clearTimeout(playbackGuard);
          fallbackToBrowser();
        };
        console.log(`[VOICE STATE] ${engine} speech start`);
        await audio.play();
      } catch (error) {
        if (controller.signal.aborted || !speechSessionActiveRef.current) return;
        if (playbackGuard !== null) window.clearTimeout(playbackGuard);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
          audioObjectUrlRef.current = null;
        }
        if (fallbackStarted) return;
        fallbackStarted = true;
        console.warn(`[Eterna Voice] ${engine} unavailable, using browser fallback:`, error);
        addVoiceDebugLog(`[VOICE FALLBACK] ${engine} -> browser`);
        playWithBrowser();
      }
    };

    const startSelectedEngine = () => {
      const engine = voiceEngineRef.current;
      if (engine === 'browser') playWithBrowser();
      else void playWithRemoteEngine(engine);
    };

    // Si el micrófono estaba escuchando, esperamos su evento onend antes de reproducir.
    if (wasRecognitionActive) {
      pendingSpeechStartRef.current = startSelectedEngine;
    } else {
      startSelectedEngine();
    }
  }, [language]);

  const interruptEterna = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isConnectedRef.current) {
      interruptRef.current?.();
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false; // Sync ref synchronously to prevent handleEnd from executing
    console.trace('[AUDIT] speechSessionActiveRef -> false (interruptEterna)');
    speechSessionActiveRef.current = false; // Clear session ref on interrupt
    lastSpokenTimestampRef.current = 0; // Prevent recent speech window blocking
    setSimulatedStatusRef.current?.('listening');
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null; // Clear any pending speech
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }

    // Bypasses COOLDOWN when user interrupts, goes straight to LISTENING
    enterListeningState();

    if (recognitionRef.current) {
      if (recognitionActiveRef.current) {
        try {
          console.log('[VOICE STATE] recognition aborted');
          recognitionRef.current.abort();
        } catch {}
      }
    }
  }, []);

  const startConversationMode = useCallback(() => {
    addVoiceDebugLog(`[CALL] startConversationMode`);
    addVoiceDebugLog(`startConversationMode called. voiceMode before: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] startConversationMode before: voiceMode =", voiceModeRef.current);
    loggedSetVoiceMode(true, "startConversationMode");
    voiceModeRef.current = true; // Synchronously update ref to avoid React state batching delays
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSimulatedStatusRef.current?.('listening');
    setThinkingContextRef.current?.('general');
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    console.trace('[AUDIT] speechSessionActiveRef -> false (startConversationMode)');
    speechSessionActiveRef.current = false; // Clear session ref
    lastSpokenTimestampRef.current = 0; // Prevent recent speech window blocking
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }

    enterListeningState();
    addVoiceDebugLog(`startConversationMode completed. voiceMode after: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] startConversationMode after: voiceMode =", voiceModeRef.current);
  }, []);

  const stopConversationMode = useCallback(() => {
    addVoiceDebugLog(`[CALL] stopConversationMode`);
    addVoiceDebugLog(`stopConversationMode called. voiceMode before: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] stopConversationMode before: voiceMode =", voiceModeRef.current);
    loggedSetVoiceMode(false, "stopConversationMode");
    voiceModeRef.current = false; // Synchronously update ref
    transitionToState('disabled');
    setIsListening(false);
    isListeningRef.current = false;
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        if (recognitionActiveRef.current) {
          console.log('[VOICE STATE] recognition aborted');
          recognitionRef.current.abort();
        }
      } catch (e) {
        console.warn('[Eterna Voice] Stop recognition failed:', e);
      }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    console.trace('[AUDIT] speechSessionActiveRef -> false (stopConversationMode)');
    speechSessionActiveRef.current = false; // Clear session ref
    setPartialTranscript('');
    setSimulatedStatusRef.current?.('idle');
    setThinkingContextRef.current?.('general');
    addVoiceDebugLog(`stopConversationMode completed. voiceMode after: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] stopConversationMode after: voiceMode =", voiceModeRef.current);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    addVoiceDebugLog(`toggleVoiceMode called. supported: ${speechRecognitionSupportedRef.current}, active: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] toggleVoiceMode: supported =", speechRecognitionSupportedRef.current, "active =", voiceModeRef.current);
    if (!speechRecognitionSupportedRef.current) {
      addVoiceDebugLog("toggleVoiceMode: speech recognition not supported, appending warning message");
      setChatHistoryRef.current?.(prev => [...prev, { 
        role: 'assistant', 
        content: languageRef.current === 'es' ? 'Tu navegador no soporta conversación por voz.' : 'Your browser does not support voice conversation.' 
      }]);
      return;
    }
    if (voiceModeRef.current) {
      stopConversationMode();
    } else {
      startConversationMode();
    }
  }, [stopConversationMode, startConversationMode]);

  const handleVoiceButtonClick = useCallback(() => {
    const activeStatusVal = isConnectedRef.current ? wsStatusRef.current : simulatedStatusRef.current;
    if (activeStatusVal === 'talking') {
      interruptEterna();
    } else {
      toggleVoiceMode();
    }
  }, [interruptEterna, toggleVoiceMode]);

  // Keep all refs fresh on every render to completely prevent stale closures in stable callbacks
  useEffect(() => {
    voiceModeRef.current = voiceMode;
    voiceStateRef.current = voiceState;
    isSpeakingRef.current = isSpeaking;
    isListeningRef.current = isListening;
    speechRecognitionSupportedRef.current = speechRecognitionSupported;
    onMessageSendRef.current = onMessageSend;
    speakRef.current = speak;
    setChatHistoryRef.current = setChatHistory;
    setSimulatedStatusRef.current = setSimulatedStatus;
    isConnectedRef.current = isConnected;
    interruptRef.current = interrupt;
    wsStatusRef.current = wsStatus;
    simulatedStatusRef.current = simulatedStatus;
    languageRef.current = language;
    isMutedRef.current = isMuted;
    setThinkingContextRef.current = setThinkingContext;
    setSimulatedTextRef.current = setSimulatedText;
  }); // Runs on every render

  // Web Speech API Recognition Setup
  useEffect(() => {
    let active = true;
    let recInstance: SpeechRecognitionInstance | null = null;

    // 4. Antes de crear una nueva instancia, detener y limpiar la anterior.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        console.log('[VOICE STATE] recognition aborted');
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('[Eterna Voice] Error aborting existing recognition:', e);
      }
      recognitionRef.current = null;
    }

    if (typeof window !== 'undefined') {
      const SpeechRec = (
        window as unknown as Window & {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      );
      const SpeechRecognition = SpeechRec.SpeechRecognition || SpeechRec.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language === 'es' ? 'es-MX' : 'en-US';
        recInstance = rec;

        rec.onstart = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onstart");
          console.log("[Eterna Voice Console] recognition.onstart triggered. isListening:", isListeningRef.current);
          if (!active) return;
          setIsListening(true);
          isListeningRef.current = true;
          recognitionActiveRef.current = true;
          setPartialTranscript('');
        };
        
        rec.onend = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onend");
          console.log("[VOICE STATE] recognition ended");
          setIsListening(false);
          isListeningRef.current = false;
          recognitionActiveRef.current = false;
          setPartialTranscript('');

          if (!active) return;

          // If we aborted recognition specifically to speak, and now it has ended, start synthesis
          if (pendingSpeechStartRef.current) {
            const startSpeech = pendingSpeechStartRef.current;
            pendingSpeechStartRef.current = null;
            try {
              startSpeech();
            } catch (e) {
              console.warn('[Eterna Voice] pending speech failed:', e);
              setSimulatedStatusRef.current?.('idle');
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              console.trace('[AUDIT] speechSessionActiveRef -> false (rec.onend catch)');
              speechSessionActiveRef.current = false; // Clear session ref
              isStoppingForSpeechRef.current = false;
              enterListeningState();
            }
            return;
          }

          if (voiceModeRef.current && voiceStateRef.current === 'LISTENING') {
            enterListeningState();
          }
        };

        rec.onerror = (event) => {
          addVoiceDebugLog(`[EVENT] SpeechRecognition.onerror: ${event.error}`);
          console.log("[Eterna Voice Console] recognition.onerror triggered. Error details:", event.error);
          if (!active) return;
          console.warn('[Eterna Voice] SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            loggedSetVoiceMode(false, "recognition.onerror: not-allowed");
          }
        };

        rec.onnomatch = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onnomatch");
        };

        rec.onaudiostart = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onaudiostart");
        };

        rec.onaudioend = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onaudioend");
        };

        rec.onspeechstart = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onspeechstart");
        };

        rec.onspeechend = () => {
          addVoiceDebugLog("[EVENT] SpeechRecognition.onspeechend");
        };

        rec.onresult = (event: SpeechRecognitionEvent) => {
          // Rule #1: SpeechRecognition only processes results when voiceState === LISTENING
          if (voiceStateRef.current !== 'LISTENING') {
            console.log('[VOICE STATE] transcript blocked', voiceStateRef.current);
            return;
          }

          // Rule #3: Prevent echo within 5000 ms of Eterna ending speech
          const recentlySpoken = Date.now() - lastSpokenTimestampRef.current < 5000;
          if (recentlySpoken) {
            console.log('[VOICE STATE] blocked by recent speech window');
            return;
          }

          console.log("[Eterna Voice Console] recognition.onresult triggered. Event results length:", event.results.length);
          if (!active) return;
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          console.log("[Eterna Voice Console] finalTranscript parsed:", JSON.stringify(finalTranscript), "interim:", JSON.stringify(interimTranscript));

          if (interimTranscript) {
            setPartialTranscript(interimTranscript);
          }

          if (finalTranscript.trim()) {
            // Rule #4: Prevent echo if similarity of transcript is > 80% to last spoken text
            const transcriptText = finalTranscript.trim();
            const similarity = calculateSimilarity(transcriptText, lastSpokenTextRef.current);
            if (similarity > 0.8) {
              console.log('[VOICE STATE] self-audio detected and blocked');
              setPartialTranscript('');
              return;
            }

            setPartialTranscript('');

            // Transition to PROCESSING
            transitionToState('PROCESSING');

            if (onMessageSendRef.current) {
              console.log("[Eterna Voice Console] calling onMessageSendRef.current with finalTranscript:", JSON.stringify(transcriptText));
              setSimulatedStatusRef.current?.('thinking');
              onMessageSendRef.current(transcriptText);
            }
          }
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      active = false;
      if (recInstance) {
        try {
          recInstance.onstart = null;
          recInstance.onend = null;
          recInstance.onerror = null;
          recInstance.onresult = null;
          console.log('[VOICE STATE] recognition aborted');
          recInstance.abort();
        } catch {}
      }
      if (recognitionRef.current === recInstance) {
        recognitionRef.current = null;
      }
    };
  }, [language]);

  // Cleanup timers and voice on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          console.log('[VOICE STATE] recognition aborted');
          recognitionRef.current.abort();
        } catch {}
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      speechRequestRef.current?.abort();
      audioRef.current?.pause();
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      addVoiceDebugLog(`[EVENT] document.visibilitychange. hidden=${document.hidden}`);
    };
    const handleBlur = () => {
      addVoiceDebugLog("[EVENT] window.blur");
    };
    const handleFocus = () => {
      addVoiceDebugLog("[EVENT] window.focus");
    };
    const handlePageHide = () => {
      addVoiceDebugLog("[EVENT] pagehide");
    };
    const handleBeforeUnload = () => {
      addVoiceDebugLog("[EVENT] beforeunload");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return {
    voiceMode,
    voiceState,
    isListening,
    isSpeaking,
    partialTranscript,
    speechRecognitionSupported,
    startVoiceMode: startConversationMode,
    stopVoiceMode: stopConversationMode,
    handleVoiceButtonClick,
    speak,
    interruptVoice: interruptEterna
  };
}
