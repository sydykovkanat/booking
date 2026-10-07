'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import type { IsoDate } from '@/domain/booking';
import { isValidIsoDate } from '@/domain/time';

const PARAM = 'date';

/**
 * The viewed date lives in the URL (`?date=YYYY-MM-DD`) so it survives reloads and can be shared.
 * Falls back to `today` when the param is missing or invalid.
 */
export function useSelectedDate(today: IsoDate | null): [IsoDate | null, (date: IsoDate) => void] {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(PARAM);
  const date = fromUrl && isValidIsoDate(fromUrl) ? fromUrl : today;

  const setDate = useCallback(
    (next: IsoDate) => {
      const params = new URLSearchParams(searchParams);
      if (next === today) params.delete(PARAM);
      else params.set(PARAM, next);
      const query = params.toString();
      window.history.pushState(null, '', query ? `?${query}` : window.location.pathname);
    },
    [searchParams, today],
  );

  return [date, setDate];
}
