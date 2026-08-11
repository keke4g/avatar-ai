import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
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
    setGalleryIndex(index);
    setIsGalleryOpen(true);
  }, []);

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

  useEffect(() => {
    if (!isGalleryOpen || mediaItems.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsGalleryOpen(false);
      } else if (event.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (event.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextImage, handlePrevImage, isGalleryOpen, mediaItems.length]);

  return useMemo(() => ({
    galleryIndex,
    handleDoubleClick,
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
    setIsGalleryOpen,
    setPanOffset,
    zoomScale,
  }), [
    galleryIndex,
    handleDoubleClick,
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
