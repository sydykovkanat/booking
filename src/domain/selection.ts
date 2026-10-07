import type { TimeRange } from './booking';
import { BOOKING_RULES } from './config';
import { overlaps } from './overlap';
import { buildAgenda, type DayContext } from './schedule';
import { fromMinutes, toMinutes } from './time';

const STEP = BOOKING_RULES.stepMinutes;
const MIN = BOOKING_RULES.minDurationMinutes;
const MAX = BOOKING_RULES.maxDurationMinutes;
const DAY_END = toMinutes(BOOKING_RULES.workEnd);
const PREFERRED = 60;

const floorStep = (minutes: number) => Math.floor(minutes / STEP) * STEP;
const toRange = (start: number, end: number): TimeRange => ({ start: fromMinutes(start), end: fromMinutes(end) });

/** The bookable free window (already clipped to "now") that contains `minute`. */
export function findFreeWindow(ctx: DayContext, minute: number): TimeRange | null {
  for (const item of buildAgenda(ctx)) {
    if (item.kind === 'free' && minute >= toMinutes(item.start) && minute < toMinutes(item.end)) {
      return { start: item.start, end: item.end };
    }
  }
  return null;
}

/** A tap: one hour from the tapped quarter hour, shortened to fit the free window. */
export function rangeAtMinute(ctx: DayContext, minute: number): TimeRange | null {
  const window = findFreeWindow(ctx, minute);
  if (!window) return null;
  const [lo, hi] = [toMinutes(window.start), toMinutes(window.end)];
  const start = Math.min(Math.max(floorStep(minute), lo), hi - MIN);
  return toRange(start, Math.min(start + PREFERRED, hi));
}

/**
 * A drag from `anchor` to `current` (minutes since midnight): whole quarter hours, at least
 * the minimum duration, at most the maximum measured from the anchor, inside one free window.
 */
export function rangeFromDrag(ctx: DayContext, anchor: number, current: number): TimeRange | null {
  const window = findFreeWindow(ctx, anchor);
  if (!window) return null;
  const [lo, hi] = [toMinutes(window.start), toMinutes(window.end)];
  const a = floorStep(anchor);

  if (current >= anchor) {
    const end = Math.min(Math.max(floorStep(current) + STEP, a + MIN), a + MAX, hi);
    const start = Math.max(Math.min(a, end - MIN), lo);
    return toRange(start, end);
  }

  const end = Math.min(Math.max(a + STEP, floorStep(current) + MIN), hi);
  const start = Math.max(floorStep(current), end - MAX, lo);
  return toRange(start, Math.max(end, start + MIN));
}

/** Start of the first free window, i.e. not before opening time nor before "now" today. */
function earliestBookableMinute(ctx: DayContext): number {
  const first = buildAgenda(ctx).find((item) => item.kind === 'free');
  return first ? toMinutes(first.start) : DAY_END;
}

/** Moves the range by one step (skipping over bookings), keeping its duration. */
export function shiftStart(ctx: DayContext, range: TimeRange, direction: 1 | -1): TimeRange | null {
  const duration = toMinutes(range.end) - toMinutes(range.start);
  const bookings = ctx.bookings.filter((b) => b.date === ctx.date && b.id !== ctx.excludeId);
  const earliest = earliestBookableMinute(ctx);

  for (
    let start = toMinutes(range.start) + direction * STEP;
    start >= earliest && start + duration <= DAY_END;
    start += direction * STEP
  ) {
    const candidate = toRange(start, start + duration);
    if (!bookings.some((b) => overlaps(candidate, b))) return candidate;
  }
  return null;
}
