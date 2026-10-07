'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { Booking, IsoDate } from '@/domain/booking';
import { isValidIsoDate } from '@/domain/time';

import { useBookings } from '../api/queries';
import { bookingKeys } from '../api/query-keys';

/**
 * The bookings of the form's day. Bookings reported in a 409 body are merged in, but only until
 * the next (re)load of that day, which is the authoritative source.
 */
export function useDaySchedule(initialDate: IsoDate) {
  const queryClient = useQueryClient();
  // The date lives in the form, which needs these bookings for its validation context:
  // keep it in state and let the form sync it during render when the field changes.
  const [date, setDate] = useState(initialDate);
  const [reported, setReported] = useState<{ at: number; items: Booking[] } | null>(null);
  const day = useBookings(isValidIsoDate(date) ? date : null);

  /** How many times this day's list has been (re)loaded; used to expire 409 payloads. */
  const updateCount = () => queryClient.getQueryState(bookingKeys.byDate(date))?.dataUpdateCount ?? 0;
  const currentCount = updateCount();

  const bookings = useMemo(() => {
    const cached = day.data ?? [];
    if (!reported || reported.at !== currentCount) return cached;
    return [...new Map([...cached, ...reported.items].map((b) => [b.id, b])).values()];
  }, [day.data, currentCount, reported]);

  return {
    bookings,
    loading: day.isPending,
    updateCount,
    syncDate: (next: IsoDate | null) => {
      if (next && next !== date) setDate(next);
    },
    /** Trust these conflicts until the day reloads after the request was sent. */
    reportConflicts: (sentAtCount: number, items: Booking[]) => setReported({ at: sentAtCount, items }),
  };
}
