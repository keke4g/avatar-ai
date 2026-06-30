"use client";
import React from "react";
import { useLiveContext } from "../../lib/context/LiveContext";
import { Mic, Send, MicOff } from "lucide-react";

interface HeroSearchProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  isDark?: boolean;
}

export default function HeroSearch({ inputValue, setInputValue, isDark = false }: HeroSearchProps) {
  const { eternaChatState, sendPrompt, startVoice } = useLiveContext();
  const { isListening } = eternaChatState;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputValue.trim()) {
      sendPrompt(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[650px] mx-auto px-4 select-none"
    >
      <div
        className={`relative flex items-center border rounded-full px-5 py-2.5 transition-all duration-300 ${
          isListening
            ? "border-blue-500/50 bg-white/[0.05]"
            : isDark
            ? "bg-white/[0.03] border-white/10 hover:border-white/20 focus-within:border-white/20 focus-within:bg-white/[0.05]"
            : "bg-zinc-50 border-zinc-200/80 hover:border-zinc-300 focus-within:border-zinc-300 focus-within:bg-white"
        }`}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué propiedad buscas?"
          className={`flex-1 bg-transparent border-none outline-none text-sm py-1 px-2 w-full transition-colors duration-300 ${
            isDark
              ? "text-white placeholder-white/30"
              : "text-zinc-800 placeholder-zinc-400"
          }`}
        />

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Microphone Button */}
          <button
            type="button"
            onClick={startVoice}
            className={`p-2 rounded-full cursor-pointer transition-all duration-200 ${
              isListening
                ? "bg-blue-500/20 text-blue-400 animate-pulse hover:bg-blue-500/30"
                : isDark
                ? "text-white/40 hover:text-white hover:bg-white/5"
                : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
            title={isListening ? "Escuchando..." : "Hablar con Eterna"}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={`p-2 rounded-full cursor-pointer transition-all duration-200 ${
              inputValue.trim()
                ? isDark
                  ? "bg-white/10 text-white hover:bg-white/20 hover:scale-105"
                  : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200 hover:scale-105"
                : isDark
                ? "text-white/20 cursor-not-allowed"
                : "text-zinc-300 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
