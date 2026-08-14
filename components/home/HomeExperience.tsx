"use client";
import React, { useState, useEffect } from "react";
import Navbar from "../Navbar";
import HomeHero from "./HomeHero";
import EternaPromptRail from "./EternaPromptRail";
import HomeMarketRadar from "./HomeMarketRadar";
import HomeSearchBrief from "./HomeSearchBrief";
import { useLayoutContext } from "../../lib/context/LayoutContext";
import { useTranslation } from "../../lib/context/LanguageContext";
import { Sun, Moon } from "lucide-react";

export default function HomeExperience() {
  const { setHideHeader, setHideFooter } = useLayoutContext();
  const { language } = useTranslation();
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

  return (
    <div 
      className={`home-experience-shell relative w-full min-h-dvh lg:fixed lg:inset-0 lg:h-dvh flex flex-col justify-start overflow-x-hidden lg:overflow-hidden pb-6 lg:pb-0 transition-colors duration-300 ${
        isDark ? "bg-[#030303] text-white" : "bg-[#fafafa] text-[#18181b]"
      }`}
      style={{
        "--navbar-height": `${navbarHeight}px`,
        "--home-shell-height": `calc(100dvh - ${navbarHeight}px - 50px)`,
        "--useful-height": "calc(var(--home-shell-height) - 72px)",
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
        type="button"
        onClick={toggleTheme}
        className={`absolute top-24 right-6 z-40 hidden rounded-full border p-2.5 shadow-premium transition-all duration-300 xl:right-12 xl:flex ${
          isDark
            ? "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
            : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300"
        }`}
        aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
        title={isDark ? "Modo Claro" : "Modo Oscuro"}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Discreet Navbar Wrapper */}
      <div className="w-full z-50">
        <Navbar />
      </div>

      <main
        className="home-experience-main relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 sm:px-6 lg:h-[var(--home-shell-height)] lg:min-h-0 lg:flex-none lg:overflow-hidden lg:px-10 xl:px-12"
        style={{
          marginTop: "calc(var(--navbar-height) + 22px)",
        }}
      >
        {/* Main 3-Column Layout Grid */}
        <div className="flex w-full flex-1 flex-col select-none lg:min-h-0 lg:grid lg:grid-cols-[minmax(225px,270px)_minmax(300px,1fr)_minmax(330px,390px)] lg:items-stretch lg:gap-7 xl:grid-cols-[280px_minmax(320px,1fr)_400px] xl:gap-10">
        
        {/* Left Column: live market radar */}
        <div className="home-side-column order-2 mx-auto mt-10 flex w-full max-w-[340px] flex-col items-center self-start lg:order-1 lg:mt-0 lg:h-full lg:max-w-none lg:min-h-0 lg:items-start lg:pt-[88px]">
          <HomeMarketRadar
            isDark={isDark}
            language={language}
            highlighted={highlightActions}
          />
        </div>

        {/* Center Column: Eterna prompt guide + avatar */}
        <div className="order-1 flex w-full flex-shrink-0 flex-col items-center justify-start gap-5 lg:order-2 lg:h-full lg:min-h-0 lg:gap-6">
          <EternaPromptRail isDark={isDark} language={language} />
          <HomeHero />
        </div>

        {/* Right Column: live search brief, with conversation as a secondary layer */}
        <div className="home-side-column order-3 mx-auto mt-10 w-full max-w-[340px] self-start lg:order-3 lg:mx-0 lg:mt-0 lg:h-full lg:max-w-none lg:min-h-0 lg:pt-[88px]">
          <HomeSearchBrief
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            isDark={isDark}
            language={language}
          />
        </div>

        </div>
      </main>

      <style jsx global>{`
        @media (min-width: 1024px) and (max-height: 820px) {
          .home-side-column {
            padding-top: 76px !important;
          }

          .home-market-radar-heading,
          .home-search-brief-heading {
            margin-bottom: 8px !important;
          }

          .home-market-radar-list {
            gap: 6px !important;
          }

          .home-radar-image {
            height: 62px !important;
          }

          .home-radar-content {
            padding: 6px 10px !important;
          }

          .home-radar-title {
            font-size: 10px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .home-radar-caption {
            margin-top: 2px !important;
            font-size: 7.5px !important;
          }

          .home-radar-price-row {
            margin-top: 4px !important;
          }

          .home-radar-insight {
            display: none !important;
          }

          .home-search-brief-box {
            padding: 14px !important;
          }

          .home-search-brief-title {
            font-size: 17px !important;
          }

          .home-brief-status {
            margin-top: 9px !important;
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }

          .home-brief-criteria {
            margin-top: 9px !important;
            gap: 5px !important;
          }

          .home-brief-criterion,
          .home-brief-budget {
            padding: 7px 10px !important;
          }

          .home-brief-budget {
            margin-top: 5px !important;
          }

          .home-brief-matches {
            margin-top: 9px !important;
          }

          .home-brief-match-list {
            margin-top: 5px !important;
          }

          .home-brief-secondary-match {
            display: none !important;
          }

          .home-brief-actions {
            margin-top: 8px !important;
            gap: 6px !important;
          }

          .home-brief-explore {
            height: 36px !important;
          }

          .home-brief-composer input {
            height: 38px !important;
          }
        }
      `}</style>

    </div>
  );
}
