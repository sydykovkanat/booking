'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { BookingsApi } from '@/lib/api/bookings-api';

const BookingsApiContext = createContext<BookingsApi | null>(null);

interface BookingsApiProviderProps {
  api: BookingsApi;
  children: ReactNode;
}

/** Injects the API implementation, so tests and a future real backend can swap it. */
export function BookingsApiProvider({ api, children }: BookingsApiProviderProps) {
  return <BookingsApiContext value={api}>{children}</BookingsApiContext>;
}

export function useBookingsApi(): BookingsApi {
  const api = useContext(BookingsApiContext);
  if (!api) throw new Error('useBookingsApi must be used inside <BookingsApiProvider>');
  return api;
}
