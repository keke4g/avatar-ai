"use client";
import React, { useEffect, useRef } from "react";
import { StreamStatus } from "../hooks/useWebSocketStream";
import { ETERNA_ASSETS } from "../lib/eternaAssets";

interface VideoAvatarProps {
  status: StreamStatus;
  size?: number;
  hidePill?: boolean;
  hideGlow?: boolean;
  isListening?: boolean;
}

export function VideoAvatar({ 
  status, 
  size = 430, 
  hidePill = false, 
  hideGlow = false,
  isListening = false
}: VideoAvatarProps) {
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);

  // Ensure both videos are playing on mount
  useEffect(() => {
    const playVideo = (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.play().catch((err) => {
        console.warn("[VideoAvatar] Autoplay blocked, will retry on interaction:", err);
      });
    };

    playVideo(idleVideoRef.current);
    playVideo(talkingVideoRef.current);
  }, []);

  // Manage play state on status changes to ensure seamless transitions
  useEffect(() => {
    const idleVideo = idleVideoRef.current;
    const talkingVideo = talkingVideoRef.current;

    if (status === "talking") {
      if (talkingVideo && talkingVideo.paused) {
        talkingVideo.play().catch(() => {});
      }
    } else {
      if (idleVideo && idleVideo.paused) {
        idleVideo.play().catch(() => {});
      }
    }
  }, [status]);

  const isTalking = status === "talking";

  // Determine state-aware glow and rotation animations
  let glowAnimation = "pulse-idle 5s infinite ease-in-out";
  let glowOpacity = 0.7;
  let ringAnimation = "spin-glow 30s infinite linear";
  let ringScale = 1.0;

  if (isListening) {
    // LISTENING STATE (Voice Dictation Active)
    glowAnimation = "pulse-listening 1.5s infinite ease-in-out";
    glowOpacity = 0.9;
    ringAnimation = "spin-glow 15s infinite linear";
    ringScale = 1.02;
  } else if (status === "thinking") {
    // THINKING STATE
    glowAnimation = "pulse-thinking 2s infinite ease-in-out";
    glowOpacity = 0.95;
    ringAnimation = "spin-glow 8s infinite linear";
    ringScale = 1.01;
  } else if (status === "talking") {
    // SPEAKING STATE
    glowAnimation = "pulse-speaking 1s infinite ease-in-out"; // Sonic wave expansion
    glowOpacity = 0.95;
    ringAnimation = "spin-glow 20s infinite linear";
    ringScale = 1.03;
  }

  return (
    <div 
      className="relative z-10 select-none flex items-center justify-center VideoAvatar-root"
      style={{ width: size, height: size }}
    >
      {/* 1. Dynamic Outer Aurora Halo Glow (Blurred backdrop layer) */}
      {!hideGlow && (
        <div
          className="absolute rounded-full pointer-events-none transition-all duration-700 blur-[28px] VideoAvatar-glow"
          style={{
            inset: -size * 0.13,
            background: "radial-gradient(circle, rgba(255,255,255,0.78) 0%, rgba(196,188,246,0.16) 38%, rgba(176,218,228,0.08) 66%, transparent 96%)",
            animation: glowAnimation,
            opacity: `calc(${glowOpacity * 0.82} * var(--glow-multiplier, 1))` as any,
          }}
        />
      )}

      {/* 2. Main Glowing Rotating Gradient Outer Ring (Halo border container) */}
      <div 
        className="absolute inset-0 rounded-full transition-transform duration-500 VideoAvatar-ring"
        style={{
          background: "conic-gradient(from 25deg, rgba(255,255,255,0.96), rgba(154,146,232,0.48), rgba(171,218,226,0.34), rgba(255,255,255,0.92), rgba(186,168,235,0.34), rgba(255,255,255,0.96))",
          animation: ringAnimation,
          transform: `scale(${ringScale})`,
          opacity: "calc(0.82 * var(--glow-multiplier, 1))" as any,
        }}
      />

      {/* 3. Inner Mask core containing Eterna's real face and glass dome overlay */}
      <div 
        className="absolute inset-[4px] rounded-full overflow-hidden bg-slate-950 flex items-center justify-center VideoAvatar-core"
      >
        {/* Idle Video Layer — always present, visible when NOT talking */}
        <video
          ref={idleVideoRef}
          src={ETERNA_ASSETS.avatar.idleVideo}
          loop
          muted
          playsInline
          autoPlay
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: isTalking ? 0 : 1, zIndex: 10 }}
        />

        {/* Talking Video Layer — always present, visible when talking */}
        <video
          ref={talkingVideoRef}
          src={ETERNA_ASSETS.avatar.talkingVideo}
          loop
          muted
          playsInline
          autoPlay
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: isTalking ? 1 : 0, zIndex: 11 }}
        />

        {/* Tactile 3D Glass Dome/Lens Overlay for physical realism */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none z-20"
          style={{
            background: "radial-gradient(circle at 28% 18%, rgba(255,255,255,0.24), rgba(255,255,255,0.045) 31%, transparent 58%), linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 44%, transparent 64%, rgba(28,30,42,0.10) 100%)",
            boxShadow: "inset 0 4px 8px rgba(255,255,255,0.34), inset 0 -5px 10px rgba(20,24,44,0.26), inset 1px 0 0 rgba(255,255,255,0.20), 0 12px 28px rgba(70,78,120,0.14)"
          }}
        />

        {/* Diagonal premium reflection sheen highlight */}
        <div 
          className="absolute top-2 left-[22%] right-[22%] h-[18%] rounded-full bg-gradient-to-b from-white/30 to-transparent blur-[1.5px] pointer-events-none z-25"
        />


      </div>

      {/* 4. Elegant Orbiting Spark Particles (Always present, extremely slow and subtle) */}
      <div 
        className="absolute inset-0 pointer-events-none z-30 animate-spin-particles"
        style={{
          animationDuration: '30s'
        }}
      >
        <div className="absolute top-[8%] left-[15%] w-1 h-1 bg-violet-200 rounded-full blur-[0.5px] shadow-[0_0_4px_rgba(167,139,250,0.45)] opacity-35 animate-pulse" />
        <div className="absolute bottom-[10%] right-[12%] w-1 h-1 bg-sky-200 rounded-full blur-[0.5px] shadow-[0_0_4px_rgba(125,211,252,0.38)] opacity-30 animate-pulse" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[45%] -right-1 w-1 h-1 bg-violet-200 rounded-full blur-[0.5px] shadow-[0_0_4px_rgba(167,139,250,0.38)] opacity-30 animate-pulse" style={{ animationDelay: '5s' }} />
        <div className="absolute top-[30%] -left-1 w-1 h-1 bg-indigo-200 rounded-full blur-[0.5px] shadow-[0_0_4px_rgba(129,140,248,0.34)] opacity-25 animate-pulse" style={{ animationDelay: '7.5s' }} />
      </div>

      {/* Floating status pill */}
      {!hidePill && size > 150 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <span
            className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest backdrop-blur-md border shadow-md transition-all duration-300 ${
              status === "talking"
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : status === "thinking"
                ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                : status === "idle"
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "bg-slate-800/30 border-slate-500/30 text-slate-400"
            }`}
          >
            {status === "talking" && "Hablando"}
            {status === "thinking" && "Pensando"}
            {status === "idle" && "En Línea"}
            {status === "connected" && "En Línea"}
            {status === "disconnected" && "En Línea"}
          </span>
        </div>
      )}

      {/* Inject custom CSS keyframes */}
      <style jsx global>{`
        .VideoAvatar-root {
          --glow-multiplier: 1.0;
        }
        .VideoAvatar-core {
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.18),
            inset 0 -18px 34px rgba(0,0,0,0.25);
        }
        @media (max-width: 768px) {
          .VideoAvatar-root {
            --glow-multiplier: 0.6;
          }
        }
        @keyframes spin-glow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-particles {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-idle {
          0%, 100% { transform: scale(1); opacity: 0.65; filter: blur(24px); }
          50% { transform: scale(1.02); opacity: 0.75; filter: blur(28px); }
        }
        @keyframes pulse-listening {
          0%, 100% { transform: scale(1); opacity: 0.8; filter: blur(26px); }
          50% { transform: scale(1.05); opacity: 0.95; filter: blur(32px); }
        }
        @keyframes pulse-thinking {
          0%, 100% { transform: scale(1); opacity: 0.85; filter: blur(28px); }
          50% { transform: scale(1.03); opacity: 1.0; filter: blur(34px); }
        }
        @keyframes pulse-speaking {
          0%, 100% { transform: scale(1.01); opacity: 0.85; filter: blur(28px); }
          50% { transform: scale(1.06); opacity: 1.0; filter: blur(36px); }
        }
      `}</style>
    </div>
  );
}
