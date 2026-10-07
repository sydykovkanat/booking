import type { TimeString } from '@/domain/booking';
import { type DayContext, endOptions } from '@/domain/schedule';
import { fromMinutes, isValidTime, toMinutes } from '@/domain/time';

const DEFAULT_DURATION_MINUTES = 60;

/** Duration of a range, or `null` when it is incomplete. */
export function durationOf(range: { start: string; end: string }): number | null {
  return isValidTime(range.start) && isValidTime(range.end) ? toMinutes(range.end) - toMinutes(range.start) : null;
}

/**
 * When the start changes, keep the preferred duration if that end is still free,
 * otherwise fall back to the first available end. Returns '' when nothing fits.
 */
export function pickEnd(start: TimeString, preferredDuration: number | null, ctx: DayContext): TimeString {
  if (!isValidTime(start)) return '';
  const duration = preferredDuration ?? DEFAULT_DURATION_MINUTES;

  const available = endOptions(start, ctx).filter((o) => o.status === 'available');
  const preferred = fromMinutes(toMinutes(start) + duration);
  return (available.find((o) => o.value === preferred) ?? available[0])?.value ?? '';
}
