import { describe, expect, it } from 'vitest';

import { ceilToStep, fromMinutes, getRoomNow, isValidIsoDate, isValidTime, toMinutes } from './time';

describe('isValidTime', () => {
  it.each(['00:00', '09:00', '17:45', '23:59'])('accepts %s', (value) => {
    expect(isValidTime(value)).toBe(true);
  });

  it.each(['9:00', '24:00', '12:60', '12-00', '', ' 12:00', '12:00:00'])('rejects %j', (value) => {
    expect(isValidTime(value)).toBe(false);
  });
});

describe('isValidIsoDate', () => {
  it.each(['2026-10-07', '2024-02-29'])('accepts %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  it.each(['2026-13-01', '2026-02-30', '2025-02-29', '2026-1-7', '07.10.2026', ''])('rejects %j', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe('toMinutes / fromMinutes', () => {
  it('converts both ways', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(fromMinutes(570)).toBe('09:30');
    expect(fromMinutes(0)).toBe('00:00');
    expect(fromMinutes(1080)).toBe('18:00');
  });
});

describe('ceilToStep', () => {
  it.each([
    [800, 15, 810],
    [810, 15, 810],
    [811, 15, 825],
    [0, 15, 0],
  ])('ceilToStep(%i, %i) = %i', (value, step, expected) => {
    expect(ceilToStep(value, step)).toBe(expected);
  });
});

describe('getRoomNow', () => {
  it('returns date and minutes in the room time zone', () => {
    // 2026-10-07T19:30Z is 2026-10-08 01:30 in Bishkek (UTC+6)
    const now = getRoomNow(new Date('2026-10-07T19:30:00Z'), 'Asia/Bishkek');
    expect(now).toEqual({ date: '2026-10-08', minutes: 90 });
  });

  it('works for a time zone behind UTC', () => {
    const now = getRoomNow(new Date('2026-10-07T03:00:00Z'), 'America/New_York');
    expect(now).toEqual({ date: '2026-10-06', minutes: 23 * 60 });
  });
});
