import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { type StreamStatus } from '@/hooks/useWebSocketStream';
import {
  normalizeVoiceText,
  voiceTokenOverlap,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionEvent,
  type SpeechRecognitionInstance,
} from '@/features/eterna/voice/browserSpeech';
import { addVoiceDebugLog } from '@/features/eterna/voice/voiceDebug';
import { type VoiceModeState } from '@/features/eterna/voice/types';

export const SPOKEN_ECHO_MEMORY_MS = 30_000;
export const RECOGNITION_DEVICE_SETTLE_MS = 180;
export const RECOGNITION_MAX_START_RETRIES = 5;

const DUPLICATE_TRANSCRIPT_WINDOW_MS = 4_000;

type RefCell<T> = { current: T };

interface UseWebSpeechRecognitionOptions {
  language: 'es' | 'en';
  recognitionRef: RefCell<SpeechRecognitionInstance | null>;
  recognitionActiveRef: RefCell<boolean>;
  recognitionStartPendingRef: RefCell<boolean>;
  recognitionStartFailuresRef: RefCell<number>;
  lastRecognitionErrorRef: RefCell<string | null>;
  isListeningRef: RefCell<boolean>;
  isSpeakingRef: RefCell<boolean>;
  isStoppingForSpeechRef: RefCell<boolean>;
  speechOutputGuardRef: RefCell<boolean>;
  speechSessionActiveRef: RefCell<boolean>;
  speechCooldownUntilRef: RefCell<number>;
  pendingSpeechStartRef: RefCell<(() => void) | null>;
  pendingListeningResumeRef: RefCell<(() => void) | null>;
  voiceModeRef: RefCell<boolean>;
  voiceStateRef: RefCell<VoiceModeState>;
  lastFinalTranscriptRef: RefCell<{ text: string; at: number }>;
  spokenTextHistoryRef: RefCell<Array<{ text: string; at: number }>>;
  onMessageSendRef: RefCell<(text: string) => void>;
  setSimulatedStatusRef: RefCell<Dispatch<SetStateAction<StreamStatus>> | null>;
  setIsListening: Dispatch<SetStateAction<boolean>>;
  setIsSpeaking: Dispatch<SetStateAction<boolean>>;
  setPartialTranscript: Dispatch<SetStateAction<string>>;
  disableVoiceAfterRecognitionFailure: (reason: string, permissionBlocked?: boolean) => void;
  enterListeningState: () => void;
  scheduleRecognitionRestart: (delayMs: number, reason: string) => void;
  transitionToState: (state: VoiceModeState) => void;
}

export function useWebSpeechRecognition({
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
}: UseWebSpeechRecognitionOptions): void {
  useEffect(() => {
    let active = true;
    let recInstance: SpeechRecognitionInstance | null = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        console.log('[VOICE STATE] recognition aborted');
        recognitionRef.current.abort();
      } catch (error) {
        console.warn('[Eterna Voice] Error aborting existing recognition:', error);
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
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = language === 'es' ? 'es-MX' : 'en-US';
        recInstance = rec;

        rec.onstart = () => {
          addVoiceDebugLog('[EVENT] SpeechRecognition.onstart');
          console.log('[Eterna Voice Console] recognition.onstart triggered. isListening:', isListeningRef.current);
          if (!active) return;
          recognitionStartPendingRef.current = false;
          recognitionActiveRef.current = true;
          recognitionStartFailuresRef.current = 0;
          lastRecognitionErrorRef.current = null;
          if (isSpeakingRef.current || speechOutputGuardRef.current || speechSessionActiveRef.current || speechCooldownUntilRef.current > Date.now()) {
            addVoiceDebugLog('[VOICE STATE] recognition.onstart blocked during output guard');
            try { rec.abort(); } catch {}
            return;
          }
          setIsListening(true);
          isListeningRef.current = true;
          setPartialTranscript('');
        };

        rec.onend = () => {
          addVoiceDebugLog('[EVENT] SpeechRecognition.onend');
          console.log('[VOICE STATE] recognition ended');
          setIsListening(false);
          isListeningRef.current = false;
          recognitionActiveRef.current = false;
          recognitionStartPendingRef.current = false;
          setPartialTranscript('');

          if (!active) return;

          if (pendingSpeechStartRef.current) {
            const startSpeech = pendingSpeechStartRef.current;
            pendingSpeechStartRef.current = null;
            try {
              startSpeech();
            } catch (error) {
              console.warn('[Eterna Voice] pending speech failed:', error);
              setSimulatedStatusRef.current?.('idle');
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              console.trace('[AUDIT] speechSessionActiveRef -> false (rec.onend catch)');
              speechSessionActiveRef.current = false;
              isStoppingForSpeechRef.current = false;
              enterListeningState();
            }
            return;
          }

          if (pendingListeningResumeRef.current) {
            const resumeListening = pendingListeningResumeRef.current;
            pendingListeningResumeRef.current = null;
            try {
              resumeListening();
            } catch (error) {
              console.warn('[Eterna Voice] pending listening resume failed:', error);
              isStoppingForSpeechRef.current = false;
            }
            return;
          }

          if (voiceModeRef.current && voiceStateRef.current === 'LISTENING' && !speechOutputGuardRef.current && !speechSessionActiveRef.current) {
            const previousError = lastRecognitionErrorRef.current;
            lastRecognitionErrorRef.current = null;
            scheduleRecognitionRestart(
              previousError === 'audio-capture' ? 750 : RECOGNITION_DEVICE_SETTLE_MS,
              previousError || 'fin de turno sin transcripción',
            );
          }
        };

        rec.onerror = (event) => {
          addVoiceDebugLog(`[EVENT] SpeechRecognition.onerror: ${event.error}`);
          console.log('[Eterna Voice Console] recognition.onerror triggered. Error details:', event.error);
          if (!active) return;
          recognitionStartPendingRef.current = false;
          console.warn('[Eterna Voice] SpeechRecognition error:', event.error);
          lastRecognitionErrorRef.current = event.error;

          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            disableVoiceAfterRecognitionFailure(`recognition.onerror: ${event.error}`, true);
            return;
          }

          if (event.error !== 'aborted') {
            recognitionActiveRef.current = false;
            recognitionStartFailuresRef.current += 1;
            if (recognitionStartFailuresRef.current >= RECOGNITION_MAX_START_RETRIES) {
              disableVoiceAfterRecognitionFailure(`recognition.onerror retry limit: ${event.error}`);
              return;
            }

            scheduleRecognitionRestart(
              event.error === 'audio-capture' ? 750 : 300,
              `error ${event.error}`,
            );
          }
        };

        rec.onnomatch = () => addVoiceDebugLog('[EVENT] SpeechRecognition.onnomatch');
        rec.onaudiostart = () => addVoiceDebugLog('[EVENT] SpeechRecognition.onaudiostart');
        rec.onaudioend = () => addVoiceDebugLog('[EVENT] SpeechRecognition.onaudioend');
        rec.onspeechstart = () => addVoiceDebugLog('[EVENT] SpeechRecognition.onspeechstart');
        rec.onspeechend = () => addVoiceDebugLog('[EVENT] SpeechRecognition.onspeechend');

        rec.onresult = (event: SpeechRecognitionEvent) => {
          if (voiceStateRef.current !== 'LISTENING' || isSpeakingRef.current || speechOutputGuardRef.current || speechSessionActiveRef.current || speechCooldownUntilRef.current > Date.now()) {
            console.log('[VOICE STATE] transcript blocked', voiceStateRef.current);
            return;
          }

          console.log('[Eterna Voice Console] recognition.onresult triggered. Event results length:', event.results.length);
          if (!active) return;
          let interimTranscript = '';
          let finalTranscript = '';

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const transcript = event.results[index][0].transcript;
            if (event.results[index].isFinal) finalTranscript += transcript;
            else interimTranscript += transcript;
          }

          console.log('[Eterna Voice Console] finalTranscript parsed:', JSON.stringify(finalTranscript), 'interim:', JSON.stringify(interimTranscript));
          if (interimTranscript) setPartialTranscript(interimTranscript);

          if (finalTranscript.trim()) {
            const transcriptText = finalTranscript.trim();
            setPartialTranscript('');

            const normalizedTranscript = normalizeVoiceText(transcriptText);
            const now = Date.now();
            const previousTranscript = lastFinalTranscriptRef.current;
            if (
              normalizedTranscript.length < 2
              || (
                previousTranscript.text === normalizedTranscript
                && now - previousTranscript.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
              )
            ) {
              addVoiceDebugLog('[MIC] transcripción final duplicada ignorada');
              return;
            }

            const recentSpokenText = spokenTextHistoryRef.current.filter(item => now - item.at < SPOKEN_ECHO_MEMORY_MS);
            spokenTextHistoryRef.current = recentSpokenText;
            const likelyEcho = normalizedTranscript.length >= 16 && recentSpokenText.some((item) => {
              if (item.text === normalizedTranscript) return true;
              if (normalizedTranscript.includes(item.text) || item.text.includes(normalizedTranscript)) return true;
              return voiceTokenOverlap(normalizedTranscript, item.text) >= 0.82;
            });
            if (likelyEcho) {
              addVoiceDebugLog('[MIC] posible eco de Eterna ignorado');
              return;
            }
            lastFinalTranscriptRef.current = { text: normalizedTranscript, at: now };

            transitionToState('PROCESSING');
            isStoppingForSpeechRef.current = true;
            try {
              rec.abort();
            } catch {
              recognitionActiveRef.current = false;
              recognitionStartPendingRef.current = false;
            }

            console.log('[Eterna Voice Console] calling onMessageSendRef.current with finalTranscript:', JSON.stringify(transcriptText));
            setSimulatedStatusRef.current?.('thinking');
            onMessageSendRef.current(transcriptText);
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
      if (recognitionRef.current === recInstance) recognitionRef.current = null;
    };
  }, [
    disableVoiceAfterRecognitionFailure,
    enterListeningState,
    isListeningRef,
    isSpeakingRef,
    isStoppingForSpeechRef,
    language,
    lastFinalTranscriptRef,
    lastRecognitionErrorRef,
    onMessageSendRef,
    pendingListeningResumeRef,
    pendingSpeechStartRef,
    recognitionActiveRef,
    recognitionRef,
    recognitionStartFailuresRef,
    recognitionStartPendingRef,
    scheduleRecognitionRestart,
    setIsListening,
    setIsSpeaking,
    setPartialTranscript,
    setSimulatedStatusRef,
    speechCooldownUntilRef,
    speechOutputGuardRef,
    speechSessionActiveRef,
    spokenTextHistoryRef,
    transitionToState,
    voiceModeRef,
    voiceStateRef,
  ]);
}
