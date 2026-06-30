"use client";
import React, { useState, useEffect } from "react";
import Navbar from "../Navbar";
import HomeHero from "./HomeHero";
import Conversation from "./Conversation";
import { useLayoutContext } from "../../lib/context/LayoutContext";
import { useLiveContext } from "../../lib/context/LiveContext";
import { Home, Search, Building2, Landmark, Globe, MessageSquare, Sun, Moon } from "lucide-react";

export default function HomeExperience() {
  const { setHideHeader, setHideFooter } = useLayoutContext();
  const { sendPrompt } = useLiveContext();
  const [searchInput, setSearchInput] = useState("");
  const [navbarHeight, setNavbarHeight] = useState(80);
  const [isDark, setIsDark] = useState(false);
  const [highlightActions, setHighlightActions] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent;
      setHighlightActions(!!customEvent.detail);
    };

    window.addEventListener('eterna-highlight-actions', handleHighlight);
    return () => {
      window.removeEventListener('eterna-highlight-actions', handleHighlight);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("home_theme");
      setTimeout(() => {
        setIsDark(stored === "dark");
      }, 0);
    }
  }, []);

  // Force scroll viewport to top on load and mount to prevent viewport jumps on home page loading
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      const timer = setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof window !== "undefined") {
      localStorage.setItem("home_theme", nextDark ? "dark" : "light");
      window.dispatchEvent(new CustomEvent("home-theme-change", { detail: nextDark ? "dark" : "light" }));
    }
  };

  useEffect(() => {
    setHideHeader(true);
    setHideFooter(true);
    return () => {
      setHideHeader(false);
      setHideFooter(false);
    };
  }, [setHideHeader, setHideFooter]);

  useEffect(() => {
    const updateNavbarHeight = () => {
      const navbarElement = document.querySelector("header");
      if (navbarElement) {
        const rect = navbarElement.getBoundingClientRect();
        if (rect.bottom > 0) {
          setNavbarHeight(rect.bottom);
        }
      }
    };

    updateNavbarHeight();

    // ResizeObserver for changes inside the header
    let resizeObserver: ResizeObserver | null = null;
    const navbarElement = document.querySelector("header");
    if (navbarElement && typeof window !== "undefined" && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateNavbarHeight();
      });
      resizeObserver.observe(navbarElement);
    }

    // MutationObserver to watch if header is added/rendered
    let mutationObserver: MutationObserver | null = null;
    if (typeof window !== "undefined" && window.MutationObserver) {
      mutationObserver = new MutationObserver(() => {
        updateNavbarHeight();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("resize", updateNavbarHeight);
    const timer = setTimeout(updateNavbarHeight, 150);

    return () => {
      window.removeEventListener("resize", updateNavbarHeight);
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    };
  }, []);

  const actions = [
    { icon: Home, text: "Quiero vender mi casa", sub: "Obtén una valoración con IA" },
    { icon: Search, text: "Busco una propiedad", sub: "Encuentra tu hogar ideal" },
    { icon: Building2, text: "Quiero invertir", sub: "Maximiza tus rendimientos" },
    { icon: Landmark, text: "Valorar mi propiedad", sub: "Estima su valor de mercado" },
    { icon: Globe, text: "Buscar propiedades internacionales", sub: "Explora opciones globales" },
    { icon: MessageSquare, text: "Hablar con Eterna", sub: "Resuelve tus dudas en tiempo real" },
  ];

  const handleCardClick = (text: string) => {
    sendPrompt(text);
  };

  return (
    <div 
      className={`relative w-full min-h-screen flex flex-col justify-start overflow-x-hidden pb-6 transition-colors duration-300 ${
        isDark ? "bg-[#030303] text-white" : "bg-[#fafafa] text-[#18181b]"
      }`}
      style={{
        "--navbar-height": `${navbarHeight}px`,
        "--useful-height": `calc(100vh - ${navbarHeight}px - 48px)`,
      } as React.CSSProperties}
    >
      {/* Radial dark/light premium background */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-500" 
        style={{
          background: isDark
            ? "radial-gradient(circle at center, #0f0f15 0%, #030303 100%)"
            : "radial-gradient(circle at top, #ffffff 0%, #f4f4f7 100%)",
        }}
      />

      {/* Floating Theme Switcher Button */}
      <button
        onClick={toggleTheme}
        className={`absolute top-24 right-6 lg:right-12 z-40 p-2.5 rounded-full border transition-all duration-300 shadow-premium cursor-pointer ${
          isDark
            ? "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
            : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300"
        }`}
        title={isDark ? "Modo Claro" : "Modo Oscuro"}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Discreet Navbar Wrapper */}
      <div className="w-full z-50">
        <Navbar />
      </div>

      {/* Main 3-Column Layout Grid */}
      <div 
        className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 flex-1 flex flex-col lg:grid lg:grid-cols-[280px_1fr_360px] xl:grid-cols-[280px_1fr_440px] lg:gap-12 xl:gap-24 lg:items-start select-none"
        style={{
          marginTop: "calc(var(--navbar-height) + 12px)",
        }}
      >
        
        {/* Left Column: Acciones recomendadas */}
        <div className="w-full max-w-[340px] mx-auto lg:max-w-none order-2 lg:order-1 mt-10 lg:mt-0 flex flex-col items-center lg:items-start self-start">
          <h3 className={`text-[10px] font-bold tracking-[0.2em] uppercase mt-2 lg:mt-4 mb-5 select-none w-full text-center lg:text-left h-4 flex items-center transition-colors duration-300 ${
            isDark ? "text-white/40" : "text-zinc-500/80"
          }`}>
            Acciones recomendadas
          </h3>
          <div className={`p-[1.2px] rounded-[20px] transition-all duration-500 w-full ${
            highlightActions ? 'animate-rainbow-border shadow-[0_0_25px_rgba(59,130,246,0.15)] scale-[1.015]' : 'bg-transparent'
          }`}>
            <div className={`flex flex-col gap-4 w-full rounded-[19px] p-1.5 transition-colors duration-500 ${
              highlightActions 
                ? (isDark ? 'bg-zinc-950/90' : 'bg-white/95') 
                : 'bg-transparent'
            }`}>
              {actions.map((act, index) => {
                const IconComp = act.icon;
                return (
                  <div
                    key={index}
                    onClick={() => handleCardClick(act.text)}
                    className={`group relative w-full rounded-2xl p-3 transition-all duration-250 cursor-pointer flex items-center gap-4 hover:-translate-y-[3px] transition-all duration-300 ${
                      isDark
                        ? "bg-white/[0.02] border border-white/5 hover:border-blue-500/15 hover:bg-white/[0.05] hover:shadow-[0_0_15px_rgba(59,130,246,0.04)]"
                        : "bg-white border border-zinc-200/80 hover:border-blue-500/35 hover:bg-zinc-50/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                    }`}
                  >
                    <IconComp className={`w-4 h-4 transition-colors shrink-0 ${
                      isDark ? "text-white/50 group-hover:text-blue-400" : "text-zinc-400 group-hover:text-blue-500"
                    }`} />
                    <div className="flex flex-col text-left">
                      <span className={`text-xs sm:text-sm transition-colors font-medium tracking-wide ${
                        isDark ? "text-white/70 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-950"
                      }`}>
                        {act.text}
                      </span>
                      <span className={`text-[10px] transition-colors font-light mt-0.5 ${
                        isDark ? "text-white/30 group-hover:text-white/40" : "text-zinc-400 group-hover:text-zinc-500"
                      }`}>
                        {act.sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Column: Video only */}
        <div className="w-full order-1 lg:order-2 flex flex-col items-center justify-center flex-shrink-0">
          <HomeHero />
        </div>

        {/* Right Column: Conversación log (containing headers and buscador) */}
        <div className="w-full max-w-[340px] lg:max-w-[360px] xl:max-w-[440px] mx-auto lg:mx-0 order-3 lg:order-3 mt-10 lg:mt-0 self-start">
          <Conversation searchInput={searchInput} setSearchInput={setSearchInput} isDark={isDark} />
        </div>

      </div>

      {/* Styles for dynamic rainbow border animation on highlight */}
      <style jsx global>{`
        @keyframes rainbow-border {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-rainbow-border {
          background: linear-gradient(
            270deg,
            #ff5e62,
            #ff9966,
            #ffdb58,
            #66ff99,
            #33ccff,
            #9966ff,
            #ff5e62
          );
          background-size: 300% 300%;
          animation: rainbow-border 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
