import { useCallback, useMemo, useState } from 'react';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { Property, SwapRequest, SwapStatus } from '@/lib/types';

interface BookedRange {
  start: string;
  end: string;
}

export interface PropertyCalendarDay {
  date: Date;
  type: 'prev' | 'current' | 'next';
  key: string;
}

export type PropertyRangeStatus = 'invalid' | 'available' | 'partial' | 'unavailable' | null;

interface UsePropertyAvailabilityOptions {
  property?: Property;
  selectedMyPropertyId: string;
  swaps: SwapRequest[];
}

const ACTIVE_SWAP_STATUSES = new Set<SwapStatus>(['APPROVED', 'CONFIRMED', 'ACTIVE']);
const EMPTY_BOOKED_RANGES: BookedRange[] = [];
const CALENDAR_MONTH_NAMES: Record<LanguageType, readonly string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const rangeContainsDate = (range: BookedRange, date: string): boolean => (
  date >= range.start && date <= range.end
);

const rangesOverlap = (ranges: BookedRange[], startDate: string, endDate: string): boolean => (
  ranges.some((range) => (
    (startDate >= range.start && startDate <= range.end)
    || (endDate >= range.start && endDate <= range.end)
    || (startDate <= range.start && endDate >= range.end)
  ))
);

export function formatPropertyCalendarMonth(
  month: number,
  year: number,
  language: LanguageType,
): string {
  return `${CALENDAR_MONTH_NAMES[language][month]} ${year}`;
}

export function usePropertyAvailability({
  property,
  selectedMyPropertyId,
  swaps,
}: UsePropertyAvailabilityOptions) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const bookedRangesByProperty = useMemo(() => {
    const rangesByProperty = new Map<string, BookedRange[]>();

    for (const swap of swaps) {
      if (!ACTIVE_SWAP_STATUSES.has(swap.status)) continue;

      const range = { start: swap.startDate, end: swap.endDate };
      const propertyIds = swap.senderPropertyId === swap.receiverPropertyId
        ? [swap.senderPropertyId]
        : [swap.senderPropertyId, swap.receiverPropertyId];

      for (const propertyId of propertyIds) {
        const ranges = rangesByProperty.get(propertyId);
        if (ranges) ranges.push(range);
        else rangesByProperty.set(propertyId, [range]);
      }
    }

    return rangesByProperty;
  }, [swaps]);

  const bookedRanges = property
    ? bookedRangesByProperty.get(property.id) || EMPTY_BOOKED_RANGES
    : EMPTY_BOOKED_RANGES;
  const selectedPropertyBookedRanges = selectedMyPropertyId
    ? bookedRangesByProperty.get(selectedMyPropertyId) || EMPTY_BOOKED_RANGES
    : EMPTY_BOOKED_RANGES;
  const availableStart = property?.availableStart;
  const availableEnd = property?.availableEnd;

  const numNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const hasOverlap = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (rangesOverlap(bookedRanges, startDate, endDate)) return true;
    return selectedMyPropertyId
      ? rangesOverlap(selectedPropertyBookedRanges, startDate, endDate)
      : false;
  }, [bookedRanges, endDate, selectedMyPropertyId, selectedPropertyBookedRanges, startDate]);

  const calendarYear = currentCalendarDate.getFullYear();
  const calendarMonth = currentCalendarDate.getMonth();

  const calendarDays = useMemo<PropertyCalendarDay[]>(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    const days: PropertyCalendarDay[] = [];

    for (let index = startDayOfWeek - 1; index >= 0; index--) {
      const day = daysInPrevMonth - index;
      days.push({
        date: new Date(calendarYear, calendarMonth - 1, day),
        type: 'prev',
        key: `prev-${day}`,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(calendarYear, calendarMonth, day),
        type: 'current',
        key: `curr-${day}`,
      });
    }

    const remainingSlots = 42 - days.length;
    for (let day = 1; day <= remainingSlots; day++) {
      days.push({
        date: new Date(calendarYear, calendarMonth + 1, day),
        type: 'next',
        key: `next-${day}`,
      });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  const handlePrevMonth = useCallback(() => {
    setCurrentCalendarDate((current) => (
      new Date(current.getFullYear(), current.getMonth() - 1, 1)
    ));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentCalendarDate((current) => (
      new Date(current.getFullYear(), current.getMonth() + 1, 1)
    ));
  }, []);

  const handleDateClick = useCallback((clickedDate: Date) => {
    const clickedDateString = clickedDate.toISOString().split('T')[0];
    const isOccupied = bookedRanges.some((range) => rangeContainsDate(range, clickedDateString));
    const isWithinBounds = availableStart && availableEnd
      ? clickedDateString >= availableStart && clickedDateString <= availableEnd
      : false;
    if (isOccupied || !isWithinBounds) return;

    if (!startDate || endDate) {
      setStartDate(clickedDateString);
      setEndDate('');
      return;
    }

    if (clickedDateString < startDate) {
      setStartDate(clickedDateString);
      setEndDate('');
      return;
    }

    const currentDate = new Date(startDate);
    const limit = new Date(clickedDate);
    let hasBlockedInBetween = false;

    while (currentDate <= limit) {
      const currentDateString = currentDate.toISOString().split('T')[0];
      const occupied = bookedRanges.some((range) => rangeContainsDate(range, currentDateString));
      const withinBounds = availableStart && availableEnd
        ? currentDateString >= availableStart && currentDateString <= availableEnd
        : false;
      if (occupied || !withinBounds) {
        hasBlockedInBetween = true;
        break;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (hasBlockedInBetween) {
      setStartDate(clickedDateString);
      setEndDate('');
    } else {
      setEndDate(clickedDateString);
    }
  }, [availableEnd, availableStart, bookedRanges, endDate, startDate]);

  const rangeStatus = useMemo<PropertyRangeStatus>(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 'invalid';

    let occupiedCount = 0;
    let outOfBoundsCount = 0;
    let totalDays = 0;
    const current = new Date(start);

    while (current <= end) {
      totalDays++;
      const currentDateString = current.toISOString().split('T')[0];
      const isOccupied = bookedRanges.some((range) => rangeContainsDate(range, currentDateString));
      const isWithinBounds = availableStart && availableEnd
        ? currentDateString >= availableStart && currentDateString <= availableEnd
        : false;

      if (isOccupied) occupiedCount++;
      if (!isWithinBounds) outOfBoundsCount++;
      current.setDate(current.getDate() + 1);
    }

    if (occupiedCount === 0 && outOfBoundsCount === 0) return 'available';
    if (occupiedCount > 0 && occupiedCount < totalDays) return 'partial';
    return 'unavailable';
  }, [availableEnd, availableStart, bookedRanges, endDate, startDate]);

  return {
    bookedRanges,
    calendarDays,
    calendarMonth,
    calendarYear,
    endDate,
    handleDateClick,
    handleNextMonth,
    handlePrevMonth,
    hasOverlap,
    numNights,
    rangeStatus,
    startDate,
  };
}
