'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ETERNA_CLOSE_PROPERTY_VISUAL_EVENT,
  ETERNA_SHOW_PROPERTY_VISUAL_EVENT,
  type EternaClosePropertyVisualDetail,
  type EternaPropertyVisualSection,
  type EternaShowPropertyVisualDetail,
} from '@/lib/eterna/events';

export function usePropertyEternaVisual(propertyId: string) {
  const [activeSection, setActiveSection] = useState<EternaPropertyVisualSection | null>(null);
  const activeSectionRef = useRef<EternaPropertyVisualSection | null>(null);
  const summaryStartedTalkingRef = useRef(false);

  const closeLocal = useCallback(() => {
    activeSectionRef.current = null;
    summaryStartedTalkingRef.current = false;
    setActiveSection(null);
  }, []);

  const close = useCallback(() => {
    window.dispatchEvent(new CustomEvent(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, {
      detail: { propertyId, section: activeSectionRef.current || undefined },
    }));
  }, [propertyId]);

  useEffect(() => {
    const handleShow = (event: Event) => {
      const detail = (event as CustomEvent<EternaShowPropertyVisualDetail>).detail;
      if (!detail || detail.propertyId !== propertyId) return;
      activeSectionRef.current = detail.section;
      summaryStartedTalkingRef.current = false;
      setActiveSection(detail.section);
    };

    const handleClose = (event: Event) => {
      const detail = (event as CustomEvent<EternaClosePropertyVisualDetail>).detail;
      if (!detail || detail.propertyId !== propertyId) return;
      if (detail.section && detail.section !== activeSectionRef.current) return;
      closeLocal();
    };

    const handleEternaStatus = (event: Event) => {
      if (activeSectionRef.current !== 'summary') return;
      const status = (event as CustomEvent<string>).detail;
      if (status === 'talking') {
        summaryStartedTalkingRef.current = true;
      } else if (status === 'idle' && summaryStartedTalkingRef.current) {
        close();
      }
    };

    window.addEventListener(ETERNA_SHOW_PROPERTY_VISUAL_EVENT, handleShow);
    window.addEventListener(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, handleClose);
    window.addEventListener('eterna-status', handleEternaStatus);
    return () => {
      window.removeEventListener(ETERNA_SHOW_PROPERTY_VISUAL_EVENT, handleShow);
      window.removeEventListener(ETERNA_CLOSE_PROPERTY_VISUAL_EVENT, handleClose);
      window.removeEventListener('eterna-status', handleEternaStatus);
    };
  }, [close, closeLocal, propertyId]);

  useEffect(() => {
    if (!activeSection) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSection, close]);

  return { activeSection, close };
}
