import { describe, expect, it } from 'vitest';

import type { Booking } from './booking';
import { findFreeWindow, rangeAtMinute, rangeFromDrag, shiftStart } from './selection';

const DATE = '2026-10-08';
const TOMORROW_NOW = { date: '2026-10-07', minutes: 12 * 60 };
const booking = (id: string, start: string, end: string): Booking => ({ id, date: DATE, start, end });
const ctx = (bookings: Booking[] = [], now = TOMORROW_NOW) => ({ date: DATE, bookings, now });
const m = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

describe('findFreeWindow', () => {
  it('returns the free window containing the minute', () => {
    const c = ctx([booking('a', '10:00', '11:00')]);
    expect(findFreeWindow(c, m('09:20'))).toEqual({ start: '09:00', end: '10:00' });
    expect(findFreeWindow(c, m('13:00'))).toEqual({ start: '11:00', end: '18:00' });
    expect(findFreeWindow(c, m('10:30'))).toBeNull();
  });

  it('ignores the past part of today', () => {
    expect(findFreeWindow(ctx([], { date: DATE, minutes: m('12:10') }), m('11:00'))).toBeNull();
  });
});

describe('rangeAtMinute (tap / click)', () => {
  it('starts at the tapped quarter hour and lasts an hour', () => {
    expect(rangeAtMinute(ctx(), m('13:40'))).toEqual({ start: '13:30', end: '14:30' });
  });

  it('stops at the next booking and keeps the minimum duration', () => {
    const c = ctx([booking('a', '14:00', '15:00')]);
    expect(rangeAtMinute(c, m('13:20'))).toEqual({ start: '13:15', end: '14:00' });
    expect(rangeAtMinute(c, m('13:50'))).toEqual({ start: '13:30', end: '14:00' });
  });

  it('stays inside the working day', () => {
    expect(rangeAtMinute(ctx(), m('17:50'))).toEqual({ start: '17:30', end: '18:00' });
  });

  it('returns null on a booked or past minute', () => {
    expect(rangeAtMinute(ctx([booking('a', '10:00', '11:00')]), m('10:30'))).toBeNull();
  });
});

describe('rangeFromDrag', () => {
  const c = ctx([booking('a', '14:00', '15:00')]);

  it('covers the dragged quarter hours, at least 30 minutes', () => {
    expect(rangeFromDrag(c, m('11:05'), m('12:20'))).toEqual({ start: '11:00', end: '12:30' });
    expect(rangeFromDrag(c, m('11:05'), m('11:05'))).toEqual({ start: '11:00', end: '11:30' });
  });

  it('works when dragging upwards', () => {
    expect(rangeFromDrag(c, m('12:40'), m('11:10'))).toEqual({ start: '11:00', end: '12:45' });
  });

  it('is capped at 2 hours from the anchor', () => {
    expect(rangeFromDrag(c, m('09:00'), m('13:30'))).toEqual({ start: '09:00', end: '11:00' });
    expect(rangeFromDrag(c, m('13:50'), m('09:00'))).toEqual({ start: '12:00', end: '14:00' });
  });

  it('never crosses a booking', () => {
    expect(rangeFromDrag(c, m('13:00'), m('16:00'))).toEqual({ start: '13:00', end: '14:00' });
  });

  it('returns null when the drag starts on a booking', () => {
    expect(rangeFromDrag(c, m('14:30'), m('16:00'))).toBeNull();
  });
});

describe('shiftStart', () => {
  const c = ctx([booking('a', '14:00', '15:00')]);

  it('moves by a step and keeps the duration', () => {
    expect(shiftStart(c, { start: '11:00', end: '12:00' }, 1)).toEqual({ start: '11:15', end: '12:15' });
    expect(shiftStart(c, { start: '11:00', end: '12:00' }, -1)).toEqual({ start: '10:45', end: '11:45' });
  });

  it('jumps over a booking', () => {
    expect(shiftStart(c, { start: '13:00', end: '14:00' }, 1)).toEqual({ start: '15:00', end: '16:00' });
  });

  it('returns null at the edge of the day', () => {
    expect(shiftStart(c, { start: '09:00', end: '10:00' }, -1)).toBeNull();
    expect(shiftStart(c, { start: '17:00', end: '18:00' }, 1)).toBeNull();
  });
});
