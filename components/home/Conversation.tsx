"use client";
import React, { useEffect, useRef } from "react";
import { useLiveContext } from "../../lib/context/LiveContext";
import { motion } from "framer-motion";
import HeroSearch from "./HeroSearch";

interface ConversationProps {
  searchInput: string;
  setSearchInput: (val: string) => void;
  isDark: boolean;
}

export default function Conversation({ searchInput, setSearchInput, isDark }: ConversationProps) {
  const { eternaChatState } = useLiveContext();
  const { chatHistory } = eternaChatState;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatHistory]);

  const hasHistory = chatHistory && chatHistory.length > 0;
  
  // Height dynamic configuration based on empty vs active state
  const heightStyle = hasHistory ? "calc(var(--useful-height, 860px) - 60px)" : "420px";
  const maxHeightStyle = hasHistory ? "660px" : "420px";

  return (
    <div className="w-full select-none flex flex-col items-center lg:items-start lg:w-[440px]">
      <h3 className={`text-[10px] font-bold tracking-[0.2em] uppercase mt-2 lg:mt-4 mb-5 w-full text-center lg:text-left h-4 flex items-center transition-colors duration-300 ${
        isDark ? "text-white/40" : "text-zinc-500/80"
      }`}>
        Conversación
      </h3>
      
      <div 
        className={`w-full backdrop-blur-md rounded-[32px] p-6 flex flex-col transition-all duration-[450ms] ease-out overflow-hidden border transition-colors ${
          isDark
            ? "bg-[#0c0c12]/60 border-white/5 shadow-2xl"
            : "bg-white/80 border-zinc-200/80 shadow-premium"
        }`}
        style={{
          height: heightStyle,
          maxHeight: maxHeightStyle,
        }}
      >
        {/* Cabecera Eterna */}
        <div className="flex flex-col items-center lg:items-start w-full select-none flex-shrink-0">
          <h2
            className={`text-2xl font-extrabold tracking-[0.3em] mt-1 select-none transition-colors duration-300 ${
              isDark ? "text-white/95" : "text-zinc-900"
            }`}
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            ETERNA
          </h2>
          <p className={`text-xs tracking-wider mt-2 leading-relaxed text-center lg:text-left transition-colors duration-300 ${
            isDark ? "text-white/40" : "text-zinc-500"
          }`}>
            Tu asesora inmobiliaria impulsada por IA.
          </p>
        </div>

        {/* Divisor 1 */}
        <div className={`w-full h-px my-5 flex-shrink-0 transition-colors duration-300 ${
          isDark ? "bg-white/5" : "bg-zinc-200"
        }`} />

        {/* Buscador */}
        <div className="w-full flex-shrink-0">
          <HeroSearch inputValue={searchInput} setInputValue={setSearchInput} isDark={isDark} />
        </div>

        {/* Divisor 2 */}
        <div className={`w-full h-px my-5 flex-shrink-0 transition-colors duration-300 ${
          isDark ? "bg-white/5" : "bg-zinc-200"
        }`} />

        {/* Historial de conversación o mensaje de bienvenida */}
        <div ref={scrollContainerRef} className="flex-grow flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin select-text">
          {hasHistory ? (
            chatHistory.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[90%] text-xs sm:text-sm leading-relaxed px-4 py-2.5 rounded-[20px] transition-colors duration-300 ${
                      isUser
                        ? isDark
                          ? "bg-white/[0.04] text-white/90 border border-white/5 rounded-tr-none"
                          : "bg-zinc-100 text-zinc-800 border border-zinc-200/50 rounded-tr-none"
                        : isDark
                        ? "text-white/70 rounded-tl-none font-light"
                        : "text-zinc-600 rounded-tl-none font-medium"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-4 select-none">
              <p className={`text-sm font-medium tracking-wide mb-1 select-none transition-colors duration-300 ${
                isDark ? "text-white/70" : "text-zinc-700"
              }`}>
                Bienvenido al Chat de Eterna
              </p>
              <p className={`text-xs tracking-wider max-w-[240px] leading-relaxed select-none transition-colors duration-300 ${
                isDark ? "text-white/20" : "text-zinc-400/80"
              }`}>
                El historial de conversación y los resultados aparecerán aquí cuando comiences a interactuar.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
