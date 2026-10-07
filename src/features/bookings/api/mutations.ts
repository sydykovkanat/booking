'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { BookingPatch } from '@/contracts/bookings';
import type { Booking, BookingInput, IsoDate } from '@/domain/booking';

import { useBookingsApi } from './bookings-api-context';
import { bookingKeys } from './query-keys';

/**
 * Mutations are pessimistic: the UI only shows what the server accepted. Every outcome,
 * including 409/404, refreshes the affected days so the user sees the real schedule.
 */
function useInvalidateDays() {
  const queryClient = useQueryClient();
  return (...dates: (IsoDate | undefined)[]) =>
    Promise.all(
      [...new Set(dates.filter((d): d is IsoDate => Boolean(d)))].map((date) =>
        queryClient.invalidateQueries({ queryKey: bookingKeys.byDate(date) }),
      ),
    );
}

export function useCreateBooking() {
  const api = useBookingsApi();
  const invalidate = useInvalidateDays();
  return useMutation({
    mutationFn: (input: BookingInput) => api.create(input),
    onSettled: (_data, _error, input) => invalidate(input.date),
  });
}

export interface UpdateBookingVariables {
  original: Booking;
  patch: BookingPatch;
}

export function useUpdateBooking() {
  const api = useBookingsApi();
  const invalidate = useInvalidateDays();
  return useMutation({
    mutationFn: ({ original, patch }: UpdateBookingVariables) => api.update(original.id, patch),
    onSettled: (_data, _error, { original, patch }) => invalidate(original.date, patch.date),
  });
}

export function useDeleteBooking() {
  const api = useBookingsApi();
  const invalidate = useInvalidateDays();
  return useMutation({
    mutationFn: (booking: Booking) => api.remove(booking.id),
    onSettled: (_data, _error, booking) => invalidate(booking.date),
  });
}
