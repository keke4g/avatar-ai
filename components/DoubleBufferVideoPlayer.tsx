"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AvatarStateName, AvatarAnimations, getTransitionDuration, getAvatarVideoUrl } from '../lib/eternaAssets';

// Global cache for preloaded HTMLVideoElements
const preloadedVideosCache: Record<string, HTMLVideoElement> = {};
let isPreloadingStarted = false;

export function preloadAllAvatarVideos() {
  if (typeof window === 'undefined' || isPreloadingStarted) return;
  isPreloadingStarted = true;

  const allVideoUrls = [
    AvatarAnimations.IDLE,
    AvatarAnimations.TALKING,
    ...AvatarAnimations.WALKING
  ];
  
  const uniqueUrls = Array.from(new Set(allVideoUrls));

  uniqueUrls.forEach(url => {
    if (preloadedVideosCache[url]) return;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ANIMATION] Smart Preload Start: ${url}`);
    }

    const video = document.createElement('video');
    video.src = url;
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    // Load and cache
    video.load();
    preloadedVideosCache[url] = video;

    video.addEventListener('canplaythrough', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ANIMATION] Smart Preload Ready: ${url} (readyState: ${video.readyState})`);
      }
    }, { once: true });
  });
}

interface DoubleBufferVideoPlayerProps {
  state: AvatarStateName;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onEnded?: () => void;
  objectPosition?: string;
}

export function DoubleBufferVideoPlayer({
  state,
  loop = true,
  className = '',
  style = {},
  onEnded,
  objectPosition = "center 15%"
}: DoubleBufferVideoPlayerProps) {
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);

  const [activeBuffer, setActiveBuffer] = useState<'A' | 'B'>('A');
  const [srcA, setSrcA] = useState(() => getAvatarVideoUrl(state));
  const [srcB, setSrcB] = useState<string>();
  const [opacityA, setOpacityA] = useState(1);
  const [opacityB, setOpacityB] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(() => getTransitionDuration(state, state));

  const currentStateRef = useRef<AvatarStateName>(state);
  const currentSrcRef = useRef<string>(srcA);
  const activeBufferRef = useRef<'A' | 'B'>('A');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const switchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionGenerationRef = useRef(0);
  
  useEffect(() => {
    preloadAllAvatarVideos();
  }, []);

  // Safe play helper to avoid double plays and handle errors
  const safePlay = useCallback(async (video: HTMLVideoElement | null) => {
    if (!video) return;
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ANIMATION] safePlay: video not ready, state is ${video.readyState}`);
      }
      return;
    }
    if (!video.paused) {
      return; // Already playing
    }
    try {
      await video.play();
    } catch {
      // Safe catch for autoplay blocks
    }
  }, []);

  // Handle state change with queue, debounce and Transition Matrix
  useEffect(() => {
    const generation = transitionGenerationRef.current + 1;
    transitionGenerationRef.current = generation;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const fromState = currentStateRef.current;
      const toState = state;
      
      const targetSrc = getAvatarVideoUrl(toState, currentSrcRef.current);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ANIMATION] State Watcher: ${fromState} -> ${toState} | Target Video: ${targetSrc}`);
      }

      // Rule 1: No reloading same video
      if (targetSrc === currentSrcRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[ANIMATION] Video already active: ${targetSrc}. Keeping current buffer.`);
        }
        currentStateRef.current = toState;
        return;
      }

      const nextBuffer = activeBufferRef.current === 'A' ? 'B' : 'A';
      const duration = getTransitionDuration(fromState, toState);
      setTransitionDuration(duration);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ANIMATION] Crossfade transition scheduled: ${activeBufferRef.current} -> ${nextBuffer} | Duration: ${duration}ms`);
      }

      // Assign target URL to the in-active buffer
      if (nextBuffer === 'A') {
        setSrcA(targetSrc);
      } else {
        setSrcB(targetSrc);
      }

      // Wait one frame for React to bind the new source to the inactive
      // buffer. The generation guard prevents a late media event from
      // reviving an obsolete avatar state after speech has already ended.
      switchTimerRef.current = setTimeout(() => {
        switchTimerRef.current = null;
        if (generation !== transitionGenerationRef.current) return;
        const nextVideo = nextBuffer === 'A' ? videoARef.current : videoBRef.current;
        const currentVideo = activeBufferRef.current === 'A' ? videoARef.current : videoBRef.current;

        if (nextVideo) {
          // Rule 8: Avoid multiple load() calls. Only call load if path differs
          if (nextVideo.src !== targetSrc) {
            nextVideo.load();
          }

          let activated = false;
          const handleCanPlay = () => {
            if (activated || generation !== transitionGenerationRef.current) return;
            activated = true;
            // Rule 2: Keep synchronized time if they are same type of video
            if (currentVideo && nextVideo && fromState === 'TALKING' && toState === 'TALKING') {
              nextVideo.currentTime = currentVideo.currentTime;
            }

            safePlay(nextVideo).then(() => {
              if (generation !== transitionGenerationRef.current) return;
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[ANIMATION] Crossfade start: ${activeBufferRef.current} -> ${nextBuffer}`);
              }

              // Perform crossfade
              if (nextBuffer === 'A') {
                setOpacityA(1);
                setOpacityB(0);
              } else {
                setOpacityA(0);
                setOpacityB(1);
              }

              activeBufferRef.current = nextBuffer;
              setActiveBuffer(nextBuffer);
              currentSrcRef.current = targetSrc;
              currentStateRef.current = toState;

              // Rule 11: Stop old buffer after crossfade transition concludes
              if (transitionTimerRef.current) {
                clearTimeout(transitionTimerRef.current);
              }

              transitionTimerRef.current = setTimeout(() => {
                if (currentVideo && activeBufferRef.current !== (nextBuffer === 'A' ? 'B' : 'A')) {
                  currentVideo.pause();
                }
                if (process.env.NODE_ENV !== 'production') {
                  console.log(`[ANIMATION] Crossfade end: old buffer stopped`);
                }
              }, duration + 50);
            });

            // Cleanup events
            nextVideo.removeEventListener('loadeddata', handleCanPlay);
            nextVideo.removeEventListener('canplay', handleCanPlay);
          };

          // Cached videos can already be ready before listeners are attached.
          // Activate them immediately instead of waiting for an event that
          // has already fired — the previous implementation occasionally
          // left the avatar idle while audio was playing for this reason.
          if (nextVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            handleCanPlay();
          } else {
            nextVideo.addEventListener('loadeddata', handleCanPlay);
            nextVideo.addEventListener('canplay', handleCanPlay);
          }
        }
      }, 16);

    }, 24);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, [state, safePlay]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`} style={{ ...style, overflow: 'hidden' }}>
      {/* Buffer A */}
      <video
        ref={videoARef}
        src={srcA}
        muted
        playsInline
        autoPlay
        loop={loop}
        onEnded={activeBuffer === 'A' ? onEnded : undefined}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: opacityA,
          zIndex: activeBuffer === 'A' ? 12 : 10,
          transition: `opacity ${transitionDuration}ms ease-in-out`,
          objectPosition
        }}
      />

      {/* Buffer B */}
      <video
        ref={videoBRef}
        src={srcB}
        muted
        playsInline
        autoPlay
        loop={loop}
        onEnded={activeBuffer === 'B' ? onEnded : undefined}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: opacityB,
          zIndex: activeBuffer === 'B' ? 12 : 10,
          transition: `opacity ${transitionDuration}ms ease-in-out`,
          objectPosition
        }}
      />
    </div>
  );
}
