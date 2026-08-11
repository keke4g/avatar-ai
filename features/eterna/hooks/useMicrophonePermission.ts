"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  classifyMicrophoneError,
  getMobileBrowserGuide,
  type MicrophoneIssue,
  type MicrophonePermissionState,
} from '@/features/eterna/lib/microphoneSupport';
import type { StreamStatus } from '@/hooks/useWebSocketStream';

interface UseMicrophonePermissionOptions {
  geminiActive: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  isConnected: boolean;
  language: 'es' | 'en';
  onOpenChat: () => void;
  onStartVoiceMode: (microphoneAlreadyAuthorized?: boolean) => void;
  onVoiceButtonClick: () => void;
  simulatedStatus: StreamStatus;
  voiceMode: boolean;
  websocketStatus: StreamStatus;
}

interface EternaDebugWindow extends Window {
  __eternaAddDebugLog?: (message: string) => void;
  __eternaDebugLogs?: Array<{ time: string; message: string }>;
}

type PermissionResult =
  | { allowed: true }
  | { allowed: false; issue: MicrophoneIssue };

export function useMicrophonePermission({
  geminiActive,
  inputRef,
  isConnected,
  language,
  onOpenChat,
  onStartVoiceMode,
  onVoiceButtonClick,
  simulatedStatus,
  voiceMode,
  websocketStatus,
}: UseMicrophonePermissionOptions) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [issue, setIssue] = useState<MicrophoneIssue>('denied');
  const [checking, setChecking] = useState(false);
  const requestInFlightRef = useRef(false);

  const addDebugLog = useCallback((message: string) => {
    if (typeof window === 'undefined') return;
    const debugWindow = window as EternaDebugWindow;
    if (debugWindow.__eternaAddDebugLog) {
      debugWindow.__eternaAddDebugLog(message);
      return;
    }
    debugWindow.__eternaDebugLogs = debugWindow.__eternaDebugLogs || [];
    debugWindow.__eternaDebugLogs.push({
      time: new Date().toLocaleTimeString(),
      message,
    });
  }, []);

  const guide = useMemo(
    () => getMobileBrowserGuide(language),
    [language],
  );

  const checkPermission = useCallback(async (): Promise<MicrophonePermissionState> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return 'unsupported';
    }

    try {
      if (navigator.permissions?.query) {
        try {
          const result = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          if (result.state === 'granted') return 'granted';
          if (result.state === 'denied') return 'denied';
          return 'prompt';
        } catch {
          // Some browsers do not expose microphone through Permissions API.
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(
        (device) => device.kind === 'audioinput' && device.label !== '',
      )
        ? 'granted'
        : 'prompt';
    } catch {
      return 'prompt';
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionResult> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { allowed: false, issue: 'unsupported' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
          voiceIsolation: true,
        } as MediaTrackConstraints,
      });
      stream.getTracks().forEach((track) => track.stop());
      return { allowed: true };
    } catch (error: unknown) {
      const firstIssue = classifyMicrophoneError(error);
      if (firstIssue === 'denied' || firstIssue === 'not-found' || firstIssue === 'busy') {
        console.warn('Microphone access failed:', error);
        return { allowed: false, issue: firstIssue };
      }

      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        fallbackStream.getTracks().forEach((track) => track.stop());
        return { allowed: true };
      } catch (fallbackError: unknown) {
        console.warn('Microphone access denied:', fallbackError || error);
        return {
          allowed: false,
          issue: classifyMicrophoneError(fallbackError),
        };
      }
    }
  }, []);

  const openHelp = useCallback((nextIssue: MicrophoneIssue) => {
    setIssue(nextIssue);
    setShowInstructions(nextIssue === 'denied');
    setDialogOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setDialogOpen(false);
    setShowInstructions(false);
  }, []);

  const activate = useCallback(async () => {
    addDebugLog('[PERMISSION] handleMicButtonClickWithPermission triggered');
    if (requestInFlightRef.current) {
      addDebugLog('[PERMISSION] duplicate activation ignored while microphone is starting');
      return;
    }

    const currentStatus = isConnected && !geminiActive
      ? websocketStatus
      : simulatedStatus;
    if (currentStatus === 'talking') {
      addDebugLog('[PERMISSION] Eterna is speaking; interrupting before opening the microphone');
      onVoiceButtonClick();
      if (voiceMode) return;
    }
    if (voiceMode) {
      addDebugLog('[PERMISSION] voiceMode is active (muting), bypassing check');
      onVoiceButtonClick();
      return;
    }

    requestInFlightRef.current = true;
    setChecking(true);
    try {
      const result = await requestPermission();
      addDebugLog(
        `[PERMISSION] direct request result: ${'issue' in result ? result.issue : 'granted'}`,
      );
      if (!('issue' in result)) {
        onStartVoiceMode(true);
      } else {
        openHelp(result.issue);
      }
    } finally {
      setChecking(false);
      window.setTimeout(() => {
        requestInFlightRef.current = false;
      }, 250);
    }
  }, [
    addDebugLog,
    geminiActive,
    isConnected,
    onStartVoiceMode,
    onVoiceButtonClick,
    openHelp,
    requestPermission,
    simulatedStatus,
    voiceMode,
    websocketStatus,
  ]);

  const retry = useCallback(async () => {
    addDebugLog('[PERMISSION] Retry requested');
    setChecking(true);
    try {
      const permission = await checkPermission();
      if (permission === 'granted') {
        closeHelp();
        onOpenChat();
        if (!voiceMode) onVoiceButtonClick();
        return;
      }

      const result = await requestPermission();
      if (!('issue' in result)) {
        closeHelp();
        onOpenChat();
        if (!voiceMode) onVoiceButtonClick();
      } else {
        setIssue(result.issue);
        setShowInstructions(result.issue === 'denied');
      }
    } finally {
      setChecking(false);
    }
  }, [
    addDebugLog,
    checkPermission,
    closeHelp,
    onOpenChat,
    onVoiceButtonClick,
    requestPermission,
    voiceMode,
  ]);

  const recheck = useCallback(async () => {
    if (!dialogOpen) return;
    addDebugLog('[PERMISSION] Window focus/visibility changed. Re-checking permission status...');
    const permission = await checkPermission();
    addDebugLog(`[PERMISSION] Re-check state: ${permission}`);
    if (permission !== 'granted') return;

    closeHelp();
    onOpenChat();
    if (!voiceMode) onStartVoiceMode(true);
  }, [
    addDebugLog,
    checkPermission,
    closeHelp,
    dialogOpen,
    onOpenChat,
    onStartVoiceMode,
    voiceMode,
  ]);

  const continueWithText = useCallback(() => {
    closeHelp();
    onOpenChat();
    inputRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [closeHelp, inputRef, onOpenChat]);

  const toggleInstructions = useCallback(() => {
    setShowInstructions((current) => !current);
  }, []);

  return {
    activate,
    addDebugLog,
    checking,
    closeHelp,
    continueWithText,
    dialogOpen,
    guide,
    issue,
    recheck,
    retry,
    showInstructions,
    toggleInstructions,
  };
}
