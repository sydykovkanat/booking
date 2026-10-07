'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

import type { IsoDate } from '@/domain/booking';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { useBookingsApi } from './bookings-api-context';
import { bookingKeys } from './query-keys';

/** Picks up bookings made by other people without a manual reload. */
const BACKGROUND_REFRESH_MS = 30_000;

export const bookingsByDateQuery = (api: BookingsApi, date: IsoDate) =>
  queryOptions({
    queryKey: bookingKeys.byDate(date),
    queryFn: ({ signal }) => api.list(date, { signal }),
    refetchInterval: BACKGROUND_REFRESH_MS,
  });

export function useBookings(date: IsoDate | null) {
  const api = useBookingsApi();
  return useQuery({
    ...bookingsByDateQuery(api, date ?? ''),
    enabled: date !== null,
  });
}
