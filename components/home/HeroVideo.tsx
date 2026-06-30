"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AvatarState } from "../../hooks/useAvatarState";
import { useLiveContext } from "../../lib/context/LiveContext";
import { Mic } from "lucide-react";

interface HeroVideoProps {
  avatarState: AvatarState;
}

const TALKING_VIDEOS = [
  "/videos/hablando.mp4",
  "/videos/caminando y hablando.mp4",
  "/videos/caminando y hablando2.mp4",
  "/videos/caminando y hablando3.mp4",
  "/videos/caminando y hablando4.mp4",
];

const ALL_VIDEOS = [
  "/videos/tranquila.mp4",
  "/videos/idle.mp4",
  ...TALKING_VIDEOS,
];

export default function HeroVideo({ avatarState }: HeroVideoProps) {
  const { startVoice } = useLiveContext();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState("/videos/tranquila.mp4");
  const [opacity, setOpacity] = useState(1);
  const lastTalkingVideoRef = useRef<string>("");

  const getRandomTalkingVideo = useCallback(() => {
    const filtered = TALKING_VIDEOS.filter(v => v !== lastTalkingVideoRef.current);
    const selected = filtered[Math.floor(Math.random() * filtered.length)];
    lastTalkingVideoRef.current = selected;
    return selected;
  }, []);

  // Determine target video source
  const getTargetSrc = useCallback(() => {
    if (avatarState === "LISTENING" || avatarState === "THINKING") {
      return "/videos/idle.mp4";
    }
    if (avatarState === "TALKING") {
      if (TALKING_VIDEOS.includes(currentSrc)) {
        return currentSrc;
      }
      return getRandomTalkingVideo();
    }
    return "/videos/tranquila.mp4";
  }, [avatarState, currentSrc, getRandomTalkingVideo]);

  // Handle source changes with crossfade
  useEffect(() => {
    const target = getTargetSrc();
    if (target !== currentSrc) {
      setOpacity(0);
      
      const timer = setTimeout(() => {
        setCurrentSrc(target);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [avatarState, getTargetSrc, currentSrc]);

  // Load and play when source changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.warn("[HeroVideo] Play interrupted or blocked:", err);
      });
    }
  }, [currentSrc]);

  const handleCanPlay = () => {
    setOpacity(1);
  };

  const handleVideoEnded = () => {
    if (avatarState === "TALKING") {
      const nextVideo = getRandomTalkingVideo();
      setOpacity(0);
      setTimeout(() => {
        setCurrentSrc(nextVideo);
      }, 150);
    } else {
      setOpacity(0);
      setTimeout(() => {
        setCurrentSrc("/videos/tranquila.mp4");
      }, 150);
    }
  };

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
      onClick={startVoice}
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
        {/* Main Video Element */}
        <video
          ref={videoRef}
          src={currentSrc}
          onCanPlay={handleCanPlay}
          onEnded={handleVideoEnded}
          muted
          playsInline
          autoPlay
          loop={avatarState !== "TALKING"}
          className="w-full h-full object-cover rounded-[28px] bg-transparent shadow-xs transition-opacity duration-200"
          style={{ 
            opacity,
            objectPosition: "center 15%"
          }}
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

      {/* Invisible Preloader Elements to cache all videos */}
      <div className="hidden" aria-hidden="true">
        {ALL_VIDEOS.map((src) => (
          <video
            key={src}
            src={src}
            preload="auto"
            muted
            playsInline
          />
        ))}
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
