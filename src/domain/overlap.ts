import type { Booking, IsoDate, TimeRange } from './booking';
import { toMinutes } from './time';

/** Half-open intervals `[start, end)`: touching boundaries do not overlap. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function findConflicts(
  range: TimeRange & { date: IsoDate },
  bookings: readonly Booking[],
  excludeId?: string,
): Booking[] {
  return bookings
    .filter((b) => b.date === range.date && b.id !== excludeId && overlaps(range, b))
    .toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start));
}
