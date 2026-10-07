import type { IsoDate } from '@/domain/booking';

/** Single source of truth for bookings query keys; never inline them in components. */
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  byDate: (date: IsoDate) => [...bookingKeys.lists(), date] as const,
};
