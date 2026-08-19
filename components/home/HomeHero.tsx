"use client";
import React from "react";
import HeroVideo from "./HeroVideo";
import { useAvatarState } from "../../hooks/useAvatarState";
import { useLiveContext } from "../../lib/context/LiveContext";
import { LoaderCircle, Mic, MicOff, Square } from "lucide-react";

interface HomeHeroProps {
  isDark?: boolean;
}

export default function HomeHero({ isDark = false }: HomeHeroProps) {
  const avatarState = useAvatarState();
  const { eternaChatState, startVoice } = useLiveContext();
  const { isListening, voiceMode, isVoiceStarting, status } = eternaChatState;
  const isSpeaking = status === "talking";
  const isVoiceActive = voiceMode || isListening;
  const actionLabel = isSpeaking
    ? "Interrumpir"
    : isVoiceStarting
      ? "Activando…"
      : isVoiceActive
      ? "Finalizar"
      : "Hablar con Eterna";
  const actionAriaLabel = isSpeaking
    ? "Interrumpir a Eterna"
    : isVoiceStarting
      ? "Activando micrófono"
      : isVoiceActive
        ? "Finalizar conversación por voz"
        : "Hablar con Eterna";

  return (
    <div className="flex flex-col items-center justify-center w-full select-none mt-0 lg:mt-0">
      {/* Vertical video center */}
      <div className="w-full flex justify-center">
        <HeroVideo avatarState={avatarState} isDark={isDark} />
      </div>

      <button
        type="button"
        onClick={startVoice}
        aria-label={actionAriaLabel}
        disabled={isVoiceStarting}
        className={`home-hero-action relative z-30 -mt-16 inline-flex min-h-11 min-w-[190px] items-center justify-center gap-2 rounded-full border px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_14px_38px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:hover:translate-y-0 ${
          isSpeaking
            ? "border-rose-300/35 bg-rose-500/90 hover:bg-rose-500"
            : isVoiceStarting
              ? "border-sky-300/35 bg-sky-500/90"
              : isVoiceActive
              ? "border-sky-300/35 bg-sky-500/90 hover:bg-sky-500"
              : "border-white/20 bg-zinc-950/80 hover:border-sky-300/40 hover:bg-zinc-900/90"
        }`}
        data-active={isVoiceActive || isSpeaking ? "true" : "false"}
      >
        {isSpeaking ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : isVoiceStarting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : isVoiceActive ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        <span>{actionLabel}</span>
        {isListening && isVoiceActive
          ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
          : null}
      </button>
    </div>
  );
}
