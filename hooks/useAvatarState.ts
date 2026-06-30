"use client";
import { useLiveContext } from "../lib/context/LiveContext";

export type AvatarState = "WAITING" | "LISTENING" | "THINKING" | "TALKING";

export function useAvatarState(): AvatarState {
  const { eternaChatState } = useLiveContext();
  const { isListening, status } = eternaChatState;

  if (isListening) {
    return "LISTENING";
  }

  if (status === "talking") {
    return "TALKING";
  }

  if (status === "thinking") {
    return "THINKING";
  }

  return "WAITING";
}
