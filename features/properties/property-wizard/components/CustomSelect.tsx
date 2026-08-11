import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface CustomSelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  scrollContainerRef,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [menuScrollMetrics, setMenuScrollMetrics] = useState({ thumbHeight: 100, thumbTop: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuScrollMetrics = (element: HTMLDivElement) => {
    const scrollable = Math.max(0, element.scrollHeight - element.clientHeight);
    const thumbHeight = scrollable > 0
      ? Math.max(18, (element.clientHeight / element.scrollHeight) * 100)
      : 100;
    const thumbTop = scrollable > 0
      ? (element.scrollTop / scrollable) * (100 - thumbHeight)
      : 0;
    setMenuScrollMetrics({ thumbHeight, thumbTop });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const element = scrollContainerRef?.current;
    if (!element) return;
    const handleScroll = () => setIsOpen(false);
    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [isOpen, scrollContainerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (menuRef.current) updateMenuScrollMetrics(menuRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, options.length]);

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) {
      setIsOpen(true);
      return;
    }

    const menuMaxHeight = 208;
    const spaceThreshold = 12;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - spaceThreshold;
    const spaceAbove = rect.top - spaceThreshold;
    const needsUp = spaceBelow < menuMaxHeight && spaceAbove > spaceBelow;

    if (needsUp) {
      setDropUp(true);
      setMenuStyle({
        position: 'fixed',
        top: 'auto',
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      setDropUp(false);
      if (spaceBelow < menuMaxHeight && scrollContainerRef?.current) {
        const needed = menuMaxHeight - spaceBelow;
        scrollContainerRef.current.scrollBy({ top: needed + 16, behavior: 'smooth' });
      }
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        bottom: 'auto',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setIsOpen(true);
  };

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none flex items-center justify-between text-left cursor-pointer hover:border-brand-gray-400 transition-all text-brand-black"
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-brand-gray-400 transition-transform duration-200 ${isOpen ? (dropUp ? '' : 'rotate-180') : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            onScroll={(event) => updateMenuScrollMetrics(event.currentTarget)}
            initial={{ opacity: 0, y: dropUp ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            style={menuStyle}
            className="no-scrollbar max-h-52 overflow-y-auto overscroll-contain bg-white border border-brand-gray-200 rounded-xl shadow-premium"
          >
            <div className="p-1 pr-3 flex flex-col gap-0.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    option.value === value
                      ? 'bg-brand-black text-white'
                      : 'hover:bg-brand-gray-50 text-brand-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {menuScrollMetrics.thumbHeight < 100 && (
              <span className="pointer-events-none absolute bottom-2 right-1.5 top-2 w-1 rounded-full bg-[#dcecf3]">
                <span
                  className="absolute left-0 w-full rounded-full bg-brand-accent shadow-[0_0_0_1px_rgba(10,119,168,0.12)] transition-[top] duration-100"
                  style={{
                    height: `${menuScrollMetrics.thumbHeight}%`,
                    top: `${menuScrollMetrics.thumbTop}%`,
                  }}
                />
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
