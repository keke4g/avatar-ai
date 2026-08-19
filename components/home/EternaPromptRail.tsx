"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle } from "lucide-react";

interface EternaPromptRailProps {
  isDark: boolean;
  language: "es" | "en";
}

const PROMPTS = {
  es: [
    "Busco una casa de hasta 3 millones en Guadalajara",
    "Quiero rentar un departamento en Guadalajara por 18 mil al mes",
    "Busco comprar una casa en Mazatlán por hasta 4 millones",
    "Quiero un departamento en Culiacán entre 2 y 3 millones",
    "Busco rentar una casa en Mérida por máximo 20 mil al mes",
    "Muéstrame departamentos en Monterrey de hasta 4 millones",
    "Quiero una casa de 3 recámaras en Querétaro por 3.5 millones",
    "Busco un departamento amueblado en CDMX por 25 mil al mes",
    "Quiero rentar un departamento pet friendly por 15 mil al mes",
    "Busco una casa con alberca en Mazatlán por hasta 5 millones",
    "Muéstrame casas económicas para comprar en Guadalajara",
    "Compara departamentos de 2 a 3 millones en Guadalajara",
    "Quiero una casa de 3 habitaciones por menos de 4 millones",
    "Busco rentar cerca de escuelas por máximo 22 mil al mes",
    "¿Cuánto pagaría al mes por una propiedad de 2 millones?",
    "Muéstrame propiedades con potencial de inversión",
    "Quiero vender mi departamento",
    "Llévame a publicar una propiedad",
    "Ayúdame a encontrar una propiedad cerca de hospitales",
    "Explícame qué necesito revisar antes de comprar",
  ],
  en: [
    "Find me a home under 3 million pesos in Guadalajara",
    "I want to rent an apartment in Guadalajara for 18,000 pesos a month",
    "I want to buy a home in Mazatlán for up to 4 million pesos",
    "Find me an apartment in Culiacán between 2 and 3 million pesos",
    "I want to rent a home in Mérida for up to 20,000 pesos a month",
    "Show me apartments in Monterrey under 4 million pesos",
    "I want a three-bedroom home in Querétaro for 3.5 million pesos",
    "Find me a furnished apartment in Mexico City for 25,000 pesos a month",
    "I want a pet-friendly apartment for up to 15,000 pesos a month",
    "Find me a home with a pool in Mazatlán for up to 5 million pesos",
    "Show me affordable homes to buy in Guadalajara",
    "Compare apartments from 2 to 3 million pesos in Guadalajara",
    "I want a three-bedroom home for under 4 million pesos",
    "I want to rent near schools for up to 22,000 pesos a month",
    "What would I pay monthly for a 2 million peso property?",
    "Show me properties with investment potential",
    "I want to sell my apartment",
    "Take me to publish a property",
    "Help me find a property near hospitals",
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
    }, 5500);
    return () => window.clearInterval(interval);
  }, [prompts.length]);

  return (
    <div className="home-eterna-prompt-rail relative z-20 mx-auto w-full max-w-[340px] shrink-0 px-1 sm:max-w-[520px] lg:w-[500px] lg:max-w-none xl:w-[560px]">
      <div
        role="note"
        aria-label={language === "es" ? "Ideas para hablar con Eterna" : "Ideas for talking to Eterna"}
        className={`relative flex h-[72px] w-full items-center overflow-visible rounded-[23px] border px-4 text-left backdrop-blur-2xl sm:h-16 sm:px-5 ${
            isDark
              ? "border-[#e8cf9d]/20 bg-[#0a0908]/88 text-[#f5f1e8] shadow-[0_16px_42px_rgba(0,0,0,0.38)]"
              : "border-white/95 bg-white/88 text-zinc-950 shadow-[0_14px_38px_rgba(24,24,27,0.09)] ring-1 ring-zinc-200/55"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-28 rounded-l-[23px] opacity-70 blur-2xl ${
            isDark ? "bg-[#d8b777]/[0.12]" : "bg-violet-300/25"
          }`}
        />

        <span className={`relative mr-3.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${
          isDark ? "bg-[#d8b777]/[0.12] text-[#ecd29a]" : "bg-[#6C63FF]/9 text-[#6258F5]"
        }`}>
          <MessageCircle className="h-[18px] w-[18px]" />
        </span>

        <span className="relative min-w-0 flex-1">
          <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] ${
            isDark
              ? "bg-white/[0.035] text-[#ecd29a]/65 ring-1 ring-[#e8cf9d]/[0.12]"
              : "bg-[#655BFF]/[0.06] text-[#655BFF]/60 ring-1 ring-[#655BFF]/10"
          }`}>
            {language === "es" ? "Dile a Eterna" : "Say to Eterna"}
          </span>
          <span className="relative block h-[29px] overflow-hidden">
            <AnimatePresence mode="sync" initial={false}>
              <motion.span
                key={`${language}-${activeIndex}`}
                initial={reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, filter: "blur(7px)", clipPath: "inset(100% 0 0 0)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", clipPath: "inset(0% 0 0 0)" }}
                exit={reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -14, filter: "blur(6px)", clipPath: "inset(0 0 100% 0)" }}
                transition={reduceMotion
                  ? { duration: 0.18, ease: "easeOut" }
                  : { duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-0 block whitespace-normal text-[11px] font-semibold leading-[1.25] tracking-[-0.01em] sm:text-[13px]"
              >
                “{activePrompt}”
              </motion.span>
            </AnimatePresence>

            {!reduceMotion && (
              <motion.span
                key={`glint-${language}-${activeIndex}`}
                aria-hidden="true"
                className={`pointer-events-none absolute -inset-y-1 left-0 w-14 bg-gradient-to-r from-transparent ${isDark ? "via-[#ecd29a]/30" : "via-[#8A82FF]/35"} to-transparent blur-[2px]`}
                initial={{ x: "-180%", opacity: 0 }}
                animate={{ x: "720%", opacity: [0, 0.75, 0] }}
                transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </span>
        </span>

        {!reduceMotion && (
          <motion.span
            key={`progress-${language}-${activeIndex}`}
            aria-hidden="true"
            className={`absolute inset-x-7 bottom-0 h-px origin-left bg-gradient-to-r from-transparent ${isDark ? "via-[#d8b777]" : "via-[#6C63FF]"} to-transparent`}
            initial={{ scaleX: 0, opacity: 0.15 }}
            animate={{ scaleX: 1, opacity: 0.75 }}
            transition={{ duration: 5.5, ease: "linear" }}
          />
        )}

        <span
          aria-hidden="true"
          className={`absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r ${
            isDark ? "border-[#e8cf9d]/20 bg-[#0a0908]" : "border-zinc-200/70 bg-white"
          }`}
        />
      </div>
    </div>
  );
}
