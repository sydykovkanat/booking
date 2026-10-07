import type { Booking, BookingPhase, IsoDate, RoomNow, TimeRange, TimeString } from './booking';
import { BOOKING_RULES } from './config';
import { overlaps } from './overlap';
import { getBookingPhase } from './rules';
import { ceilToStep, fromMinutes, isValidTime, toMinutes } from './time';

export interface DayContext {
  date: IsoDate;
  bookings: readonly Booking[];
  now: RoomNow;
  /** Booking being edited; treated as absent. */
  excludeId?: string;
}

export type AgendaItem =
  | { kind: 'booking'; booking: Booking; phase: BookingPhase }
  | { kind: 'free'; start: TimeString; end: TimeString };

export type SlotStatus = 'available' | 'past' | 'busy';

export interface TimeOption {
  value: TimeString;
  status: SlotStatus;
}

const WORK_START = toMinutes(BOOKING_RULES.workStart);
const WORK_END = toMinutes(BOOKING_RULES.workEnd);
const STEP = BOOKING_RULES.stepMinutes;

/** First minute of the day at which a new booking may start. `Infinity` for past dates. */
function earliestBookableMinute(date: IsoDate, now: RoomNow): number {
  if (date < now.date) return Number.POSITIVE_INFINITY;
  if (date > now.date) return WORK_START;
  return Math.max(WORK_START, ceilToStep(now.minutes, STEP));
}

function dayBookings({ date, bookings, excludeId }: DayContext): Booking[] {
  return bookings
    .filter((b) => b.date === date && b.id !== excludeId)
    .toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

function isFree(range: TimeRange, bookings: readonly Booking[]): boolean {
  return !bookings.some((b) => overlaps(range, b));
}

/** Bookings of the day interleaved with bookable free windows, in chronological order. */
export function buildAgenda(ctx: DayContext): AgendaItem[] {
  const earliest = earliestBookableMinute(ctx.date, ctx.now);
  const items: AgendaItem[] = [];
  let cursor = WORK_START;

  const pushFree = (from: number, to: number) => {
    const start = Math.max(from, earliest);
    if (to - start >= BOOKING_RULES.minDurationMinutes) {
      items.push({ kind: 'free', start: fromMinutes(start), end: fromMinutes(to) });
    }
  };

  for (const booking of dayBookings(ctx)) {
    pushFree(cursor, toMinutes(booking.start));
    items.push({ kind: 'booking', booking, phase: getBookingPhase(booking, ctx.now) });
    cursor = Math.max(cursor, toMinutes(booking.end));
  }
  pushFree(cursor, WORK_END);

  return items;
}

export function startOptions(ctx: DayContext): TimeOption[] {
  const earliest = earliestBookableMinute(ctx.date, ctx.now);
  const bookings = dayBookings(ctx);
  const options: TimeOption[] = [];

  for (let m = WORK_START; m <= WORK_END - BOOKING_RULES.minDurationMinutes; m += STEP) {
    const value = fromMinutes(m);
    const minimal = { start: value, end: fromMinutes(m + BOOKING_RULES.minDurationMinutes) };
    const status: SlotStatus = m < earliest ? 'past' : isFree(minimal, bookings) ? 'available' : 'busy';
    options.push({ value, status });
  }
  return options;
}

export function endOptions(start: TimeString, ctx: DayContext): TimeOption[] {
  if (!isValidTime(start)) return [];

  const bookings = dayBookings(ctx);
  const from = toMinutes(start);
  const last = Math.min(from + BOOKING_RULES.maxDurationMinutes, WORK_END);
  const options: TimeOption[] = [];

  const isPast = (m: number) => ctx.date < ctx.now.date || (ctx.date === ctx.now.date && m <= ctx.now.minutes);

  for (let m = from + BOOKING_RULES.minDurationMinutes; m <= last; m += STEP) {
    const value = fromMinutes(m);
    const status: SlotStatus = isPast(m) ? 'past' : isFree({ start, end: value }, bookings) ? 'available' : 'busy';
    options.push({ value, status });
  }
  return options;
}

/** Closest free slot with the same duration as `desired`; ties go to the later slot. */
export function findNearestFreeSlot(desired: TimeRange, ctx: DayContext): TimeRange | null {
  const duration = toMinutes(desired.end) - toMinutes(desired.start);
  const target = toMinutes(desired.start);
  const bookings = dayBookings(ctx);
  let best: { range: TimeRange; distance: number } | null = null;

  for (let m = earliestBookableMinute(ctx.date, ctx.now); m + duration <= WORK_END; m += STEP) {
    const range = { start: fromMinutes(m), end: fromMinutes(m + duration) };
    const distance = Math.abs(m - target);
    if (isFree(range, bookings) && (!best || distance <= best.distance)) {
      best = { range, distance };
    }
  }
  return best?.range ?? null;
}
