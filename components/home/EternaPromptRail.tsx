"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";

interface EternaPromptRailProps {
  isDark: boolean;
  language: "es" | "en";
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

export default function EternaPromptRail({ isDark, language }: EternaPromptRailProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const prompts = PROMPTS[language];
  const activePrompt = prompts[activeIndex % prompts.length];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % prompts.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [prompts.length]);

  return (
    <div className="relative z-20 mx-auto w-full max-w-[340px] shrink-0 px-1 sm:max-w-[360px] lg:w-[300px] lg:max-w-none xl:w-[360px]">
      <div
        role="note"
        aria-label={language === "es" ? "Ideas para hablar con Eterna" : "Ideas for talking to Eterna"}
        className={`relative flex h-[66px] w-full items-center overflow-visible rounded-[22px] border px-3.5 text-left backdrop-blur-2xl sm:px-4 ${
          isDark
            ? "border-white/10 bg-[#101017]/88 text-white shadow-[0_16px_42px_rgba(0,0,0,0.38)]"
            : "border-white/95 bg-white/88 text-zinc-950 shadow-[0_14px_38px_rgba(24,24,27,0.09)] ring-1 ring-zinc-200/55"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-24 rounded-l-[22px] opacity-70 blur-2xl ${
            isDark ? "bg-blue-500/15" : "bg-violet-300/25"
          }`}
        />

        <span className={`relative mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${
          isDark ? "bg-white/10 text-blue-300" : "bg-[#6C63FF]/9 text-[#6258F5]"
        }`}>
          <MessageCircle className="h-4 w-4" />
          <Sparkles className="absolute -right-1 -top-1 h-3 w-3" />
        </span>

        <span className="relative min-w-0 flex-1">
          <span className={`mb-1 block text-[8px] font-black uppercase tracking-[0.2em] ${
            isDark ? "text-blue-200/55" : "text-[#6258F5]/70"
          }`}>
            {language === "es" ? "Dile a Eterna" : "Say to Eterna"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${language}-${activeIndex}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10, filter: "blur(3px)" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="block truncate text-[11px] font-semibold leading-tight tracking-[-0.01em] sm:text-xs"
            >
              “{activePrompt}”
            </motion.span>
          </AnimatePresence>
        </span>

        <span aria-hidden="true" className="ml-2 flex h-5 shrink-0 items-center gap-[3px]">
          {[0, 1, 2].map((bar) => (
            <motion.span
              key={bar}
              className={`w-[2px] rounded-full ${isDark ? "bg-blue-300/65" : "bg-[#6258F5]/65"}`}
              animate={reduceMotion ? { height: 6 } : { height: [5, 14 - bar * 2, 5] }}
              transition={{ duration: 1.05, repeat: Infinity, delay: bar * 0.14, ease: "easeInOut" }}
            />
          ))}
        </span>

        {!reduceMotion && (
          <motion.span
            key={`progress-${language}-${activeIndex}`}
            aria-hidden="true"
            className="absolute inset-x-7 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-[#6C63FF] to-transparent"
            initial={{ scaleX: 0, opacity: 0.15 }}
            animate={{ scaleX: 1, opacity: 0.75 }}
            transition={{ duration: 3.5, ease: "linear" }}
          />
        )}

        <span
          aria-hidden="true"
          className={`absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r ${
            isDark ? "border-white/10 bg-[#101017]" : "border-zinc-200/70 bg-white"
          }`}
        />
        <motion.span
          aria-hidden="true"
          className="absolute -bottom-[17px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#6C63FF] shadow-[0_0_12px_3px_rgba(108,99,255,0.38)]"
          animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.8, 1.25, 0.8] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
