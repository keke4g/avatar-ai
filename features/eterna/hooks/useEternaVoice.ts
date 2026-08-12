import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { StreamStatus } from '@/hooks/useWebSocketStream';
import {
  ETERNA_VOICE_ENGINE_EVENT,
  ETERNA_VOICE_ENGINE_STORAGE_KEY,
  DEFAULT_ETERNA_VOICE_ENGINE,
  EternaVoiceEngine,
  getEternaVoiceEngine,
  loadGlobalEternaVoiceSettings,
} from '@/lib/eterna/voiceConfig';
import { normalizeEternaSpeechText } from '@/lib/eterna/speechText';
import {
  calculateAudioRms,
  createBargeInDetectorState,
  evaluateBargeInFrame,
} from '@/lib/eterna/bargeInDetector';
import {
  createBrowserAudioContext,
  ETERNA_FIRST_AUDIO_TIMEOUT_MS,
  getPcmSampleRate,
  playPcmStream,
  startSilentAudioOutputWarmup,
  stopPcmSources,
} from '@/features/eterna/audio/pcmStreamPlayer';
import {
  ETERNA_AVATAR_AUDIO_LEAD_IN_MS,
  getEternaPlaybackLeadInMs,
} from '@/lib/eterna/voiceTiming';
import { isReusablePcmAudioContextState } from '@/lib/eterna/audioContextPolicy';
import {
  normalizeVoiceText,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionInstance,
} from '@/features/eterna/voice/browserSpeech';
import { addVoiceDebugLog } from '@/features/eterna/voice/voiceDebug';
import { useBrowserVoiceSelection } from '@/features/eterna/voice/useBrowserVoiceSelection';
import {
  RECOGNITION_DEVICE_SETTLE_MS,
  RECOGNITION_MAX_START_RETRIES,
  SPOKEN_ECHO_MEMORY_MS,
  useWebSpeechRecognition,
} from '@/features/eterna/voice/useWebSpeechRecognition';
import { useVoiceSessionLifecycle } from '@/features/eterna/voice/useVoiceSessionLifecycle';
import { type VoiceModeState } from '@/features/eterna/voice/types';

export type {
  SpeechRecognitionAlternative,
  SpeechRecognitionConstructor,
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
  SpeechRecognitionResult,
  SpeechRecognitionResultList,
} from '@/features/eterna/voice/browserSpeech';

export type { VoiceModeState } from '@/features/eterna/voice/types';

interface SpeakOptions {
  onStart?: () => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  showAuthButtons?: boolean;
  showPublishButton?: boolean;
}

const POST_SPEECH_MIC_COOLDOWN_MS = 850;

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

  const loggedSetVoiceMode = useCallback((next: boolean, reason: string) => {
    // State updater functions run during React rendering and must stay pure.
    // Log before scheduling the state change so the mobile debugger does not
    // update another component from inside EternaConcierge's render.
    const stack = new Error().stack || 'n/a';
    const msg = `[VOICE MODE CHANGE] to: ${next} reason: ${reason} stack: ${stack}`;
    console.log(msg);
    addVoiceDebugLog(msg);
    setVoiceMode(next);
  }, []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');

  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isStoppingForSpeechRef = useRef<boolean>(false);
  const recognitionActiveRef = useRef<boolean>(false);
  const pendingSpeechStartRef = useRef<(() => void) | null>(null);
  // When playback finishes while recognition is still dispatching its abort
  // event, resume listening from recognition.onend instead of polling or
  // waiting an arbitrary cooldown.
  const pendingListeningResumeRef = useRef<(() => void) | null>(null);
  const pendingAudioUnlockRef = useRef<(() => void) | null>(null);
  // Hard half-duplex guard: while Eterna is producing audio, the browser must
  // not be allowed to turn that output back into a user transcript.
  const speechOutputGuardRef = useRef(false);
  const speechCooldownUntilRef = useRef(0);
  const speechCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterListeningStateRef = useRef<(() => void) | null>(null);
  const recognitionStartPendingRef = useRef(false);
  const recognitionStartFailuresRef = useRef(0);
  const lastRecognitionErrorRef = useRef<string | null>(null);
  const speechGenerationRef = useRef(0);
  const audibleStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinalTranscriptRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const spokenTextHistoryRef = useRef<Array<{ text: string; at: number }>>([]);

  // Use getUserMedia only to validate/request access. SpeechRecognition opens
  // its own Android audio capture, so this stream must be released before the
  // recognizer starts or one of the two clients can receive silence.
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const microphoneRequestRef = useRef<Promise<boolean> | null>(null);
  // SpeechRecognition remains closed while Eterna talks. This independent
  // Web Audio path only measures microphone energy so the user can interrupt
  // without letting Eterna's own output become a transcript.
  const bargeInStreamRef = useRef<MediaStream | null>(null);
  const bargeInAudioContextRef = useRef<AudioContext | null>(null);
  const bargeInSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const bargeInAnalyserRef = useRef<AnalyserNode | null>(null);
  const bargeInAnimationFrameRef = useRef<number | null>(null);
  const bargeInGenerationRef = useRef(0);
  const automaticBargeInHandlerRef = useRef<(() => void) | null>(null);
  // Fish Audio también es el valor inicial, así la primera respuesta no cae
  // temporalmente en otro proveedor mientras carga la configuración global.
  const voiceEngineRef = useRef<EternaVoiceEngine>(DEFAULT_ETERNA_VOICE_ENGINE);
  const speechRequestRef = useRef<AbortController | null>(null);
  const pcmAudioContextRef = useRef<AudioContext | null>(null);
  const pcmSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speechSessionActiveRef = useRef<boolean>(false);

  const voiceModeRef = useRef(false);
  const voiceStateRef = useRef<VoiceModeState>('disabled');
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const speechRecognitionSupportedRef = useRef(speechRecognitionSupported);

  const transitionToState = useCallback((newState: VoiceModeState) => {
    addVoiceDebugLog(`[CALL] transitionToState to: ${newState}`);
    setVoiceState(newState);
    voiceStateRef.current = newState;
    console.log(`[VOICE STATE] ${newState.toUpperCase()}`);
  }, []);

  const ensurePcmAudioContext = useCallback((): AudioContext => {
    const currentContext = pcmAudioContextRef.current;
    if (currentContext && isReusablePcmAudioContextState(currentContext.state)) return currentContext;

    const replacementContext = createBrowserAudioContext();
    pcmAudioContextRef.current = replacementContext;
    addVoiceDebugLog(`[AUDIO CONTEXT] created in ${replacementContext.state} state`);
    return replacementContext;
  }, []);

  const preparePcmAudioPlayback = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const context = ensurePcmAudioContext();
      if (context.state === 'running') return;

      void context.resume()
        .then(() => addVoiceDebugLog(`[AUDIO CONTEXT] gesture resume -> ${context.state}`))
        .catch((error) => {
          addVoiceDebugLog(`[AUDIO CONTEXT] gesture resume failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    } catch (error) {
      addVoiceDebugLog(`[AUDIO CONTEXT] gesture preparation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [ensurePcmAudioContext]);

  const clearAudibleStartTimer = useCallback(() => {
    if (!audibleStartTimerRef.current) return;
    clearTimeout(audibleStartTimerRef.current);
    audibleStartTimerRef.current = null;
  }, []);

  const clearRecognitionRestartTimer = useCallback(() => {
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
  }, []);

  const scheduleRecognitionRestart = useCallback((delayMs: number, reason: string) => {
    clearRecognitionRestartTimer();
    if (!voiceModeRef.current) return;

    addVoiceDebugLog(`[MIC] reinicio programado en ${delayMs} ms (${reason})`);
    recognitionRestartTimerRef.current = setTimeout(() => {
      recognitionRestartTimerRef.current = null;
      if (!voiceModeRef.current) return;
      enterListeningStateRef.current?.();
    }, delayMs);
  }, [clearRecognitionRestartTimer]);

  const disableVoiceAfterRecognitionFailure = useCallback((reason: string, permissionBlocked = false) => {
    const wasActive = voiceModeRef.current;
    clearRecognitionRestartTimer();
    recognitionStartPendingRef.current = false;
    recognitionActiveRef.current = false;
    recognitionStartFailuresRef.current = 0;
    lastRecognitionErrorRef.current = null;
    voiceModeRef.current = false;
    voiceStateRef.current = 'disabled';
    setVoiceState('disabled');
    setIsListening(false);
    isListeningRef.current = false;
    loggedSetVoiceMode(false, reason);
    setSimulatedStatus('idle');

    if (wasActive) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: permissionBlocked
          ? (language === 'es'
              ? 'El navegador bloqueó el micrófono. Permite el acceso para towersmexico.com y vuelve a tocar “Hablar”.'
              : 'The browser blocked the microphone. Allow access for towersmexico.com and tap “Talk” again.')
          : (language === 'es'
              ? 'No pude iniciar el micrófono. Espera un momento y vuelve a tocar “Hablar”.'
              : 'I could not start the microphone. Wait a moment and tap “Talk” again.'),
      }]);
    }
  }, [clearRecognitionRestartTimer, language, loggedSetVoiceMode, setChatHistory, setSimulatedStatus]);

  const ensureMicrophoneCapture = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    const currentTracks = microphoneStreamRef.current?.getTracks().filter(track => track.readyState === 'live') || [];
    if (currentTracks.length > 0) return true;
    if (microphoneRequestRef.current) return microphoneRequestRef.current;

    const request = (async () => {
      const constrainedAudio = {
        echoCancellation: true,
        noiseSuppression: true,
        // Automatic gain makes distant voices much more likely to cross the
        // recognizer threshold. Prefer a stable, unamplified input.
        autoGainControl: false,
        channelCount: 1,
        // Supported by newer Chromium/Safari builds; ignored by browsers that
        // do not implement it.
        voiceIsolation: true,
      } as MediaTrackConstraints;

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: constrainedAudio });
        } catch {
          // Some browsers reject the optional voiceIsolation constraint rather
          // than ignoring it. Retry with the broadly supported constraints.
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
              channelCount: 1,
            },
          });
        }
        if (!voiceModeRef.current) {
          stream.getTracks().forEach(track => {
            try { track.stop(); } catch {}
          });
          return false;
        }
        microphoneStreamRef.current = stream;
        stream.getAudioTracks().forEach(track => {
          try {
            void track.applyConstraints({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
              channelCount: 1,
            }).catch(() => {
              // A browser may expose the track but reject one constraint at
              // runtime; the permission stream is still usable.
            });
          } catch {
            // Constraints are best effort; recognition still works without it.
          }
        });
        addVoiceDebugLog('[MIC] captura con cancelación de eco y supresión de ruido');
        return true;
      } catch (error) {
        console.warn('[Eterna Voice] microphone capture constraints unavailable:', error);
        addVoiceDebugLog('[MIC] no se pudo aplicar captura optimizada; se usa SpeechRecognition');
        return false;
      }
    })();

    microphoneRequestRef.current = request;
    try {
      return await request;
    } finally {
      microphoneRequestRef.current = null;
    }
  }, []);

  const releaseMicrophoneCapture = useCallback(() => {
    microphoneStreamRef.current?.getTracks().forEach(track => {
      try { track.stop(); } catch {}
    });
    microphoneStreamRef.current = null;
    microphoneRequestRef.current = null;
  }, []);

  const primeBargeInAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;

    const existingContext = bargeInAudioContextRef.current;
    if (existingContext && existingContext.state !== 'closed') {
      void existingContext.resume().catch(() => {
        // The explicit interruption button remains available if autoplay
        // policy keeps this input-only context suspended.
      });
      return existingContext;
    }

    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      const context = new AudioContextClass();
      bargeInAudioContextRef.current = context;
      void context.resume().catch(() => {
        // A later voice-button gesture can resume it; do not interrupt the
        // normal conversation flow just because automatic barge-in is absent.
      });
      return context;
    } catch {
      return null;
    }
  }, []);

  const stopBargeInMonitoring = useCallback((closeAudioContext = false) => {
    bargeInGenerationRef.current += 1;

    if (bargeInAnimationFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(bargeInAnimationFrameRef.current);
    }
    bargeInAnimationFrameRef.current = null;

    try { bargeInSourceRef.current?.disconnect(); } catch {}
    try { bargeInAnalyserRef.current?.disconnect(); } catch {}
    bargeInSourceRef.current = null;
    bargeInAnalyserRef.current = null;

    bargeInStreamRef.current?.getTracks().forEach(track => {
      try { track.stop(); } catch {}
    });
    bargeInStreamRef.current = null;

    if (closeAudioContext) {
      const context = bargeInAudioContextRef.current;
      bargeInAudioContextRef.current = null;
      if (context && context.state !== 'closed') {
        void context.close().catch(() => {});
      }
    }
  }, []);

  const startBargeInMonitoring = useCallback(async () => {
    stopBargeInMonitoring();
    const generation = bargeInGenerationRef.current;

    if (
      typeof window === 'undefined'
      || typeof navigator === 'undefined'
      || !navigator.mediaDevices?.getUserMedia
      || !voiceModeRef.current
      || !isSpeakingRef.current
      || !speechSessionActiveRef.current
    ) {
      return;
    }

    const context = primeBargeInAudioContext();
    if (!context) {
      addVoiceDebugLog('[BARGE-IN] Web Audio no disponible; se conserva el botón Interrumpir');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      const constrainedAudio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
        voiceIsolation: true,
      } as MediaTrackConstraints;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: constrainedAudio });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
          },
        });
      }

      if (
        generation !== bargeInGenerationRef.current
        || !voiceModeRef.current
        || !isSpeakingRef.current
        || !speechSessionActiveRef.current
      ) {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
        return;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack?.getSettings().echoCancellation === false) {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
        addVoiceDebugLog('[BARGE-IN] cancelación de eco no disponible; se conserva el botón Interrumpir');
        return;
      }

      if (context.state !== 'running') {
        try {
          await context.resume();
        } catch {
          stream.getTracks().forEach(track => {
            try { track.stop(); } catch {}
          });
          addVoiceDebugLog('[BARGE-IN] contexto de audio suspendido; se conserva el botón Interrumpir');
          return;
        }
      }

      if (generation !== bargeInGenerationRef.current || context.state !== 'running') {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
        return;
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.15;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      bargeInStreamRef.current = stream;
      bargeInSourceRef.current = source;
      bargeInAnalyserRef.current = analyser;

      const samples = new Float32Array(analyser.fftSize);
      const startedAt = window.performance.now();
      const detectorState = createBargeInDetectorState(startedAt);

      const monitorFrame = (now: number) => {
        if (
          generation !== bargeInGenerationRef.current
          || !voiceModeRef.current
          || !isSpeakingRef.current
          || !speechSessionActiveRef.current
        ) {
          if (generation === bargeInGenerationRef.current) stopBargeInMonitoring();
          return;
        }

        try {
          analyser.getFloatTimeDomainData(samples);
        } catch {
          stopBargeInMonitoring();
          return;
        }

        const frame = evaluateBargeInFrame(detectorState, calculateAudioRms(samples), now);
        if (frame.triggered) {
          addVoiceDebugLog(
            `[BARGE-IN] voz sostenida detectada (umbral ${frame.thresholdRms.toFixed(3)})`,
          );
          stopBargeInMonitoring();
          automaticBargeInHandlerRef.current?.();
          return;
        }

        bargeInAnimationFrameRef.current = window.requestAnimationFrame(monitorFrame);
      };

      addVoiceDebugLog('[BARGE-IN] detector automático activo durante la respuesta');
      bargeInAnimationFrameRef.current = window.requestAnimationFrame(monitorFrame);
    } catch (error) {
      stream?.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      if (generation === bargeInGenerationRef.current) stopBargeInMonitoring();
      console.warn('[Eterna Voice] automatic barge-in unavailable:', error);
      addVoiceDebugLog('[BARGE-IN] no disponible; se conserva el botón Interrumpir');
    }
  }, [primeBargeInAudioContext, stopBargeInMonitoring]);

  const enterListeningState = useCallback(() => {
    addVoiceDebugLog(`enterListeningState called. voiceMode: ${voiceModeRef.current}, recognition exists: ${!!recognitionRef.current}`);
    console.log("[MOBILE TAP] enterListeningState called. voiceMode =", voiceModeRef.current, "recognition exists =", !!recognitionRef.current);
    if (!voiceModeRef.current || !recognitionRef.current) return;

    // Never reopen the recognizer while output is playing, while a remote
    // response is still being prepared, or while the short post-playback echo
    // guard is active.
    if (isStoppingForSpeechRef.current || isSpeakingRef.current || speechOutputGuardRef.current || speechSessionActiveRef.current) {
      addVoiceDebugLog('[VOICE STATE] listening blocked during Eterna output');
      return;
    }
    const cooldownRemaining = speechCooldownUntilRef.current - Date.now();
    if (cooldownRemaining > 0) {
      clearRecognitionRestartTimer();
      recognitionRestartTimerRef.current = setTimeout(() => {
        recognitionRestartTimerRef.current = null;
        enterListeningStateRef.current?.();
      }, cooldownRemaining);
      return;
    }

    if (voiceStateRef.current === 'LISTENING' && recognitionActiveRef.current) {
      addVoiceDebugLog("enterListeningState: already listening");
      console.log("[MOBILE TAP] enterListeningState: already listening");
      return;
    }

    addVoiceDebugLog("transitionToState('LISTENING')");
    transitionToState('LISTENING');

    if (!recognitionActiveRef.current && !recognitionStartPendingRef.current) {
      recognitionStartPendingRef.current = true;
      try {
        // Web Speech does not consume microphoneStreamRef. Keeping that
        // independent MediaStream alive competes with Android's recognition
        // service for the same input on physical devices.
        releaseMicrophoneCapture();
        addVoiceDebugLog('[MIC] captura de permiso liberada antes del reconocedor');
        console.log('[VOICE STATE] recognition started');
        addVoiceDebugLog("recognition.start() called");
        recognitionRef.current.start();
      } catch (e: any) {
        recognitionStartPendingRef.current = false;
        recognitionActiveRef.current = false;
        recognitionStartFailuresRef.current += 1;
        addVoiceDebugLog(`recognition.start() failed: ${e?.message || e}`);
        console.warn('[Eterna Voice] start failed:', e);
        if (recognitionStartFailuresRef.current >= RECOGNITION_MAX_START_RETRIES) {
          disableVoiceAfterRecognitionFailure('recognition.start retry limit');
          return;
        }
        scheduleRecognitionRestart(
          Math.min(1_000, RECOGNITION_DEVICE_SETTLE_MS * recognitionStartFailuresRef.current),
          'start falló',
        );
      }
    }
  }, [
    clearRecognitionRestartTimer,
    disableVoiceAfterRecognitionFailure,
    releaseMicrophoneCapture,
    scheduleRecognitionRestart,
    transitionToState,
  ]);
  useEffect(() => {
    enterListeningStateRef.current = enterListeningState;
  }, [enterListeningState]);

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

  useBrowserVoiceSelection(selectedVoiceRef);

  useEffect(() => {
    const syncVoiceEngine = (event?: Event) => {
      const selected = (event as CustomEvent<{ engine?: EternaVoiceEngine }>)?.detail?.engine;
      voiceEngineRef.current = selected || getEternaVoiceEngine();
      addVoiceDebugLog(`[VOICE ENGINE] ${voiceEngineRef.current}`);
    };

    let active = true;
    loadGlobalEternaVoiceSettings()
      .then((settings) => {
        if (!active) return;
        voiceEngineRef.current = settings.engine;
        addVoiceDebugLog(`[VOICE ENGINE GLOBAL] ${settings.engine}`);
      })
      .catch((error) => {
        if (!active) return;
        voiceEngineRef.current = getEternaVoiceEngine();
        console.warn('[Eterna Voice] No se pudo cargar el motor global; usando caché local.', error);
        addVoiceDebugLog(`[VOICE ENGINE CACHE] ${voiceEngineRef.current}`);
      });

    window.addEventListener(ETERNA_VOICE_ENGINE_EVENT, syncVoiceEngine);
    const syncVoiceEngineFromStorage = (event: StorageEvent) => {
      if (event.key === ETERNA_VOICE_ENGINE_STORAGE_KEY) syncVoiceEngine();
    };
    window.addEventListener('storage', syncVoiceEngineFromStorage);
    return () => {
      active = false;
      window.removeEventListener(ETERNA_VOICE_ENGINE_EVENT, syncVoiceEngine);
      window.removeEventListener('storage', syncVoiceEngineFromStorage);
    };
  }, []);

  // Centralized, optimized SpeechSynthesis controller
  const speak = useCallback((text: string, onEnd?: () => void, options: SpeakOptions = {}) => {
    const speechGeneration = ++speechGenerationRef.current;
    stopBargeInMonitoring();
    speechOutputGuardRef.current = true;
    speechCooldownUntilRef.current = Number.POSITIVE_INFINITY;
    clearRecognitionRestartTimer();
    const normalizedSpokenText = normalizeVoiceText(text);
    if (normalizedSpokenText) {
      const now = Date.now();
      spokenTextHistoryRef.current = [
        ...spokenTextHistoryRef.current.filter(item => now - item.at < SPOKEN_ECHO_MEMORY_MS),
        { text: normalizedSpokenText, at: now },
      ].slice(-8);
    }

    if (typeof window === 'undefined') {
      speechOutputGuardRef.current = false;
      speechCooldownUntilRef.current = Date.now();
      onEnd?.();
      return;
    }

    // Cancel any ongoing speech synthesis first
    window.speechSynthesis?.cancel();
    pendingSpeechStartRef.current = null;
    pendingListeningResumeRef.current = null;
    pendingAudioUnlockRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    stopPcmSources(pcmSourcesRef.current);

    // Check if recognition is running
    const wasRecognitionActive = Boolean(recognitionRef.current && recognitionActiveRef.current);
    const isMobileAudioHandoff = window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
    const playbackLeadInMs = getEternaPlaybackLeadInMs({
      afterRecognition: wasRecognitionActive,
      isMobile: isMobileAudioHandoff,
    });
    // Register the playback continuation before aborting recognition. Mobile
    // browsers may dispatch `onend` synchronously; registering it afterwards
    // can leave the response stuck in the listening state with no audio.
    let startSelectedEngine: (() => void) | null = null;
    let pendingEngineHandoffStarted = false;
    const startPendingEngine = () => {
      if (pendingEngineHandoffStarted) return;
      pendingEngineHandoffStarted = true;
      if (startSelectedEngine) {
        startSelectedEngine();
        return;
      }

      // If an implementation fires `onend` in the same call stack, wait until
      // the engine functions below have been initialized.
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => startSelectedEngine?.());
      } else {
        Promise.resolve().then(() => startSelectedEngine?.());
      }
    };

    if (wasRecognitionActive && recognitionRef.current) {
      pendingSpeechStartRef.current = startPendingEngine;
      try {
        isStoppingForSpeechRef.current = true; // Flag to prevent onend from auto-restarting
        console.log('[VOICE STATE] recognition aborted');
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('[Eterna Voice] speak abort recognition failed:', e);
        isStoppingForSpeechRef.current = false;
        pendingSpeechStartRef.current = null;
        startPendingEngine();
      }
    }

    const speechText = normalizeEternaSpeechText(text, languageRef.current);

    if (isMutedRef.current || !speechText.trim()) {
      pendingSpeechStartRef.current = null;
      setThinkingContextRef.current?.('general');
      setSimulatedStatusRef.current?.('idle');
      isStoppingForSpeechRef.current = false; // Reset the flag since we're not speaking
      speechOutputGuardRef.current = false;
      speechCooldownUntilRef.current = Date.now();
      if (voiceModeRef.current) {
        enterListeningState();
      }
      onEnd?.();
      return;
    }

    // The configured engine is authoritative. If remote autoplay is blocked,
    // playback waits for the next user gesture instead of silently replacing
    // the administrator's selected voice with SpeechSynthesis.
    const selectedEngine = voiceEngineRef.current;
    clearAudibleStartTimer();
    setIsSpeaking(false);
    setIsAvatarSpeaking(false);
    isSpeakingRef.current = false;
    // The avatar stays in its processing state while either engine prepares
    // speech. A separate visual pre-roll is enabled only when playback has a
    // concrete start time, so animation and audible speech share one clock.
    transitionToState('PROCESSING');
    setSimulatedStatusRef.current?.('thinking');

    // La sesión empieza ahora para poder cancelarla durante la petición, pero
    // el avatar no entra en modo hablando hasta que el audio sea audible.
    console.log('[AUDIT] speechSessionActiveRef -> true');
    speechSessionActiveRef.current = true;

    let isFinished = false;

    const markAudibleSpeechStarted = () => {
      if (speechGeneration !== speechGenerationRef.current || isFinished || !speechSessionActiveRef.current || isSpeakingRef.current) return;

      transitionToState('SPEAKING');
      setSimulatedStatusRef.current?.('talking');
      setIsAvatarSpeaking(true);
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      options.onStart?.();
      console.log('[VOICE STATE] audible speech start');
      if (voiceModeRef.current) {
        void startBargeInMonitoring();
      }
    };

    const handleEnd = () => {
      if (speechGeneration !== speechGenerationRef.current) {
        return;
      }
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
      clearAudibleStartTimer();
      pendingAudioUnlockRef.current = null;
      stopBargeInMonitoring();

      speechRequestRef.current?.abort();
      speechRequestRef.current = null;

      // If we are no longer speaking (e.g. because we were interrupted), we should not transition back to idle
      // or restart recognition from here, because the interruption already handled it.
      if (!speechSessionActiveRef.current) {
        console.log('[HANDLE END EXIT B]');
        return;
      }
      console.trace('[AUDIT] speechSessionActiveRef -> false (handleEnd)');
      speechSessionActiveRef.current = false;
      speechOutputGuardRef.current = false;
      speechCooldownUntilRef.current = Date.now() + POST_SPEECH_MIC_COOLDOWN_MS;

      setThinkingContextRef.current?.('general');
      setSimulatedStatusRef.current?.('idle');
      setSimulatedTextRef.current?.('');
      setIsSpeaking(false);
      setIsAvatarSpeaking(false);
      isSpeakingRef.current = false;

      // The microphone remains closed until the audio element, PCM sources, or
      // SpeechSynthesis utterance has really ended. A short sub-second guard
      // then lets speaker tail/room reverb decay before recognition resumes.
      const resumeListening = () => {
        if (!voiceModeRef.current || isMutedRef.current || !recognitionRef.current) {
          isStoppingForSpeechRef.current = false;
          transitionToState('disabled');
          return;
        }

        isStoppingForSpeechRef.current = false;
        enterListeningState();
      };

      const resumeAfterEnd = () => {
        // A chained response may have been started by onEnd. In that case the
        // new speech session owns the state machine and the microphone must
        // stay closed for it.
        if (speechSessionActiveRef.current || isSpeakingRef.current) {
          console.log('[HANDLE END] chained speech is active; skipping listening resume');
          return;
        }

        if (voiceModeRef.current && !isMutedRef.current && recognitionRef.current) {
          if (recognitionActiveRef.current) {
            // A browser can deliver audio.onended before the recognition abort
            // event. Abort it now and resume from onend without introducing a
            // timer-based delay.
            pendingListeningResumeRef.current = resumeListening;
            isStoppingForSpeechRef.current = true;
            try {
              recognitionRef.current.abort();
            } catch (error) {
              console.warn('[Eterna Voice] immediate recognition resume failed:', error);
              recognitionActiveRef.current = false;
              pendingListeningResumeRef.current = null;
              resumeListening();
            }
          } else {
            resumeListening();
          }
        } else {
          isStoppingForSpeechRef.current = false;
          transitionToState('disabled');
        }
      };

      const notifyEndAndResume = () => {
        try {
          onEnd?.();
        } catch (error) {
          console.warn('[Eterna Voice] onEnd callback failed:', error);
        }
        resumeAfterEnd();
      };

      // Keep chained speak(...) callbacks out of this cleanup call stack. A
      // microtask is effectively immediate for the user, but prevents a new
      // speech session from being overwritten by the previous one.
      if (onEnd) {
        if (typeof queueMicrotask === 'function') queueMicrotask(notifyEndAndResume);
        else Promise.resolve().then(notifyEndAndResume);
      } else {
        resumeAfterEnd();
      }
      console.log('[HANDLE END EXIT C]');
    };

    const playWithBrowser = () => {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        handleEnd();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(speechText);
        if (selectedVoiceRef.current) {
          utterance.voice = selectedVoiceRef.current;
          utterance.lang = selectedVoiceRef.current.lang;
        } else {
          utterance.lang = languageRef.current === 'es' ? 'es-MX' : 'en-US';
        }
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        utterance.onstart = markAudibleSpeechStarted;
        utterance.onend = handleEnd;
        utterance.onerror = handleEnd;
        console.log('[VOICE STATE] browser speech prepared');
        clearAudibleStartTimer();
        const routeHandoffMs = Math.max(0, playbackLeadInMs - ETERNA_AVATAR_AUDIO_LEAD_IN_MS);
        audibleStartTimerRef.current = setTimeout(() => {
          if (!speechSessionActiveRef.current || speechGeneration !== speechGenerationRef.current) return;
          setIsAvatarSpeaking(true);
          audibleStartTimerRef.current = setTimeout(() => {
            audibleStartTimerRef.current = null;
            if (!speechSessionActiveRef.current || speechGeneration !== speechGenerationRef.current) return;
            console.log('[VOICE STATE] browser speech start');
            window.speechSynthesis.speak(utterance);
          }, ETERNA_AVATAR_AUDIO_LEAD_IN_MS);
        }, routeHandoffMs);
      } catch (e) {
        console.warn('[Eterna Voice] browser speech failed:', e);
        handleEnd();
      }
    };

    const playWithRemoteEngine = async (engine: Exclude<EternaVoiceEngine, 'browser'>) => {
      const controller = new AbortController();
      speechRequestRef.current = controller;
      let fallbackStarted = false;
      let firstAudioTimedOut = false;
      let pcmAudioScheduled = false;
      let stopOutputWarmup: (() => void) | null = null;
      let outputWarmupStopTimer: ReturnType<typeof setTimeout> | null = null;
      const stopWarmupNow = () => {
        if (outputWarmupStopTimer) {
          clearTimeout(outputWarmupStopTimer);
          outputWarmupStopTimer = null;
        }
        stopOutputWarmup?.();
        stopOutputWarmup = null;
      };
      const stopWarmupAtPlayback = (delayMs: number) => {
        if (!stopOutputWarmup || outputWarmupStopTimer) return;
        outputWarmupStopTimer = setTimeout(stopWarmupNow, Math.max(0, delayMs));
      };
      const firstAudioTimer = window.setTimeout(() => {
        firstAudioTimedOut = true;
        controller.abort();
      }, ETERNA_FIRST_AUDIO_TIMEOUT_MS);

      try {
        // Keep the mobile speaker route active while Fish Audio generates the
        // first bytes. This prevents the OS from switching late and swallowing
        // the first words after SpeechRecognition releases the microphone.
        const context = ensurePcmAudioContext();
        await context.resume().catch(() => {});
        stopOutputWarmup = startSilentAudioOutputWarmup(context);
        const response = await fetch('/api/voz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texto: speechText,
            engine,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Voice engine ${engine} returned ${response.status}`);

        if (getPcmSampleRate(response)) {
          // Installed mobile apps and WebViews can close a retained context
          // during client-side navigation. A closed instance cannot schedule
          // the next property's audio, so always replace it before playback.
          await playPcmStream({
            response,
            context,
            signal: controller.signal,
            sources: pcmSourcesRef.current,
            leadInMs: playbackLeadInMs,
            onFirstAudioScheduled: (activeContext, startAt) => {
              pcmAudioScheduled = true;
              window.clearTimeout(firstAudioTimer);
              const markPcmPlaybackStarted = () => {
                if (!speechSessionActiveRef.current) return;
                pendingAudioUnlockRef.current = null;
                clearAudibleStartTimer();
                const delayMs = Math.max(0, Math.round((startAt - activeContext.currentTime) * 1_000));
                stopWarmupAtPlayback(delayMs);
                const avatarPreRollDelayMs = Math.max(0, delayMs - ETERNA_AVATAR_AUDIO_LEAD_IN_MS);
                audibleStartTimerRef.current = setTimeout(() => {
                  if (!speechSessionActiveRef.current || speechGeneration !== speechGenerationRef.current) return;
                  setIsAvatarSpeaking(true);
                  audibleStartTimerRef.current = setTimeout(() => {
                    audibleStartTimerRef.current = null;
                    if (!speechSessionActiveRef.current || speechGeneration !== speechGenerationRef.current) return;
                    markAudibleSpeechStarted();
                    console.log(`[VOICE STATE] ${engine} PCM playback start`);
                  }, Math.min(ETERNA_AVATAR_AUDIO_LEAD_IN_MS, delayMs));
                }, avatarPreRollDelayMs);
              };

              if (activeContext.state === 'running') {
                markPcmPlaybackStarted();
                return;
              }

              pendingAudioUnlockRef.current = () => {
                void activeContext.resume()
                  .then(markPcmPlaybackStarted)
                  .catch(() => {
                    if (fallbackStarted || !speechSessionActiveRef.current) return;
                    fallbackStarted = true;
                    controller.abort();
                    addVoiceDebugLog(`[VOICE FALLBACK] ${engine} autoplay -> browser`);
                    playWithBrowser();
                  });
              };
              addVoiceDebugLog(`[VOICE WAITING FOR MOBILE GESTURE] ${engine}`);
            },
            onPlaybackEnded: () => {
              if (speechSessionActiveRef.current) handleEnd();
            },
          });
          return;
        }

        throw new Error(`Voice engine ${engine} did not return a PCM stream`);
      } catch (error) {
        if (!speechSessionActiveRef.current) return;
        if (controller.signal.aborted && !firstAudioTimedOut) return;
        if (fallbackStarted) return;
        fallbackStarted = true;
        pendingAudioUnlockRef.current = null;
        stopWarmupNow();
        stopPcmSources(pcmSourcesRef.current);
        console.warn(`[Eterna Voice] ${engine} unavailable, using browser fallback:`, error);
        addVoiceDebugLog(`[VOICE FALLBACK] ${engine}${firstAudioTimedOut ? ' timeout' : ''} -> browser`);
        playWithBrowser();
      } finally {
        window.clearTimeout(firstAudioTimer);
        if (!pcmAudioScheduled) stopWarmupNow();
      }
    };

    startSelectedEngine = () => {
      if (selectedEngine === 'browser') playWithBrowser();
      else void playWithRemoteEngine(selectedEngine);
    };

    // Si el micrófono estaba escuchando, esperamos su evento onend antes de reproducir.
    if (wasRecognitionActive && recognitionActiveRef.current) {
      // `pendingSpeechStartRef` was registered before `abort()` above. The
      // recognition `onend` callback now owns the exact handoff to audio.
    } else if (wasRecognitionActive) {
      // If aborting ended recognition without firing `onend`, start directly.
      pendingSpeechStartRef.current = null;
      startSelectedEngine();
    } else {
      startSelectedEngine();
    }
  }, [clearAudibleStartTimer, clearRecognitionRestartTimer, ensurePcmAudioContext, enterListeningState, startBargeInMonitoring, stopBargeInMonitoring, transitionToState]);

  const interruptEterna = useCallback(() => {
    clearAudibleStartTimer();
    stopBargeInMonitoring();
    speechGenerationRef.current += 1;
    speechOutputGuardRef.current = false;
    speechCooldownUntilRef.current = Date.now();
    clearRecognitionRestartTimer();
    recognitionStartFailuresRef.current = 0;
    lastRecognitionErrorRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isConnectedRef.current) {
      interruptRef.current?.();
    }

    setIsSpeaking(false);
    setIsAvatarSpeaking(false);
    isSpeakingRef.current = false; // Sync ref synchronously to prevent handleEnd from executing
    console.trace('[AUDIT] speechSessionActiveRef -> false (interruptEterna)');
    speechSessionActiveRef.current = false; // Clear session ref on interrupt
    setSimulatedStatusRef.current?.('listening');
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null; // Clear any pending speech
    pendingListeningResumeRef.current = null;
    pendingAudioUnlockRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    stopPcmSources(pcmSourcesRef.current);

    // An interruption should return to LISTENING immediately.
    enterListeningState();

    if (recognitionRef.current) {
      if (recognitionActiveRef.current) {
        try {
          console.log('[VOICE STATE] recognition aborted');
          recognitionRef.current.abort();
        } catch {}
      }
    }
  }, [clearAudibleStartTimer, clearRecognitionRestartTimer, enterListeningState, stopBargeInMonitoring]);

  const startConversationMode = useCallback((microphoneAlreadyAuthorized = false) => {
    clearAudibleStartTimer();
    addVoiceDebugLog(`[CALL] startConversationMode`);
    addVoiceDebugLog(`startConversationMode called. voiceMode before: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] startConversationMode before: voiceMode =", voiceModeRef.current);
    if (!speechRecognitionSupportedRef.current || !recognitionRef.current) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: language === 'es'
          ? 'Tu navegador no permite reconocimiento de voz. Puedes seguir escribiéndome aquí.'
          : 'Your browser does not support speech recognition. You can keep typing to me here.',
      }]);
      return;
    }
    loggedSetVoiceMode(true, "startConversationMode");
    voiceModeRef.current = true; // Synchronously update ref to avoid React state batching delays
    stopBargeInMonitoring(true);
    primeBargeInAudioContext();
    preparePcmAudioPlayback();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speechGenerationRef.current += 1;
    speechOutputGuardRef.current = false;
    speechCooldownUntilRef.current = Date.now();
    clearRecognitionRestartTimer();
    recognitionStartFailuresRef.current = 0;
    lastRecognitionErrorRef.current = null;
    setSimulatedStatusRef.current?.('listening');
    setThinkingContextRef.current?.('general');
    setIsSpeaking(false);
    setIsAvatarSpeaking(false);
    isSpeakingRef.current = false;
    console.trace('[AUDIT] speechSessionActiveRef -> false (startConversationMode)');
    speechSessionActiveRef.current = false; // Clear session ref
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null;
    pendingListeningResumeRef.current = null;
    pendingAudioUnlockRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    stopPcmSources(pcmSourcesRef.current);

    const beginRecognition = () => {
      releaseMicrophoneCapture();
      if (voiceModeRef.current && !isMutedRef.current) {
        // Android/Chromium can keep the audio device busy for a brief moment
        // after getUserMedia releases its permission probe. Waiting here
        // prevents a silent audio-capture/InvalidState failure.
        scheduleRecognitionRestart(RECOGNITION_DEVICE_SETTLE_MS, 'captura liberada');
      }
    };

    if (microphoneAlreadyAuthorized) {
      beginRecognition();
    } else {
      // Internal/legacy callers can still prime permission here. Explicit UI
      // buttons pass `true` because they already requested access in the
      // original click/tap call stack.
      void ensureMicrophoneCapture().finally(beginRecognition);
    }
    addVoiceDebugLog(`startConversationMode completed. voiceMode after: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] startConversationMode after: voiceMode =", voiceModeRef.current);
  }, [clearAudibleStartTimer, clearRecognitionRestartTimer, ensureMicrophoneCapture, language, loggedSetVoiceMode, preparePcmAudioPlayback, primeBargeInAudioContext, releaseMicrophoneCapture, scheduleRecognitionRestart, setChatHistory, stopBargeInMonitoring]);

  const stopConversationMode = useCallback(() => {
    clearAudibleStartTimer();
    addVoiceDebugLog(`[CALL] stopConversationMode`);
    addVoiceDebugLog(`stopConversationMode called. voiceMode before: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] stopConversationMode before: voiceMode =", voiceModeRef.current);
    speechGenerationRef.current += 1;
    speechOutputGuardRef.current = false;
    speechCooldownUntilRef.current = Date.now();
    clearRecognitionRestartTimer();
    recognitionStartFailuresRef.current = 0;
    lastRecognitionErrorRef.current = null;
    stopBargeInMonitoring(true);
    loggedSetVoiceMode(false, "stopConversationMode");
    voiceModeRef.current = false; // Synchronously update ref
    transitionToState('disabled');
    setIsListening(false);
    isListeningRef.current = false;
    isStoppingForSpeechRef.current = false; // Reset flag
    pendingSpeechStartRef.current = null;
    pendingListeningResumeRef.current = null;
    pendingAudioUnlockRef.current = null;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    stopPcmSources(pcmSourcesRef.current);
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
    setIsAvatarSpeaking(false);
    isSpeakingRef.current = false;
    console.trace('[AUDIT] speechSessionActiveRef -> false (stopConversationMode)');
    speechSessionActiveRef.current = false; // Clear session ref
    setPartialTranscript('');
    releaseMicrophoneCapture();
    setSimulatedStatusRef.current?.('idle');
    setThinkingContextRef.current?.('general');
    addVoiceDebugLog(`stopConversationMode completed. voiceMode after: ${voiceModeRef.current}`);
    console.log("[MOBILE TAP] stopConversationMode after: voiceMode =", voiceModeRef.current);
  }, [clearAudibleStartTimer, clearRecognitionRestartTimer, loggedSetVoiceMode, releaseMicrophoneCapture, stopBargeInMonitoring, transitionToState]);

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
    automaticBargeInHandlerRef.current = interruptEterna;
  }); // Runs on every render

  useWebSpeechRecognition({
    language,
    recognitionRef,
    recognitionActiveRef,
    recognitionStartPendingRef,
    recognitionStartFailuresRef,
    lastRecognitionErrorRef,
    isListeningRef,
    isSpeakingRef,
    isStoppingForSpeechRef,
    speechOutputGuardRef,
    speechSessionActiveRef,
    speechCooldownUntilRef,
    pendingSpeechStartRef,
    pendingListeningResumeRef,
    voiceModeRef,
    voiceStateRef,
    lastFinalTranscriptRef,
    spokenTextHistoryRef,
    onMessageSendRef,
    setSimulatedStatusRef,
    setIsListening,
    setIsSpeaking,
    setPartialTranscript,
    disableVoiceAfterRecognitionFailure,
    enterListeningState,
    scheduleRecognitionRestart,
    transitionToState,
  });

  useVoiceSessionLifecycle({
    pendingAudioUnlockRef,
    prepareAudioPlayback: preparePcmAudioPlayback,
    speechGenerationRef,
    speechOutputGuardRef,
    speechCooldownUntilRef,
    speechCooldownTimerRef,
    recognitionRef,
    speechRequestRef,
    pcmSourcesRef,
    clearRecognitionRestartTimer,
    stopBargeInMonitoring,
    releaseMicrophoneCapture,
  });

  useEffect(() => () => clearAudibleStartTimer(), [clearAudibleStartTimer]);

  return {
    voiceMode,
    voiceState,
    isListening,
    isSpeaking,
    isAvatarSpeaking,
    partialTranscript,
    speechRecognitionSupported,
    startVoiceMode: startConversationMode,
    stopVoiceMode: stopConversationMode,
    handleVoiceButtonClick,
    speak,
    interruptVoice: interruptEterna
  };
}
