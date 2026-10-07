import type { IsoDate, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { toMinutes } from '@/domain/time';

export const DAY_START = toMinutes(BOOKING_RULES.workStart);
export const DAY_END = toMinutes(BOOKING_RULES.workEnd);
export const STEP = BOOKING_RULES.stepMinutes;
export const SPAN = DAY_END - DAY_START;
export const HOURS = Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START / 60 + i);

/** Vertical position as a percentage, so the grid can stretch to any height. */
export const pct = (minutes: number) =>
  `${((Math.min(Math.max(minutes, DAY_START), DAY_END) - DAY_START) / SPAN) * 100}%`;

export const box = (range: TimeRange) => ({
  top: pct(toMinutes(range.start)),
  height: `calc(${pct(toMinutes(range.end))} - ${pct(toMinutes(range.start))})`,
});

export interface Draft extends TimeRange {
  day: IsoDate;
  conflict: boolean;
}

export type SelectVia = 'pointer' | 'touch' | 'keyboard';
