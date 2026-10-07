'use client';

import type { Booking } from '@/domain/booking';

import { useBookings } from '../api/queries';

/**
 * The booking being edited, as the server currently has it: someone may have changed or
 * deleted it since the editor opened. `gone` is true once the day loaded without it.
 */
export function useFreshOriginal(snapshot: Booking | undefined) {
  const day = useBookings(snapshot?.date ?? null);
  const fresh = snapshot && day.data?.find((b) => b.id === snapshot.id);
  return { original: fresh ?? snapshot, gone: Boolean(snapshot && day.isSuccess && !fresh) };
}
