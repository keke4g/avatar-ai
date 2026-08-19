"use client";
import React, { useEffect, useRef, useCallback, useState } from "react";
import { AvatarState } from "../../hooks/useAvatarState";
import { useLiveContext } from "../../lib/context/LiveContext";
import { DoubleBufferVideoPlayer } from "../DoubleBufferVideoPlayer";

interface HeroVideoProps {
  avatarState: AvatarState;
  isDark?: boolean;
}

export default function HeroVideo({ avatarState, isDark = false }: HeroVideoProps) {
  const { startVoice } = useLiveContext();
  const [isInitialFrameReady, setIsInitialFrameReady] = useState(false);


  const addDebugLog = useCallback((msg: string) => {
    if (typeof window !== 'undefined') {
      if ((window as any).__eternaAddDebugLog) {
        (window as any).__eternaAddDebugLog(msg);
      } else {
        (window as any).__eternaDebugLogs = (window as any).__eternaDebugLogs || [];
        (window as any).__eternaDebugLogs.push({ time: new Date().toLocaleTimeString(), message: msg });
      }
    }
  }, []);

  useEffect(() => {
    addDebugLog("HeroVideo mounted");
    console.log("[MOBILE TAP] HeroVideo mounted");
  }, [addDebugLog]);

  useEffect(() => {
    addDebugLog("HeroVideo hydrated");
    console.log("[MOBILE TAP] HeroVideo hydrated");
  }, [addDebugLog]);

  const activationLockRef = useRef<boolean>(false);
  const revealInitialFrame = useCallback(() => {
    setIsInitialFrameReady(true);
  }, []);

  const activateConversation = useCallback((sourceEvent: string) => {
    if (activationLockRef.current) return;
    activationLockRef.current = true;
    setTimeout(() => {
      activationLockRef.current = false;
    }, 300);

    console.log(`[ACTIVATE] activateConversation() via ${sourceEvent}`);
    addDebugLog(`[ACTIVATE] activateConversation() via ${sourceEvent}`);

    console.log("[ACTIVATE] calling window.__eternaStartVoice");
    addDebugLog("[ACTIVATE] calling window.__eternaStartVoice");

    if (typeof window !== 'undefined' && (window as any).__eternaStartVoice) {
      (window as any).__eternaStartVoice();
    } else {
      startVoice();
    }

    console.log("[ACTIVATE] finished");
    addDebugLog("[ACTIVATE] finished");
  }, [startVoice, addDebugLog]);

  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchCancelledRef = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchCancelledRef.current = false;
    addDebugLog("TouchStart: saved initial X,Y");
  }, [addDebugLog]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || touchCancelledRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 12) {
      touchCancelledRef.current = true;
      addDebugLog(`TouchMove: gesture cancelled (moved ${distance.toFixed(1)}px > 12px)`);
    }
  }, [addDebugLog]);

  const handleTouchEnd = useCallback((e: React.TouchEvent, source: string) => {
    if (!touchStartPosRef.current) return;
    touchStartPosRef.current = null;
    
    if (touchCancelledRef.current) {
      addDebugLog("TouchEnd: ignored (scroll or drag detected)");
      return;
    }

    addDebugLog(`TouchEnd: confirmed TAP via ${source}`);
    e.stopPropagation();
    activateConversation(`TAP (${source})`);
  }, [activateConversation, addDebugLog]);


  // Border & Glow configuration based on avatarState
  let frameBg = isDark ? "rgba(216, 183, 119, 0.42)" : "rgba(120, 170, 255, 0.25)";
  let glowShadow = isDark ? "0 0 32px rgba(216, 183, 119, 0.18)" : "0 0 25px rgba(120, 170, 255, 0.12)";
  let innerAnimationClass = "";

  if (avatarState === "LISTENING") {
    frameBg = isDark ? "#2d9ac6" : "#3B82F6";
    glowShadow = isDark ? "0 0 55px rgba(45, 154, 198, 0.32)" : "0 0 55px rgba(59, 130, 246, 0.35)";
  } else if (avatarState === "THINKING") {
    frameBg = isDark ? "#caa96b" : "#8B5CF6";
    glowShadow = isDark ? "0 0 55px rgba(202, 169, 107, 0.3)" : "0 0 55px rgba(139, 92, 246, 0.35)";
    innerAnimationClass = "animate-border-glow-pulse";
  } else if (avatarState === "TALKING") {
    frameBg = isDark ? "#53a477" : "#22C55E";
    glowShadow = isDark ? "0 0 65px rgba(83, 164, 119, 0.4)" : "0 0 65px rgba(34, 197, 94, 0.45)";
    innerAnimationClass = "animate-border-glow-breath";
  }

  return (
    <div 
      onClick={() => {
        addDebugLog("Click fired (Outer)");
        console.log("[MOBILE TAP] HeroVideo onClick");
        activateConversation("Click (Outer)");
      }}
      onPointerDown={(e) => {
        addDebugLog(`PointerDown fired (Outer). pointerType: ${(e.nativeEvent as any).pointerType || 'n/a'}`);
        console.log("[MOBILE TAP] HeroVideo onPointerDown");
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => handleTouchEnd(e, "Outer")}
      className={`home-hero-video ${isDark ? "home-hero-video-dark" : ""} relative flex items-center justify-center select-none w-full max-w-[340px] sm:max-w-[360px] mx-auto rounded-[32px] p-[3px] transition-all duration-300 ease-in-out mt-2 lg:mt-1 cursor-pointer`}
      style={{
        height: "min(calc(var(--useful-height, 760px) - var(--home-hero-height-offset, 20px)), 760px)",
        aspectRatio: "9/16",
        background: frameBg
      }}
    >
      {/* Glow Layer & Inner video wrapper */}
      <div
        className={`home-hero-video-inner relative w-full h-full rounded-[29px] overflow-hidden bg-slate-950 flex items-center justify-center transition-all duration-300 ease-in-out ${innerAnimationClass}`}
        style={{
          boxShadow: glowShadow
        }}
      >
        {/* Transparent click/tap interceptor overlay to bypass mobile browser native media player click capture */}
        <div 
          onClick={(e) => {
            console.log("[MOBILE TAP] HeroVideo onClick (Overlay) fired");
            console.log("[MOBILE TAP] event.target:", e.target);
            console.log("[MOBILE TAP] event.currentTarget:", e.currentTarget);
            
            const pType = (e.nativeEvent as any).pointerType || 'n/a';
            const targetTag = e.target ? (e.target as HTMLElement).tagName + '.' + (e.target as HTMLElement).className.split(' ').join('.') : 'n/a';
            const currentTargetTag = e.currentTarget ? (e.currentTarget as HTMLElement).tagName + '.' + (e.currentTarget as HTMLElement).className.split(' ').join('.') : 'n/a';
            let elFromPoint = 'n/a';
            if (e.clientX && e.clientY) {
              const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
              elFromPoint = elementAtPoint ? elementAtPoint.tagName + '.' + elementAtPoint.className.split(' ').join('.') : 'null';
              console.log("[MOBILE TAP] elementFromPoint at (" + e.clientX + ", " + e.clientY + "):", elementAtPoint);
            }
            console.log("[MOBILE TAP] window.__eternaStartVoice exists:", typeof (window as any).__eternaStartVoice === 'function');
            
            addDebugLog(`Overlay clicked! type: ${e.type}, pointerType: ${pType}, target: ${targetTag}, currentTarget: ${currentTargetTag}, X/Y: (${e.clientX}, ${e.clientY}), elementFromPoint: ${elFromPoint}`);
            addDebugLog(`window.__eternaStartVoice exists: ${typeof (window as any).__eternaStartVoice === 'function'}`);

            e.stopPropagation();
            activateConversation("Click (Overlay)");
          }}
          onPointerDown={(e) => {
            const pType = (e.nativeEvent as any).pointerType || 'n/a';
            addDebugLog(`PointerDown fired (Overlay). pointerType: ${pType}`);
            console.log("[MOBILE TAP] HeroVideo onPointerDown (Overlay)");
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            addDebugLog("TouchStart fired (Overlay)");
            console.log("[MOBILE TAP] HeroVideo onTouchStart (Overlay)");
            e.stopPropagation();
            handleTouchStart(e);
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            handleTouchMove(e);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTouchEnd(e, "Overlay");
          }}
          className="absolute inset-0 z-20 cursor-pointer bg-transparent"
        />

        {/* Main Double Buffered Video Element */}
        <DoubleBufferVideoPlayer
          state={avatarState === "WAITING" ? "IDLE" : avatarState}
          loop={true}
          onInitialFrameReady={revealInitialFrame}
          className="w-full h-full object-cover rounded-[28px] bg-transparent shadow-xs"
          objectPosition="center 15%"
        />

        {/*
          This cover is server-rendered and weighs no extra image bytes. It
          hides the native mobile video placeholder until the browser has
          painted Eterna's first decoded frame, without blocking video, voice,
          or the transparent activation layer above it.
        */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 z-[15] overflow-hidden rounded-[28px] ${isDark ? "bg-[#080706]" : "bg-[#080b10]"} transition-[opacity,visibility] duration-500 ease-out ${
            isInitialFrameReady ? "invisible opacity-0" : "visible opacity-100"
          }`}
        >
          <div className={`absolute inset-0 ${isDark ? "bg-[radial-gradient(circle_at_50%_34%,rgba(216,183,119,0.18),transparent_24%),radial-gradient(circle_at_74%_78%,rgba(45,154,198,0.09),transparent_34%),linear-gradient(155deg,#18140e_0%,#080706_52%,#050504_100%)]" : "bg-[radial-gradient(circle_at_50%_34%,rgba(30,154,207,0.20),transparent_24%),radial-gradient(circle_at_74%_78%,rgba(99,102,241,0.12),transparent_34%),linear-gradient(155deg,#111721_0%,#080b10_52%,#050608_100%)]"}`} />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
          <div className="absolute -left-20 top-[22%] h-56 w-56 rounded-full border border-sky-300/10" />
          <div className="absolute -right-24 top-[8%] h-72 w-72 rounded-full border border-white/[0.06]" />

          <div className="relative flex h-full flex-col px-7 pb-24 pt-8 sm:px-9 sm:pt-10">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.28em] ${isDark ? "text-[#ecd29a]/80" : "text-sky-300/70"}`}>Towers México</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-white/30">Concierge inmobiliaria</p>
              </div>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <div className="relative flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
                <div className="absolute inset-0 animate-[eterna-orbit_8s_linear_infinite] rounded-full border border-white/[0.08] motion-reduce:animate-none">
                  <span className="absolute left-1/2 top-[-3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
                </div>
                <div className={`absolute inset-4 animate-[eterna-orbit_12s_linear_infinite_reverse] rounded-full border ${isDark ? "border-[#ecd29a]/15" : "border-sky-300/15"} motion-reduce:animate-none`}>
                  <span className={`absolute bottom-[11px] right-[8px] h-1 w-1 rounded-full ${isDark ? "bg-[#ecd29a] shadow-[0_0_14px_rgba(236,210,154,0.72)]" : "bg-indigo-300 shadow-[0_0_14px_rgba(165,180,252,0.9)]"}`} />
                </div>
                <div className="absolute inset-9 rounded-full border border-white/10 bg-white/[0.035] shadow-[inset_0_0_36px_rgba(56,189,248,0.08),0_0_48px_rgba(14,165,233,0.08)] backdrop-blur-sm" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-[17px] border border-white/10 bg-white/[0.07] shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                  <span className={`h-2.5 w-2.5 rotate-45 rounded-[3px] ${isDark ? "bg-gradient-to-br from-white via-[#ecd29a] to-[#a77d36] shadow-[0_0_20px_rgba(236,210,154,0.42)]" : "bg-gradient-to-br from-white via-cyan-200 to-sky-500 shadow-[0_0_20px_rgba(103,232,249,0.55)]"}`} />
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[230px] text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white">Eterna</p>
              <p className="mt-2 text-[9px] font-semibold tracking-[0.08em] text-white/42">Preparando tu experiencia</p>
              <div className="mt-4 h-px overflow-hidden bg-white/10">
                <span className={`block h-full w-1/2 animate-[eterna-line_1.35s_ease-in-out_infinite] bg-gradient-to-r from-transparent ${isDark ? "via-[#ecd29a]" : "via-cyan-300"} to-transparent motion-reduce:animate-none`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Styles for dynamic thinking/talking border animations */}
      <style jsx global>{`
        @keyframes border-glow-pulse {
          0%, 100% {
            box-shadow: 0 0 35px rgba(139, 92, 246, 0.35);
          }
          50% {
            box-shadow: 0 0 55px rgba(139, 92, 246, 0.65);
          }
        }
        @keyframes border-glow-breath {
          0%, 100% {
            box-shadow: 0 0 45px rgba(34, 197, 94, 0.35);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 65px rgba(34, 197, 94, 0.65);
            transform: scale(1.006);
          }
        }
        @keyframes eterna-orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes eterna-line {
          0% { transform: translateX(-110%); opacity: 0.35; }
          50% { opacity: 1; }
          100% { transform: translateX(220%); opacity: 0.35; }
        }
        .animate-border-glow-pulse {
          animation: border-glow-pulse 3s infinite ease-in-out;
        }
        .animate-border-glow-breath {
          animation: border-glow-breath 4s infinite ease-in-out;
          transition: transform 0.3s ease-in-out;
        }
        .home-hero-video-dark .animate-border-glow-pulse {
          animation-name: border-glow-pulse-dark;
        }
        .home-hero-video-dark .animate-border-glow-breath {
          animation-name: border-glow-breath-dark;
        }
        @keyframes border-glow-pulse-dark {
          0%, 100% {
            box-shadow: 0 0 35px rgba(202, 169, 107, 0.3);
          }
          50% {
            box-shadow: 0 0 55px rgba(202, 169, 107, 0.58);
          }
        }
        @keyframes border-glow-breath-dark {
          0%, 100% {
            box-shadow: 0 0 45px rgba(83, 164, 119, 0.32);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 65px rgba(83, 164, 119, 0.55);
            transform: scale(1.006);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-border-glow-pulse,
          .animate-border-glow-breath,
          .home-hero-video [class*="animate-[eterna-"] {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
