"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, MessageCircle, Sparkles } from "lucide-react";

interface EternaPromptRailProps {
  isDark: boolean;
  language: "es" | "en";
  onSelect: (prompt: string) => void;
}

const PROMPTS = {
  es: [
    "Busco una casa de hasta 3 millones en Guadalajara",
    "Quiero vender mi departamento",
    "Muéstrame casas económicas en Mazatlán",
    "Busco un departamento de 2 recámaras para comprar",
    "Quiero rentar una casa en Culiacán",
    "Llévame a publicar una propiedad",
    "Muéstrame propiedades con potencial de inversión",
    "Compara las mejores opciones para mi presupuesto",
    "¿Cuánto pagaría al mes por una propiedad de 2 millones?",
    "Ayúdame a encontrar una propiedad cerca de escuelas",
    "Quiero una casa con alberca y 3 habitaciones",
    "Explícame qué necesito revisar antes de comprar",
  ],
  en: [
    "Find me a home under 3 million pesos in Guadalajara",
    "I want to sell my apartment",
    "Show me affordable homes in Mazatlán",
    "I need a two-bedroom apartment to buy",
    "I want to rent a house in Culiacán",
    "Take me to publish a property",
    "Show me properties with investment potential",
    "Compare the best options for my budget",
    "What would I pay monthly for a 2 million peso home?",
    "Help me find a property near schools",
    "I want a three-bedroom house with a pool",
    "Explain what I should check before buying",
  ],
} as const;

export default function EternaPromptRail({ isDark, language, onSelect }: EternaPromptRailProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const prompts = PROMPTS[language];
  const activePrompt = prompts[activeIndex % prompts.length];

  useEffect(() => {
    if (isPaused || reduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % prompts.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [isPaused, prompts.length, reduceMotion]);

  return (
    <div className="mx-auto w-full max-w-[1120px] shrink-0 px-0.5 sm:px-2">
      <button
        type="button"
        onClick={() => onSelect(activePrompt)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        aria-label={`${language === "es" ? "Probar petición" : "Try request"}: ${activePrompt}`}
        className={`group relative flex h-[62px] w-full items-center overflow-hidden rounded-[23px] border px-3 text-left backdrop-blur-2xl transition-all duration-300 sm:h-14 sm:px-4 lg:px-5 ${
          isDark
            ? "border-white/10 bg-white/[0.055] text-white shadow-[0_16px_50px_rgba(0,0,0,0.34)] hover:border-white/20 hover:bg-white/[0.08]"
            : "border-white/90 bg-white/82 text-zinc-950 shadow-[0_16px_45px_rgba(24,24,27,0.07)] ring-1 ring-zinc-200/50 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_20px_55px_rgba(84,76,255,0.12)]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-28 opacity-70 blur-2xl transition-opacity group-hover:opacity-100 ${
            isDark ? "bg-blue-500/15" : "bg-violet-300/25"
          }`}
        />

        <span className={`relative mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:mr-4 ${
          isDark ? "bg-white/10 text-blue-300" : "bg-[#6C63FF]/9 text-[#6258F5]"
        }`}>
          <MessageCircle className="h-4 w-4" />
          <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5" />
        </span>

        <span className="relative hidden shrink-0 items-center gap-2 pr-4 sm:flex">
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${
            isDark ? "text-white/40" : "text-zinc-400"
          }`}>
            {language === "es" ? "Prueba con Eterna" : "Try asking Eterna"}
          </span>
          <span className={`h-5 w-px ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
        </span>

        <span className="relative min-w-0 flex-1 overflow-hidden">
          <span className={`mb-0.5 block text-[8px] font-black uppercase tracking-[0.16em] sm:hidden ${
            isDark ? "text-white/35" : "text-zinc-400"
          }`}>
            {language === "es" ? "Puedes decirle" : "Try saying"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${language}-${activeIndex}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10, filter: "blur(3px)" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="block truncate text-[12px] font-semibold tracking-[-0.01em] sm:text-[13px] lg:text-sm"
              aria-live="polite"
            >
              “{activePrompt}”
            </motion.span>
          </AnimatePresence>
        </span>

        <span className={`relative ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-0.5 ${
          isDark ? "border border-white/10 bg-white/[0.06] text-white/70" : "border border-zinc-200 bg-white text-zinc-700 shadow-sm"
        }`}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>

        {!reduceMotion && !isPaused && (
          <motion.span
            key={`progress-${language}-${activeIndex}`}
            aria-hidden="true"
            className="absolute inset-x-5 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-[#6C63FF] to-transparent"
            initial={{ scaleX: 0, opacity: 0.15 }}
            animate={{ scaleX: 1, opacity: 0.75 }}
            transition={{ duration: 4.2, ease: "linear" }}
          />
        )}
      </button>
    </div>
  );
}
