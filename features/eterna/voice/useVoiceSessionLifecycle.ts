import { useEffect } from 'react';

import { stopPcmSources } from '@/features/eterna/audio/pcmStreamPlayer';
import { type SpeechRecognitionInstance } from '@/features/eterna/voice/browserSpeech';
import { addVoiceDebugLog } from '@/features/eterna/voice/voiceDebug';

type RefCell<T> = { current: T };

interface UseVoiceSessionLifecycleOptions {
  pendingAudioUnlockRef: RefCell<(() => void) | null>;
  prepareAudioPlayback: () => void;
  speechGenerationRef: RefCell<number>;
  speechOutputGuardRef: RefCell<boolean>;
  speechCooldownUntilRef: RefCell<number>;
  speechCooldownTimerRef: RefCell<ReturnType<typeof setTimeout> | null>;
  recognitionRef: RefCell<SpeechRecognitionInstance | null>;
  speechRequestRef: RefCell<AbortController | null>;
  pcmSourcesRef: RefCell<Set<AudioBufferSourceNode>>;
  clearRecognitionRestartTimer: () => void;
  stopBargeInMonitoring: (closeAudioContext?: boolean) => void;
  releaseMicrophoneCapture: () => void;
}

function abortRecognition(recognitionRef: RefCell<SpeechRecognitionInstance | null>): void {
  if (!recognitionRef.current) return;

  try {
    console.log('[VOICE STATE] recognition aborted');
    recognitionRef.current.abort();
  } catch {}
}

function abortSpeechRequest(speechRequestRef: RefCell<AbortController | null>): void {
  speechRequestRef.current?.abort();
}

export function useVoiceSessionLifecycle({
  pendingAudioUnlockRef,
  prepareAudioPlayback,
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
}: UseVoiceSessionLifecycleOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const unlockPendingAudio = () => {
      // Mobile browsers grant Web Audio playback from a user gesture. Prime
      // the retained context on every real interaction so a property summary
      // requested after client-side navigation can still start once Fish
      // Audio begins streaming.
      prepareAudioPlayback();
      const pendingPlayback = pendingAudioUnlockRef.current;
      if (!pendingPlayback) return;

      pendingAudioUnlockRef.current = null;
      pendingPlayback();
    };

    document.addEventListener('pointerdown', unlockPendingAudio, true);
    document.addEventListener('touchstart', unlockPendingAudio, true);
    document.addEventListener('keydown', unlockPendingAudio, true);

    return () => {
      document.removeEventListener('pointerdown', unlockPendingAudio, true);
      document.removeEventListener('touchstart', unlockPendingAudio, true);
      document.removeEventListener('keydown', unlockPendingAudio, true);
    };
  }, [pendingAudioUnlockRef, prepareAudioPlayback]);

  useEffect(() => {
    const pcmSources = pcmSourcesRef.current;
    return () => {
      speechGenerationRef.current += 1;
      speechOutputGuardRef.current = false;
      speechCooldownUntilRef.current = Date.now();
      clearRecognitionRestartTimer();
      if (speechCooldownTimerRef.current) {
        clearTimeout(speechCooldownTimerRef.current);
        speechCooldownTimerRef.current = null;
      }
      abortRecognition(recognitionRef);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      abortSpeechRequest(speechRequestRef);
      pendingAudioUnlockRef.current = null;
      stopPcmSources(pcmSources);
      stopBargeInMonitoring(true);
      releaseMicrophoneCapture();
    };
  }, [
    clearRecognitionRestartTimer,
    pcmSourcesRef,
    pendingAudioUnlockRef,
    recognitionRef,
    releaseMicrophoneCapture,
    speechCooldownTimerRef,
    speechCooldownUntilRef,
    speechGenerationRef,
    speechOutputGuardRef,
    speechRequestRef,
    stopBargeInMonitoring,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => addVoiceDebugLog(`[EVENT] document.visibilitychange. hidden=${document.hidden}`);
    const handleBlur = () => addVoiceDebugLog('[EVENT] window.blur');
    const handleFocus = () => addVoiceDebugLog('[EVENT] window.focus');
    const handlePageHide = () => addVoiceDebugLog('[EVENT] pagehide');
    const handleBeforeUnload = () => addVoiceDebugLog('[EVENT] beforeunload');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
