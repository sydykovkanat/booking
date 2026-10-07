import { describe, expect, it } from 'vitest';

import type { Booking } from './booking';
import { buildAgenda, buildSlotRows, endOptions, findNearestFreeSlot, startOptions } from './schedule';

const DATE = '2026-10-08';
const TOMORROW_NOW = { date: '2026-10-07', minutes: 12 * 60 };
const booking = (id: string, start: string, end: string): Booking => ({ id, date: DATE, start, end });

describe('buildAgenda', () => {
  it('returns one free window for an empty future day', () => {
    expect(buildAgenda({ date: DATE, bookings: [], now: TOMORROW_NOW })).toEqual([
      { kind: 'free', start: '09:00', end: '18:00' },
    ]);
  });

  it('interleaves bookings and free windows in order, skipping touching gaps', () => {
    const bookings = [booking('b', '13:00', '14:00'), booking('a', '10:00', '11:00'), booking('c', '11:00', '12:00')];
    const agenda = buildAgenda({ date: DATE, bookings, now: TOMORROW_NOW });

    expect(agenda.map((i) => (i.kind === 'free' ? `free ${i.start}-${i.end}` : `${i.booking.id} ${i.phase}`))).toEqual([
      'free 09:00-10:00',
      'a upcoming',
      'c upcoming',
      'free 12:00-13:00',
      'b upcoming',
      'free 14:00-18:00',
    ]);
  });

  it('omits free windows shorter than the minimum duration', () => {
    const bookings = [booking('a', '09:15', '10:00'), booking('b', '10:15', '17:45')];
    const agenda = buildAgenda({ date: DATE, bookings, now: TOMORROW_NOW });
    expect(agenda.filter((i) => i.kind === 'free')).toEqual([]);
  });

  it('clips free time to now (rounded up to the step) for today', () => {
    const agenda = buildAgenda({
      date: DATE,
      bookings: [booking('a', '10:00', '11:00'), booking('b', '14:00', '15:00')],
      now: { date: DATE, minutes: 12 * 60 + 5 },
    });

    expect(agenda.map((i) => (i.kind === 'free' ? `free ${i.start}-${i.end}` : `${i.booking.id} ${i.phase}`))).toEqual([
      'a past',
      'free 12:15-14:00',
      'b upcoming',
      'free 15:00-18:00',
    ]);
  });

  it('has no free windows on a past date', () => {
    const agenda = buildAgenda({
      date: DATE,
      bookings: [booking('a', '10:00', '11:00')],
      now: { date: '2026-10-09', minutes: 0 },
    });
    expect(agenda).toEqual([{ kind: 'booking', booking: booking('a', '10:00', '11:00'), phase: 'past' }]);
  });
});

describe('startOptions', () => {
  it('lists every step from opening to the last bookable start', () => {
    const options = startOptions({ date: DATE, bookings: [], now: TOMORROW_NOW });
    expect(options[0]).toEqual({ value: '09:00', status: 'available' });
    expect(options.at(-1)).toEqual({ value: '17:30', status: 'available' });
    expect(options).toHaveLength(35);
  });

  it('marks past and busy starts', () => {
    const options = startOptions({
      date: DATE,
      bookings: [booking('a', '13:00', '14:00')],
      now: { date: DATE, minutes: 12 * 60 + 5 },
    });
    const byValue = Object.fromEntries(options.map((o) => [o.value, o.status]));

    expect(byValue['12:00']).toBe('past');
    expect(byValue['12:15']).toBe('available');
    expect(byValue['13:00']).toBe('busy');
    expect(byValue['13:45']).toBe('busy');
    expect(byValue['14:00']).toBe('available');
  });

  it('ignores the booking being edited', () => {
    const original = booking('a', '13:00', '14:00');
    const options = startOptions({ date: DATE, bookings: [original], now: TOMORROW_NOW, excludeId: 'a' });
    expect(options.find((o) => o.value === '13:00')?.status).toBe('available');
  });
});

describe('endOptions', () => {
  it('offers 30 minutes to 2 hours after start', () => {
    const options = endOptions('10:00', { date: DATE, bookings: [], now: TOMORROW_NOW });
    expect(options.map((o) => o.value)).toEqual([
      '10:30',
      '10:45',
      '11:00',
      '11:15',
      '11:30',
      '11:45',
      '12:00',
    ]);
  });

  it('never goes past closing time', () => {
    const options = endOptions('17:00', { date: DATE, bookings: [], now: TOMORROW_NOW });
    expect(options.map((o) => o.value)).toEqual(['17:30', '17:45', '18:00']);
  });

  it('marks ends that would overlap a booking as busy', () => {
    const options = endOptions('10:00', { date: DATE, bookings: [booking('a', '11:00', '12:00')], now: TOMORROW_NOW });
    const byValue = Object.fromEntries(options.map((o) => [o.value, o.status]));
    expect(byValue['11:00']).toBe('available');
    expect(byValue['11:15']).toBe('busy');
  });

  it('marks ends that are not after now as past (extending an ongoing booking)', () => {
    const options = endOptions('10:00', { date: DATE, bookings: [], now: { date: DATE, minutes: 10 * 60 + 40 } });
    const byValue = Object.fromEntries(options.map((o) => [o.value, o.status]));
    expect(byValue['10:30']).toBe('past');
    expect(byValue['10:45']).toBe('available');
  });

  it('returns nothing for an invalid start', () => {
    expect(endOptions('', { date: DATE, bookings: [], now: TOMORROW_NOW })).toEqual([]);
  });
});

describe('findNearestFreeSlot', () => {
  const ctx = (bookings: Booking[], now = TOMORROW_NOW) => ({ date: DATE, bookings, now });

  it('finds the closest slot of the same duration', () => {
    const slot = findNearestFreeSlot({ start: '10:00', end: '11:00' }, ctx([booking('a', '10:00', '11:00')]));
    expect(slot).toEqual({ start: '11:00', end: '12:00' });
  });

  it('prefers an earlier slot when it is closer', () => {
    const slot = findNearestFreeSlot(
      { start: '10:30', end: '11:30' },
      ctx([booking('a', '10:30', '11:30'), booking('b', '11:30', '13:00')]),
    );
    expect(slot).toEqual({ start: '09:30', end: '10:30' });
  });

  it('does not suggest the past', () => {
    const slot = findNearestFreeSlot(
      { start: '12:00', end: '13:00' },
      ctx([booking('a', '12:00', '13:00')], { date: DATE, minutes: 11 * 60 + 50 }),
    );
    expect(slot).toEqual({ start: '13:00', end: '14:00' });
  });

  it('returns null when nothing fits', () => {
    const slot = findNearestFreeSlot({ start: '10:00', end: '12:00' }, ctx([booking('a', '09:00', '17:00')]));
    expect(slot).toBeNull();
  });

  it('ignores the booking being edited', () => {
    const slot = findNearestFreeSlot(
      { start: '10:00', end: '11:00' },
      { ...ctx([booking('a', '10:00', '11:00'), booking('b', '11:00', '12:00')]), excludeId: 'a' },
    );
    expect(slot).toEqual({ start: '10:00', end: '11:00' });
  });
});

describe('buildSlotRows', () => {
  const describeRows = (rows: ReturnType<typeof buildSlotRows>) =>
    rows.map((r) => (r.kind === 'start' ? r.value : `busy ${r.booking.id}`));

  it('lists free starts and collapses each booking into one row', () => {
    const rows = buildSlotRows({
      date: DATE,
      bookings: [booking('a', '10:00', '11:00'), booking('b', '16:00', '18:00')],
      now: TOMORROW_NOW,
    });
    expect(describeRows(rows)).toEqual([
      '09:00', '09:15', '09:30',
      'busy a',
      '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00',
      '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30',
      'busy b',
    ]);
  });

  it('drops past starts and past bookings for today', () => {
    const rows = buildSlotRows({
      date: DATE,
      bookings: [booking('a', '09:00', '10:00')],
      now: { date: DATE, minutes: 17 * 60 },
    });
    expect(describeRows(rows)).toEqual(['17:00', '17:15', '17:30']);
  });
});
