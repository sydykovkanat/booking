import type { Booking, BookingInput, BookingPhase, RoomNow } from './booking';
import { BOOKING_RULES } from './config';
import { findConflicts } from './overlap';
import { isValidIsoDate, isValidTime, toMinutes } from './time';

export const BOOKING_FIELDS = ['date', 'start', 'end', 'title'] as const;
export type BookingField = (typeof BOOKING_FIELDS)[number];

export const BOOKING_VIOLATION_CODES = [
  'INVALID_DATE',
  'INVALID_TIME',
  'INVALID_STEP',
  'OUTSIDE_WORKING_HOURS',
  'START_NOT_BEFORE_END',
  'TOO_SHORT',
  'TOO_LONG',
  'IN_PAST',
  'BOOKING_LOCKED',
  'CONFLICT',
  'TITLE_TOO_LONG',
] as const;
export type BookingViolationCode = (typeof BOOKING_VIOLATION_CODES)[number];

export interface BookingViolation {
  field: BookingField;
  code: BookingViolationCode;
  conflicts?: Booking[];
}

export interface ValidationContext {
  now: RoomNow;
  /** Bookings already stored; only those on the input date matter. */
  existing: readonly Booking[];
  /** The booking being edited, if any. It never conflicts with itself. */
  original?: Booking;
}

const violation = (field: BookingField, code: BookingViolationCode): BookingViolation => ({ field, code });

export function getBookingPhase(booking: Pick<Booking, 'date' | 'start' | 'end'>, now: RoomNow): BookingPhase {
  if (booking.date < now.date) return 'past';
  if (booking.date > now.date) return 'upcoming';
  if (now.minutes >= toMinutes(booking.end)) return 'past';
  if (now.minutes >= toMinutes(booking.start)) return 'ongoing';
  return 'upcoming';
}

export function normalizeInput(input: BookingInput): BookingInput {
  const { title, ...rest } = input;
  const trimmed = title?.trim();
  return trimmed ? { ...rest, title: trimmed } : rest;
}

function checkFormat(input: BookingInput): BookingViolation[] {
  const result: BookingViolation[] = [];
  if (!isValidIsoDate(input.date)) result.push(violation('date', 'INVALID_DATE'));
  if (!isValidTime(input.start)) result.push(violation('start', 'INVALID_TIME'));
  if (!isValidTime(input.end)) result.push(violation('end', 'INVALID_TIME'));
  if ((input.title?.trim().length ?? 0) > BOOKING_RULES.titleMaxLength) {
    result.push(violation('title', 'TITLE_TOO_LONG'));
  }
  return result;
}

function checkStep(input: BookingInput): BookingViolation[] {
  const offGrid = (time: string) => toMinutes(time) % BOOKING_RULES.stepMinutes !== 0;
  const result: BookingViolation[] = [];
  if (offGrid(input.start)) result.push(violation('start', 'INVALID_STEP'));
  if (offGrid(input.end)) result.push(violation('end', 'INVALID_STEP'));
  return result;
}

function checkRange(input: BookingInput): BookingViolation[] {
  const start = toMinutes(input.start);
  const end = toMinutes(input.end);
  const result: BookingViolation[] = [];

  if (start < toMinutes(BOOKING_RULES.workStart)) result.push(violation('start', 'OUTSIDE_WORKING_HOURS'));
  if (end > toMinutes(BOOKING_RULES.workEnd)) result.push(violation('end', 'OUTSIDE_WORKING_HOURS'));
  if (result.length > 0) return result;

  const duration = end - start;
  if (duration <= 0) return [violation('end', 'START_NOT_BEFORE_END')];
  if (duration < BOOKING_RULES.minDurationMinutes) return [violation('end', 'TOO_SHORT')];
  if (duration > BOOKING_RULES.maxDurationMinutes) return [violation('end', 'TOO_LONG')];
  return [];
}

/**
 * Time-related restrictions: no new bookings in the past, ended bookings are read-only,
 * an ongoing booking may only move its end (which must stay in the future).
 */
function checkTimeline(input: BookingInput, { now, original }: ValidationContext): BookingViolation[] {
  const phase = original ? getBookingPhase(original, now) : 'upcoming';

  if (phase === 'past') return [violation('start', 'BOOKING_LOCKED')];

  if (phase === 'ongoing' && original) {
    if (input.date !== original.date) return [violation('date', 'BOOKING_LOCKED')];
    if (input.start !== original.start) return [violation('start', 'BOOKING_LOCKED')];
    return toMinutes(input.end) <= now.minutes ? [violation('end', 'IN_PAST')] : [];
  }

  if (input.date < now.date) return [violation('date', 'IN_PAST')];
  if (input.date === now.date && toMinutes(input.start) < now.minutes) return [violation('start', 'IN_PAST')];
  return [];
}

function checkConflicts(input: BookingInput, ctx: ValidationContext): BookingViolation[] {
  const conflicts = findConflicts(input, ctx.existing, ctx.original?.id);
  return conflicts.length > 0 ? [{ field: 'start', code: 'CONFLICT', conflicts }] : [];
}

/**
 * Validates a booking against all business rules. Shared by the form and the API so both
 * sides agree on what is valid. Returns an empty array when the input is acceptable.
 */
export function validateBooking(input: BookingInput, ctx: ValidationContext): BookingViolation[] {
  const stages = [checkFormat, checkStep, checkRange, checkTimeline, checkConflicts] as const;

  for (const stage of stages) {
    const result = stage(input, ctx);
    if (result.length > 0) return result;
  }
  return [];
}
