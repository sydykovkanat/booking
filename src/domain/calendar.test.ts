import { describe, expect, it } from 'vitest';

import { monthGrid, shiftAnchor, startOfWeek, visibleRange, weekDays } from './calendar';

describe('startOfWeek', () => {
  it.each([
    ['2026-10-08', '2026-10-05'], // Thursday
    ['2026-10-05', '2026-10-05'], // Monday
    ['2026-10-11', '2026-10-05'], // Sunday belongs to the week that started on Monday
    ['2026-11-01', '2026-10-26'], // across a month boundary
  ])('%s → %s', (date, expected) => {
    expect(startOfWeek(date)).toBe(expected);
  });
});

describe('weekDays', () => {
  it('returns Monday to Sunday', () => {
    expect(weekDays('2026-10-08')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
  });
});

describe('monthGrid', () => {
  it('is always 6 full weeks starting on the Monday on or before the 1st', () => {
    const grid = monthGrid('2026-10-17');
    expect(grid).toHaveLength(6);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0][0]).toBe('2026-09-28');
    expect(grid[5][6]).toBe('2026-11-08');
  });

  it('starts on the 1st when the month begins on a Monday', () => {
    expect(monthGrid('2027-02-10')[0][0]).toBe('2027-02-01');
  });
});

describe('visibleRange', () => {
  it.each([
    ['month', { from: '2026-09-28', to: '2026-11-08' }],
    ['week', { from: '2026-10-05', to: '2026-10-11' }],
    ['day', { from: '2026-10-08', to: '2026-10-08' }],
  ] as const)('%s', (view, expected) => {
    expect(visibleRange(view, '2026-10-08')).toEqual(expected);
  });
});

describe('shiftAnchor', () => {
  it('moves by a day, a week or a month', () => {
    expect(shiftAnchor('day', '2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftAnchor('week', '2026-10-08', -1)).toBe('2026-10-01');
    expect(shiftAnchor('month', '2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
  });
});
