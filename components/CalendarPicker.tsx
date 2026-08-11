"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useTranslation } from '../lib/context/LanguageContext';
import { Property, SwapRequest } from '../lib/types';
import { filterAndSortProperties } from '../lib/searchFilters';

const fallbackAvailabilityPreviewImages = [
  'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=160&q=80',
];

type AvailabilityPreview = {
  count: number;
  images: string[];
  isFallback: boolean;
};

interface CalendarPickerProps {
  selectedRange: { start: string; end: string } | null;
  onChange: (range: { start: string; end: string } | null) => void;
  onClose: () => void;
  position: { top: number; left: number; placement?: 'top' | 'bottom' } | null;
  properties: Property[];
  swaps: SwapRequest[];
  searchQuery: string;
  guestsCount: number;
  activeCategory?: string;
  selectedSwapType?: string;
  sortBy?: string;
}

export function CalendarPicker({
  selectedRange,
  onChange,
  onClose,
  position,
  properties,
  swaps,
  searchQuery,
  guestsCount,
  activeCategory = 'All',
  selectedSwapType = 'All',
  sortBy = 'match'
}: CalendarPickerProps) {
  const { language } = useTranslation();
  const [tempRange, setTempRange] = useState<{ start: string; end: string } | null>(selectedRange);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedRange?.start) {
      return new Date(selectedRange.start);
    }
    return new Date();
  });
  
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside detection to close the picker safely
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onClose]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  // Months label
  const monthNamesES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Helper: YYYY-MM-DD string
  const toDateStr = (y: number, m: number, d: number): string => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Days grid calculation
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Shift Sunday (0) to index 6, Monday (1) to index 0
  const firstDayIndex = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // Days list to render
  const days: { dayNumber: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Padding days from previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    days.push({
      dayNumber: d,
      dateStr: toDateStr(prevMonthYear, prevMonth, d),
      isCurrentMonth: false
    });
  }

  // Days of current month
  for (let d = 1; d <= totalDaysInMonth; d++) {
    days.push({
      dayNumber: d,
      dateStr: toDateStr(year, month, d),
      isCurrentMonth: true
    });
  }

  // Padding days from next month to reach exactly 42 days (6 full weeks grid)
  const remainingDays = 42 - days.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  for (let d = 1; d <= remainingDays; d++) {
    days.push({
      dayNumber: d,
      dateStr: toDateStr(nextMonthYear, nextMonth, d),
      isCurrentMonth: false
    });
  }

  // Month navigation helpers
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Day selection logic
  const handleDaySelect = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If no start date exists, or both dates exist, start a new range selection
    if (!tempRange || (tempRange.start && tempRange.end)) {
      setTempRange({ start: dateStr, end: '' });
    } else {
      // Start date exists, end date does not
      const start = new Date(tempRange.start);
      const clicked = new Date(dateStr);
      
      if (clicked < start) {
        // If clicked date is before start date, treat it as the new start date
        setTempRange({ start: dateStr, end: '' });
      } else {
        // Settle the range selection locally, do not close or call onChange yet
        setTempRange({ start: tempRange.start, end: dateStr });
      }
    }
  };

  // Highlighting calculations
  const isStart = (dateStr: string) => tempRange?.start === dateStr;
  const isEnd = (dateStr: string) => tempRange?.end === dateStr;
  const isInRange = (dateStr: string) => {
    if (!tempRange?.start || !tempRange?.end) return false;
    const current = new Date(dateStr);
    const start = new Date(tempRange.start);
    const end = new Date(tempRange.end);
    return current > start && current < end;
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showAvailabilityPreview = Boolean(tempRange?.start);
  const availabilityPreview = useMemo<AvailabilityPreview>(() => {
    if (!tempRange?.start) {
      return {
        count: 23,
        images: fallbackAvailabilityPreviewImages.slice(0, 4),
        isFallback: true,
      };
    }

    try {
      const matchingProperties = filterAndSortProperties({
        properties,
        swaps,
        searchQuery,
        startDate: tempRange.start,
        endDate: tempRange.end || '',
        guestsCount,
        activeCategory,
        selectedSwapType,
        sortBy,
      });

      return {
        count: matchingProperties.length,
        images: matchingProperties
          .map(property => property.images?.[0])
          .filter((src): src is string => Boolean(src))
          .slice(0, 4),
        isFallback: false,
      };
    } catch (error) {
      console.error('[CalendarPicker] Availability preview shared filter failed:', error);
      return {
        count: 23,
        images: fallbackAvailabilityPreviewImages.slice(0, 4),
        isFallback: true,
      };
    }
  }, [properties, swaps, searchQuery, tempRange, guestsCount, activeCategory, selectedSwapType, sortBy]);

  // Keep picker within bounds of viewport on desktop
  const style: React.CSSProperties = isMobile
    ? {
        position: 'relative',
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        zIndex: 9999,
        top: position ? position.top : '20%',
        left: position ? position.left : '50%',
        transform: position ? 'none' : 'translateX(-50%)',
      };

  const calendarCard = (
    <div
      ref={containerRef}
      style={style}
      className="w-[320px] bg-white border border-brand-gray-200 rounded-[24px] shadow-2xl p-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 select-none text-left"
    >
      {/* Calendar Header with Month/Year Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-extrabold text-brand-black uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-accent" />
          <span>{monthNamesES[month]} {year}</span>
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-full text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-full text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
          <span key={day} className="text-[10px] font-bold text-brand-gray-400">
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          const activeStart = isStart(item.dateStr);
          const activeEnd = isEnd(item.dateStr);
          const activeRange = isInRange(item.dateStr);
          
          return (
            <button
              key={`${item.dateStr}-${idx}`}
              type="button"
              disabled={!item.isCurrentMonth}
              onClick={(e) => handleDaySelect(item.dateStr, e)}
              className={`h-9 w-full rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer ${
                !item.isCurrentMonth
                  ? "text-brand-gray-300/40 opacity-30 cursor-not-allowed pointer-events-none"
                  : activeStart
                  ? "bg-brand-accent text-white shadow-md shadow-brand-accent/20"
                  : activeEnd
                  ? "bg-brand-accent text-white shadow-md shadow-brand-accent/20"
                  : activeRange
                  ? "bg-brand-accent/10 text-brand-accent rounded-none"
                  : "text-brand-black hover:bg-brand-gray-100"
              }`}
            >
              {item.dayNumber}
            </button>
          );
        })}
      </div>

      {/* Clear/Helper footer bar */}
      <div className="mt-3 pt-3 border-t border-brand-gray-100 flex items-center justify-between text-[9px] font-bold text-brand-gray-400">
        <span>
          {tempRange?.start ? `In: ${tempRange.start}` : 'Elige entrada'}
        </span>
        <span>
          {tempRange?.end ? `Out: ${tempRange.end}` : 'Elige salida'}
        </span>
      </div>

      {showAvailabilityPreview && (
        <div className="mt-3 rounded-[18px] border border-white/70 bg-white/70 p-2.5 shadow-[0_14px_34px_rgba(80,88,120,0.12),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-2xl transition-all duration-200 hover:shadow-[0_18px_42px_rgba(80,88,120,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black leading-none text-brand-black">
                {availabilityPreview.count} destinos compatibles
              </p>
              <p className="mt-1 text-[8.5px] font-bold leading-none text-brand-gray-400">
                Afinidad de intercambio detectada
              </p>
            </div>
            <div className="flex shrink-0 items-center pl-2">
              {availabilityPreview.images.map((src, index) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={32}
                  height={32}
                  sizes="32px"
                  unoptimized
                  className="h-8 w-8 rounded-xl border-2 border-white object-cover shadow-[0_8px_18px_rgba(60,68,98,0.16)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105"
                  style={{ marginLeft: index === 0 ? 0 : -10, zIndex: availabilityPreview.images.length - index }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cancel/Confirm action buttons (UX Bug #1) */}
      <div className="mt-3 pt-3 border-t border-brand-gray-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setTempRange(null);
            onChange(null);
            onClose();
          }}
          className="px-3 py-1.5 rounded-xl border border-brand-gray-200 hover:bg-brand-gray-50 text-[10px] font-bold text-brand-gray-500 cursor-pointer transition-colors"
        >
          {language === 'es' ? 'Cancelar' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(tempRange);
            onClose();
          }}
          disabled={tempRange && tempRange.start && !tempRange.end ? true : false}
          className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all cursor-pointer ${
            tempRange && tempRange.start && !tempRange.end
              ? 'bg-brand-accent/40 cursor-not-allowed opacity-50'
              : 'bg-brand-accent hover:bg-brand-accent/90 active:scale-98 shadow-sm'
          }`}
        >
          {language === 'es' ? 'Confirmar' : 'Confirm'}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/15 backdrop-blur-[2px] animate-in fade-in duration-200">
        {calendarCard}
      </div>
    );
  }

  return calendarCard;
}

export { formatElegantRange, formatHumanDate } from '@/lib/shared/dateFormat';
