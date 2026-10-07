import type { Booking, BookingInput, IsoDate } from '@/domain/booking';
import { toMinutes } from '@/domain/time';

/**
 * Storage port. All methods are synchronous on purpose: in a single Node process this makes
 * "validate + write" atomic, so two concurrent requests cannot both grab the same slot.
 * A real database implementation would need a transaction or an exclusion constraint instead.
 */
export interface BookingsRepository {
  listByDate(date: IsoDate): Booking[];
  findById(id: string): Booking | undefined;
  create(input: BookingInput): Booking;
  replace(booking: Booking): Booking;
  delete(id: string): boolean;
  reset(bookings: readonly Booking[]): void;
}

export function createInMemoryRepository(
  initial: readonly Booking[] = [],
  generateId: () => string = () => crypto.randomUUID(),
): BookingsRepository {
  let items = new Map(initial.map((b) => [b.id, b]));

  return {
    listByDate: (date) =>
      [...items.values()].filter((b) => b.date === date).toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start)),

    findById: (id) => items.get(id),

    create(input) {
      const booking = { ...input, id: generateId() };
      items = new Map(items).set(booking.id, booking);
      return booking;
    },

    replace(booking) {
      items = new Map(items).set(booking.id, booking);
      return booking;
    },

    delete(id) {
      if (!items.has(id)) return false;
      const next = new Map(items);
      next.delete(id);
      items = next;
      return true;
    },

    reset(bookings) {
      items = new Map(bookings.map((b) => [b.id, b]));
    },
  };
}
