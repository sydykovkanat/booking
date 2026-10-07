'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import type { IsoDate } from '@/domain/booking';
import { CALENDAR_VIEWS, type CalendarView } from '@/domain/calendar';
import { isValidIsoDate } from '@/domain/time';

const isView = (value: string | null): value is CalendarView =>
  value !== null && (CALENDAR_VIEWS as readonly string[]).includes(value);

export interface CalendarState {
  view: CalendarView;
  date: IsoDate;
}

/**
 * View and anchor date live in the URL (`?view=week&date=YYYY-MM-DD`), so reloads,
 * the back button and shared links keep what the user was looking at.
 */
export function useCalendarState(today: IsoDate | null, defaultView: CalendarView) {
  const searchParams = useSearchParams();
  const rawView = searchParams.get('view');
  const rawDate = searchParams.get('date');

  const state: CalendarState | null = today
    ? { view: isView(rawView) ? rawView : defaultView, date: rawDate && isValidIsoDate(rawDate) ? rawDate : today }
    : null;

  const navigate = useCallback(
    (next: Partial<CalendarState>) => {
      const params = new URLSearchParams(searchParams);
      if (next.view) params.set('view', next.view);
      if (next.date) params.set('date', next.date);
      window.history.pushState(null, '', `?${params}`);
    },
    [searchParams],
  );

  return [state, navigate] as const;
}
