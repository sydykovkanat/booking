import type { TimeString } from '@/domain/booking';
import { type DayContext, endOptions } from '@/domain/schedule';
import { fromMinutes, isValidTime, toMinutes } from '@/domain/time';

const DEFAULT_DURATION_MINUTES = 60;

/**
 * When the start changes, keep the previous duration if that end is still free,
 * otherwise fall back to the first available end. Returns '' when nothing fits.
 */
export function pickEnd(start: TimeString, previous: { start: string; end: string }, ctx: DayContext): TimeString {
  const duration =
    isValidTime(previous.start) && isValidTime(previous.end)
      ? toMinutes(previous.end) - toMinutes(previous.start)
      : DEFAULT_DURATION_MINUTES;

  const available = endOptions(start, ctx).filter((o) => o.status === 'available');
  const preferred = fromMinutes(toMinutes(start) + duration);
  return (available.find((o) => o.value === preferred) ?? available[0])?.value ?? '';
}
