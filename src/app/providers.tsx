'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { BookingsApiProvider } from '@/features/bookings/api/bookings-api-context';
import { ApiError } from '@/lib/api/api-error';
import { createHttpBookingsApi } from '@/lib/api/bookings-api';

const MAX_QUERY_RETRIES = 1;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // Only retry what can succeed on a second attempt; 4xx will fail the same way.
        retry: (failureCount, error) =>
          failureCount < MAX_QUERY_RETRIES && error instanceof ApiError && error.isTransient,
      },
      // Creating a booking is not idempotent: never retry mutations automatically.
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [api] = useState(() => createHttpBookingsApi());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
