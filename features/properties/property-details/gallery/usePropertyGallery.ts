import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import type { Property } from '@/lib/types';
import { getPropertyGalleryMedia } from '../propertyDetailsData';

export function usePropertyGallery(property?: Property) {
  const mediaItems = useMemo(() => getPropertyGalleryMedia(property), [property]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [heroMediaIndex, setHeroMediaIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const resetZoom = useCallback(() => {
    setIsZoomed(false);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handlePrevImage = useCallback(() => {
    if (mediaItems.length === 0) return;
    resetZoom();
    setGalleryIndex((previous) => (previous === 0 ? mediaItems.length - 1 : previous - 1));
  }, [mediaItems.length, resetZoom]);

  const handleNextImage = useCallback(() => {
    if (mediaItems.length === 0) return;
    resetZoom();
    setGalleryIndex((previous) => (previous === mediaItems.length - 1 ? 0 : previous + 1));
  }, [mediaItems.length, resetZoom]);

  const handlePrevHeroMedia = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (mediaItems.length === 0) return;
    setHeroMediaIndex((previous) => (previous === 0 ? mediaItems.length - 1 : previous - 1));
  }, [mediaItems.length]);

  const handleNextHeroMedia = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (mediaItems.length === 0) return;
    setHeroMediaIndex((previous) => (previous === mediaItems.length - 1 ? 0 : previous + 1));
  }, [mediaItems.length]);

  const openGallery = useCallback((index: number) => {
    const safeIndex = Math.min(Math.max(index, 0), Math.max(mediaItems.length - 1, 0));
    resetZoom();
    setGalleryIndex(safeIndex);
    setIsGalleryOpen(true);
  }, [mediaItems.length, resetZoom]);

  const closeGallery = useCallback(() => {
    resetZoom();
    setIsGalleryOpen(false);
  }, [resetZoom]);

  const selectGalleryItem = useCallback((index: number) => {
    resetZoom();
    setGalleryIndex(index);
  }, [resetZoom]);

  const handleDoubleClick = useCallback(() => {
    if (isZoomed) {
      resetZoom();
    } else {
      setIsZoomed(true);
      setZoomScale(2.5);
    }
  }, [isZoomed, resetZoom]);

  const handleGalleryTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (isZoomed || event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isZoomed]);

  const handleGalleryTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || isZoomed || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    if (deltaX < 0) handleNextImage();
    else handlePrevImage();
  }, [handleNextImage, handlePrevImage, isZoomed]);

  useEffect(() => {
    if (!isGalleryOpen || mediaItems.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGallery();
      } else if (event.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (event.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeGallery, handleNextImage, handlePrevImage, isGalleryOpen, mediaItems.length]);

  useEffect(() => {
    if (!isGalleryOpen || typeof document === 'undefined') return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isGalleryOpen]);

  return useMemo(() => ({
    closeGallery,
    galleryIndex,
    handleDoubleClick,
    handleGalleryTouchEnd,
    handleGalleryTouchStart,
    handleNextHeroMedia,
    handleNextImage,
    handlePrevHeroMedia,
    handlePrevImage,
    heroMediaIndex,
    isGalleryOpen,
    isZoomed,
    mediaItems,
    openGallery,
    panOffset,
    selectGalleryItem,
    setPanOffset,
    zoomScale,
  }), [
    closeGallery,
    galleryIndex,
    handleDoubleClick,
    handleGalleryTouchEnd,
    handleGalleryTouchStart,
    handleNextHeroMedia,
    handleNextImage,
    handlePrevHeroMedia,
    handlePrevImage,
    heroMediaIndex,
    isGalleryOpen,
    isZoomed,
    mediaItems,
    openGallery,
    panOffset,
    selectGalleryItem,
    zoomScale,
  ]);
}

export type PropertyGalleryController = ReturnType<typeof usePropertyGallery>;
