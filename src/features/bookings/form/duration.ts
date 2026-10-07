import { isValidTime, toMinutes } from '@/domain/time';

/** Duration of a range in minutes, or `null` when it is incomplete. */
export function durationOf(range: { start: string; end: string }): number | null {
  return isValidTime(range.start) && isValidTime(range.end) ? toMinutes(range.end) - toMinutes(range.start) : null;
}
