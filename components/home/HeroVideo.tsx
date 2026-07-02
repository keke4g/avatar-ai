"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AvatarState } from "../../hooks/useAvatarState";
import { useLiveContext } from "../../lib/context/LiveContext";
import { Mic } from "lucide-react";
import { DoubleBufferVideoPlayer } from "../DoubleBufferVideoPlayer";
import { AvatarStateName } from "../../lib/eternaAssets";

interface HeroVideoProps {
  avatarState: AvatarState;
}

export default function HeroVideo({ avatarState }: HeroVideoProps) {
  const { startVoice } = useLiveContext();


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

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
    addDebugLog("HeroVideo hydrated");
    console.log("[MOBILE TAP] HeroVideo hydrated");
  }, [addDebugLog]);

  const activationLockRef = useRef<boolean>(false);

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
  let frameBg = "rgba(120, 170, 255, 0.25)";
  let glowShadow = "0 0 25px rgba(120, 170, 255, 0.12)";
  let innerAnimationClass = "";

  if (avatarState === "LISTENING") {
    frameBg = "#3B82F6";
    glowShadow = "0 0 55px rgba(59, 130, 246, 0.35)";
  } else if (avatarState === "THINKING") {
    frameBg = "#8B5CF6";
    glowShadow = "0 0 55px rgba(139, 92, 246, 0.35)";
    innerAnimationClass = "animate-border-glow-pulse";
  } else if (avatarState === "TALKING") {
    frameBg = "#22C55E";
    glowShadow = "0 0 65px rgba(34, 197, 94, 0.45)";
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
      className="relative flex items-center justify-center select-none w-full max-w-[340px] sm:max-w-[360px] mx-auto rounded-[32px] p-[3px] transition-all duration-300 ease-in-out mt-2 lg:mt-4 cursor-pointer"
      style={{ 
        height: "calc(100vh - 140px)",
        maxHeight: "760px", 
        aspectRatio: "9/16",
        background: frameBg
      }}
    >
      {/* Glow Layer & Inner video wrapper */}
      <div
        className={`relative w-full h-full rounded-[29px] overflow-hidden bg-slate-950 flex items-center justify-center transition-all duration-300 ease-in-out ${innerAnimationClass}`}
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
          className="w-full h-full object-cover rounded-[28px] bg-transparent shadow-xs"
          objectPosition="center 15%"
        />
      </div>

      {/* Centered Glassmorphic Helper Tooltip */}
      {avatarState === "WAITING" && (
        <div className="absolute bottom-[35%] left-1/2 z-30 pointer-events-none select-none flex flex-col items-center animate-bounce-gentle w-full max-w-[90%]">
          {/* Elegant moving rainbow border wrapper */}
          <div className="p-[1.2px] rounded-full animate-rainbow-border shadow-floating">
            <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-1.5 md:gap-2 transition-all duration-300">
              <Mic className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-500 animate-pulse" />
              <span className="text-[10px] md:text-[11px] font-bold tracking-wide text-zinc-800 dark:text-zinc-200 text-center whitespace-nowrap">
                Haz clic para decirme qué necesitas
              </span>
            </div>
          </div>
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white/95 dark:bg-zinc-950/95 border-r border-b border-zinc-200/50 dark:border-white/10 rotate-45 -mt-1 md:-mt-1.5 shadow-xs" />
        </div>
      )}

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
        @keyframes bounce-gentle {
          0%, 100% {
            transform: translate(-50%, 0);
          }
          50% {
            transform: translate(-50%, -6px);
          }
        }
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
        .animate-border-glow-pulse {
          animation: border-glow-pulse 3s infinite ease-in-out;
        }
        .animate-border-glow-breath {
          animation: border-glow-breath 4s infinite ease-in-out;
          transition: transform 0.3s ease-in-out;
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 3s infinite ease-in-out;
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
