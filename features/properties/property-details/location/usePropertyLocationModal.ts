import { useEffect, useMemo, useState } from 'react';
import {
  ETERNA_OPEN_PROPERTY_LOCATION_EVENT,
  type EternaOpenPropertyLocationDetail,
} from '@/lib/eterna/events';

export function usePropertyLocationModal(propertyId: string) {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenLocation = (event: Event) => {
      const detail = (event as CustomEvent<EternaOpenPropertyLocationDetail>).detail;
      if (detail?.propertyId && detail.propertyId !== propertyId) return;
      setIsLocationModalOpen(true);
    };

    window.addEventListener(ETERNA_OPEN_PROPERTY_LOCATION_EVENT, handleOpenLocation);
    return () => window.removeEventListener(ETERNA_OPEN_PROPERTY_LOCATION_EVENT, handleOpenLocation);
  }, [propertyId]);

  useEffect(() => {
    if (!isLocationModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLocationModalOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLocationModalOpen]);

  return useMemo(() => ({
    isLocationModalOpen,
    setIsLocationModalOpen,
  }), [isLocationModalOpen]);
}

export type PropertyLocationModalController = ReturnType<typeof usePropertyLocationModal>;
