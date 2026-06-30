"use client";

import React, { useEffect, useRef, useState } from "react";
import { StreamStatus } from "../hooks/useWebSocketStream";

interface AvatarStreamProps {
  currentFrame: string | null;
  status: StreamStatus;
}

export function AvatarStream({ currentFrame, status }: AvatarStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const imageCacheRef = useRef<HTMLImageElement | null>(null);

  // Determine glow color based on current status
  const getGlowStyles = () => {
    switch (status) {
      case "thinking":
        return {
          opacity: "opacity-100",
          background: `
            radial-gradient(
              circle,
              rgba(168,85,247,0.85) 0%,
              rgba(139,92,246,0.5) 35%,
              rgba(99,102,241,0.2) 60%,
              rgba(99,102,241,0) 80%
            )
          `,
          animation: "pulse-slow 2s infinite ease-in-out",
        };
      case "talking":
        return {
          opacity: "opacity-100",
          background: `
            radial-gradient(
              circle,
              rgba(34,197,94,0.95) 0%,
              rgba(16,185,129,0.6) 35%,
              rgba(52,211,153,0.25) 60%,
              rgba(52,211,153,0) 80%
            )
          `,
          animation: "pulse-fast 0.5s infinite ease-in-out",
        };
      case "idle":
        return {
          opacity: "opacity-60",
          background: `
            radial-gradient(
              circle,
              rgba(59,130,246,0.5) 0%,
              rgba(99,102,241,0.3) 40%,
              rgba(99,102,241,0.05) 70%,
              rgba(99,102,241,0) 85%
            )
          `,
          animation: "pulse-slow 4s infinite ease-in-out",
        };
      default:
        return {
          opacity: "opacity-0",
          background: "none",
          animation: "none",
        };
    }
  };

  // Double-Buffered Canvas Rendering to eliminate browser flashes
  useEffect(() => {
    if (!currentFrame) {
      setShowCanvas(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create an offscreen Image element to pre-decode the base64 WebP frame
    const img = new Image();
    img.src = currentFrame;
    
    img.onload = () => {
      // Draw onto the visible canvas ONLY after the image is fully decoded in memory
      // This completely prevents half-drawn frames and blank flashes!
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setShowCanvas(true);
    };

    img.onerror = () => {
      console.error("Error drawing frame to canvas");
    };

    // Cache image element reference to prevent garbage collection sweeps during active stream
    imageCacheRef.current = img;

  }, [currentFrame]);

  const glow = getGlowStyles();

  return (
    <div className="relative z-10 mb-10 select-none">
      {/* Dynamic Aurora Glow */}
      <div
        className={`absolute inset-[-85px] rounded-full pointer-events-none transition-all duration-500 blur-3xl ${glow.opacity}`}
        style={{
          background: glow.background,
          animation: glow.animation,
        }}
      />

      {/* Avatar Circular Viewport */}
      <div className="relative w-[430px] h-[430px] rounded-full overflow-hidden border-[10px] border-white shadow-[0_25px_80px_rgba(0,0,0,0.15)] bg-slate-900 flex items-center justify-center">
        
        {/* Double-buffered Canvas for Streamed Video Frames (Guarantees zero-flash) */}
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 ${
            showCanvas ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* High-quality Elegant Static Placeholder (Cross-fades smoothly under the canvas) */}
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950">
          <img
            src="/avatar.png"
            alt="Eterna Portrait Placeholder"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              status === "disconnected" ? "opacity-40 grayscale" : "opacity-80"
            }`}
            draggable={false}
          />

          {/* Connection / Initializing Status indicators */}
          {status === "disconnected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all">
              <div className="w-14 h-14 rounded-full border-4 border-slate-500 border-t-indigo-500 animate-spin mb-4" />
              <span className="text-white/80 font-medium text-sm tracking-wider uppercase bg-slate-900/60 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                Desconectado
              </span>
            </div>
          )}

          {status === "connected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[1px]">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-400 border-t-white animate-spin mb-4" />
              <span className="text-white/90 font-medium text-xs tracking-wider uppercase bg-indigo-950/70 px-4 py-1.5 rounded-full border border-indigo-500/20">
                Inicializando...
              </span>
            </div>
          )}
        </div>

        {/* Floating status pill */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <span
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest backdrop-blur-md border shadow-md transition-all duration-300 ${
              status === "talking"
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : status === "thinking"
                ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                : status === "idle"
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "bg-slate-700/30 border-slate-500/30 text-slate-400"
            }`}
          >
            {status === "talking" && "Hablando"}
            {status === "thinking" && "Pensando"}
            {status === "idle" && "En Línea"}
            {status === "connected" && "Conectando"}
            {status === "disconnected" && "Offline"}
          </span>
        </div>
      </div>

      {/* Styled inline keyframes */}
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% {
            transform: scale(1);
            filter: blur(28px) opacity(0.95);
          }
          50% {
            transform: scale(1.04);
            filter: blur(36px) opacity(0.7);
          }
        }
        @keyframes pulse-fast {
          0%, 100% {
            transform: scale(1.02);
            filter: blur(24px) opacity(1);
          }
          50% {
            transform: scale(1.08);
            filter: blur(34px) opacity(0.8);
          }
        }
      `}</style>
    </div>
  );
}
