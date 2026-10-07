import { describe, expect, it } from 'vitest';

import type { Booking, BookingInput } from './booking';
import { getBookingPhase, normalizeInput, validateBooking, type ValidationContext } from './rules';

const DATE = '2026-10-08';

const booking = (id: string, start: string, end: string, date = DATE): Booking => ({ id, date, start, end });

const input = (start: string, end: string, extra: Partial<BookingInput> = {}): BookingInput => ({
  date: DATE,
  start,
  end,
  ...extra,
});

/** Context where DATE is tomorrow, so the past rule never interferes. */
const future = (existing: Booking[] = []): ValidationContext => ({
  now: { date: '2026-10-07', minutes: 12 * 60 },
  existing,
});

const codes = (result: ReturnType<typeof validateBooking>) => result.map((v) => `${v.field}:${v.code}`);

describe('validateBooking — format', () => {
  it('rejects malformed date and time without running other rules', () => {
    expect(codes(validateBooking(input('9:00', '10:00', { date: '2026-02-30' }), future()))).toEqual([
      'date:INVALID_DATE',
      'start:INVALID_TIME',
    ]);
  });

  it('rejects times off the 15-minute grid', () => {
    expect(codes(validateBooking(input('09:10', '10:00'), future()))).toEqual(['start:INVALID_STEP']);
    expect(codes(validateBooking(input('09:00', '10:05'), future()))).toEqual(['end:INVALID_STEP']);
  });

  it('rejects a title longer than 100 characters', () => {
    expect(codes(validateBooking(input('09:00', '10:00', { title: 'x'.repeat(101) }), future()))).toEqual([
      'title:TITLE_TOO_LONG',
    ]);
    expect(validateBooking(input('09:00', '10:00', { title: 'x'.repeat(100) }), future())).toEqual([]);
  });
});

describe('validateBooking — working hours and duration', () => {
  it.each([
    ['09:00', '09:30'],
    ['16:00', '18:00'],
    ['17:30', '18:00'],
    ['10:00', '12:00'],
  ])('accepts %s–%s', (start, end) => {
    expect(validateBooking(input(start, end), future())).toEqual([]);
  });

  it.each([
    ['08:45', '09:30', 'start:OUTSIDE_WORKING_HOURS'],
    ['17:30', '18:15', 'end:OUTSIDE_WORKING_HOURS'],
    ['10:00', '10:00', 'end:START_NOT_BEFORE_END'],
    ['11:00', '10:00', 'end:START_NOT_BEFORE_END'],
    ['10:00', '10:15', 'end:TOO_SHORT'],
    ['10:00', '12:15', 'end:TOO_LONG'],
  ])('rejects %s–%s with %s', (start, end, expected) => {
    expect(codes(validateBooking(input(start, end), future()))).toEqual([expected]);
  });
});

describe('validateBooking — overlaps', () => {
  const existing = [booking('a', '10:00', '11:00'), booking('b', '13:00', '14:00')];

  it('treats touching boundaries as free', () => {
    expect(validateBooking(input('11:00', '12:00'), future(existing))).toEqual([]);
    expect(validateBooking(input('09:00', '10:00'), future(existing))).toEqual([]);
    expect(validateBooking(input('11:00', '13:00'), future(existing))).toEqual([]);
  });

  it.each([
    ['10:30', '11:30'],
    ['09:30', '10:30'],
    ['10:15', '10:45'],
    ['09:30', '11:30'],
  ])('reports conflict for %s–%s', (start, end) => {
    const result = validateBooking(input(start, end), future(existing));
    expect(codes(result)).toEqual(['start:CONFLICT']);
    expect(result[0].conflicts).toEqual([existing[0]]);
  });

  it('lists every conflicting booking', () => {
    const result = validateBooking(input('10:30', '12:30'), future([...existing, booking('c', '12:00', '13:00')]));
    expect(result[0].conflicts?.map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('ignores bookings on other dates', () => {
    expect(validateBooking(input('10:00', '11:00'), future([booking('x', '10:00', '11:00', '2026-10-09')]))).toEqual(
      [],
    );
  });

  it('does not conflict with itself when editing', () => {
    const original = existing[0];
    const ctx = { ...future(existing), original };
    expect(validateBooking(input('10:00', '11:30'), ctx)).toEqual([]);
    expect(codes(validateBooking(input('10:00', '13:30'), ctx))).toEqual(['end:TOO_LONG']);
    expect(codes(validateBooking(input('12:30', '13:30'), ctx))).toEqual(['start:CONFLICT']);
  });
});

describe('validateBooking — past', () => {
  const today = (minutes: number, existing: Booking[] = []): ValidationContext => ({
    now: { date: DATE, minutes },
    existing,
  });

  it('rejects any booking on a past date', () => {
    const ctx: ValidationContext = { now: { date: '2026-10-09', minutes: 0 }, existing: [] };
    expect(codes(validateBooking(input('10:00', '11:00'), ctx))).toEqual(['date:IN_PAST']);
  });

  it('rejects a start before now on today', () => {
    // now = 13:20
    expect(codes(validateBooking(input('13:15', '14:00'), today(800)))).toEqual(['start:IN_PAST']);
    expect(validateBooking(input('13:30', '14:00'), today(800))).toEqual([]);
  });

  it('allows a start exactly at now', () => {
    expect(validateBooking(input('13:30', '14:00'), today(810))).toEqual([]);
  });
});

describe('validateBooking — editing by phase', () => {
  const now = { date: DATE, minutes: 10 * 60 + 30 }; // 10:30

  it('locks a booking that has already ended', () => {
    const original = booking('a', '09:00', '10:00');
    const ctx: ValidationContext = { now, existing: [original], original };
    expect(codes(validateBooking(input('09:00', '10:00', { title: 'new' }), ctx))).toEqual(['start:BOOKING_LOCKED']);
  });

  it('lets an ongoing booking change only its end, which must be after now', () => {
    const original = booking('a', '10:00', '11:00');
    const ctx: ValidationContext = { now, existing: [original], original };

    expect(validateBooking(input('10:00', '11:30'), ctx)).toEqual([]);
    expect(validateBooking(input('10:00', '11:00', { title: 'renamed' }), ctx)).toEqual([]);
    expect(codes(validateBooking(input('10:00', '10:30'), ctx))).toEqual(['end:IN_PAST']);
    expect(codes(validateBooking(input('10:45', '11:30'), ctx))).toEqual(['start:BOOKING_LOCKED']);
    expect(codes(validateBooking(input('10:00', '11:00', { date: '2026-10-09' }), ctx))).toEqual([
      'date:BOOKING_LOCKED',
    ]);
  });

  it('allows moving an upcoming booking to another date', () => {
    const original = booking('a', '15:00', '16:00');
    const ctx: ValidationContext = { now, existing: [original], original };
    expect(validateBooking(input('15:00', '16:00', { date: '2026-10-09' }), ctx)).toEqual([]);
  });
});

describe('getBookingPhase', () => {
  const b = booking('a', '10:00', '11:00');

  it.each([
    [{ date: '2026-10-07', minutes: 0 }, 'upcoming'],
    [{ date: DATE, minutes: 599 }, 'upcoming'],
    [{ date: DATE, minutes: 600 }, 'ongoing'],
    [{ date: DATE, minutes: 659 }, 'ongoing'],
    [{ date: DATE, minutes: 660 }, 'past'],
    [{ date: '2026-10-09', minutes: 0 }, 'past'],
  ] as const)('at %o is %s', (now, phase) => {
    expect(getBookingPhase(b, now)).toBe(phase);
  });
});

describe('normalizeInput', () => {
  it('trims the title and drops it when empty', () => {
    expect(normalizeInput(input('10:00', '11:00', { title: '  Sync  ' })).title).toBe('Sync');
    expect(normalizeInput(input('10:00', '11:00', { title: '   ' }))).not.toHaveProperty('title');
    expect(normalizeInput(input('10:00', '11:00'))).not.toHaveProperty('title');
  });
});
