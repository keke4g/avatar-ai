import { memo, useEffect, useState, type RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { WizardStep } from '../types';

interface ScrollInfo {
  canScrollUp: boolean;
  canScrollDown: boolean;
  scrollPct: number;
  hasOverflow: boolean;
}

interface WizardScrollControlsProps {
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  step: WizardStep;
}

const INITIAL_SCROLL_INFO: ScrollInfo = {
  canScrollUp: false,
  canScrollDown: false,
  scrollPct: 0,
  hasOverflow: false,
};

function isSameScrollInfo(previous: ScrollInfo, next: ScrollInfo): boolean {
  return previous.canScrollUp === next.canScrollUp
    && previous.canScrollDown === next.canScrollDown
    && previous.scrollPct === next.scrollPct
    && previous.hasOverflow === next.hasOverflow;
}

function WizardScrollControlsComponent({ scrollAreaRef, step }: WizardScrollControlsProps) {
  const [scrollInfo, setScrollInfo] = useState<ScrollInfo>(INITIAL_SCROLL_INFO);

  useEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    let frameId = 0;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const atBottom = scrollTop >= maxScroll - 12;
      const next: ScrollInfo = {
        canScrollUp: scrollTop > 8,
        canScrollDown: !atBottom && maxScroll > 8,
        scrollPct: maxScroll > 0 ? scrollTop / maxScroll : 1,
        hasOverflow: maxScroll > 8,
      };
      setScrollInfo((previous) => isSameScrollInfo(previous, next) ? previous : next);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(update);
    };

    element.addEventListener('scroll', scheduleUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(element);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
    scheduleUpdate();

    return () => {
      window.cancelAnimationFrame(frameId);
      element.removeEventListener('scroll', scheduleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollAreaRef]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const element = scrollAreaRef.current;
      if (!element) return;

      element.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      window.requestAnimationFrame(() => {
        const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
        const atBottom = element.scrollTop >= maxScroll - 12;
        const next: ScrollInfo = {
          canScrollUp: false,
          canScrollDown: !atBottom && maxScroll > 8,
          scrollPct: 0,
          hasOverflow: maxScroll > 8,
        };
        setScrollInfo((previous) => isSameScrollInfo(previous, next) ? previous : next);
      });
    }, 80);

    return () => window.clearTimeout(timerId);
  }, [scrollAreaRef, step]);

  const percentage = Math.round(scrollInfo.scrollPct * 100);

  return (
    <>
      <AnimatePresence>
        {scrollInfo.hasOverflow && (
          <motion.div
            key="scroll-sidebar"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex flex-col items-center gap-1.5 py-1 shrink-0 w-7"
          >
            <button
              type="button"
              onClick={() => scrollAreaRef.current?.scrollBy({ top: -160, behavior: 'smooth' })}
              disabled={!scrollInfo.canScrollUp}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${
                scrollInfo.canScrollUp
                  ? 'border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer'
                  : 'border-brand-gray-100 text-brand-gray-200 cursor-not-allowed'
              }`}
            >
              <ChevronUp className="w-3 h-3" />
            </button>

            <div className="flex-1 w-1.5 rounded-full bg-brand-gray-100 relative overflow-hidden min-h-0">
              <motion.div
                className="absolute top-0 left-0 w-full rounded-full bg-brand-accent/40"
                animate={{ height: `${percentage}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
              <motion.div
                className="absolute left-0 w-full h-3 rounded-full bg-brand-accent shadow-sm"
                animate={{ top: `calc(${percentage}% - 6px)` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>

            <button
              type="button"
              onClick={() => scrollAreaRef.current?.scrollBy({ top: 160, behavior: 'smooth' })}
              disabled={!scrollInfo.canScrollDown}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all border ${
                scrollInfo.canScrollDown
                  ? 'border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black cursor-pointer'
                  : 'border-brand-gray-100 text-brand-gray-200 cursor-not-allowed'
              }`}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scrollInfo.canScrollDown && (
          <motion.div
            key="scroll-fade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute bottom-0 left-0 right-7 h-20 flex flex-col items-center justify-end pb-1"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, var(--property-wizard-fade-mid, rgba(248,247,243,0.92)) 60%, var(--property-wizard-fade-end, rgba(248,247,243,1)) 100%)',
            }}
          >
            <span className="text-[10px] font-bold text-brand-gray-400 tracking-wide flex flex-col items-center gap-0.5">
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              >
                <ChevronDown className="w-4 h-4 text-brand-accent" />
              </motion.span>
              Más campos
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scrollInfo.canScrollDown && (
          <motion.button
            key="mobile-scroll-btn"
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollAreaRef.current?.scrollBy({ top: 160, behavior: 'smooth' })}
            className="md:hidden absolute bottom-2 right-2 z-20 flex items-center gap-1 px-3 py-1.5 bg-brand-black/85 backdrop-blur text-white rounded-full text-[10px] font-bold shadow-lg cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
            Más campos
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

export const WizardScrollControls = memo(WizardScrollControlsComponent);
