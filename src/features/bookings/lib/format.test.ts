import { describe, expect, it } from 'vitest';

import { formatDayTitle, formatDuration } from './format';

const now = { date: '2026-10-07', minutes: 600 };

describe('formatDuration', () => {
  it.each([
    [30, '30 мин'],
    [60, '1 ч'],
    [90, '1 ч 30 мин'],
    [0, '0 мин'],
  ])('%i → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatDayTitle', () => {
  it('uses relative names around today', () => {
    expect(formatDayTitle('2026-10-07', now)).toBe('Сегодня, 7 октября');
    expect(formatDayTitle('2026-10-08', now)).toBe('Завтра, 8 октября');
    expect(formatDayTitle('2026-10-06', now)).toBe('Вчера, 6 октября');
  });

  it('uses the weekday further away and the year when it differs', () => {
    expect(formatDayTitle('2026-10-09', now)).toBe('Пятница, 9 октября');
    expect(formatDayTitle('2027-01-04', now)).toBe('Понедельник, 4 января 2027');
  });

  it('has a short variant for narrow screens', () => {
    expect(formatDayTitle('2026-10-08', now, { short: true })).toBe('Завтра, 8 окт.');
  });
});
