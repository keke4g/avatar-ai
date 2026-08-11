"use client";
import { useLiveContext } from "../lib/context/LiveContext";

export type AvatarState = "WAITING" | "LISTENING" | "THINKING" | "TALKING";

export function useAvatarState(): AvatarState {
  const { eternaChatState } = useLiveContext();
  const { isAvatarSpeaking, isListening, voiceMode, status } = eternaChatState;

  if (isAvatarSpeaking || status === "talking") {
    return "TALKING";
  }

  if (status === "thinking") {
    return "THINKING";
  }

  // SpeechRecognition restarts after pauses and briefly reports
  // isListening=false. Keep the visual state stable for the full voice-mode
  // session instead of flashing back to WAITING between recognizer cycles.
  if (voiceMode || isListening) {
    return "LISTENING";
  }

  return "WAITING";
}
