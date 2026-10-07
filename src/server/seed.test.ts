import { describe, expect, it } from 'vitest';

import { validateBooking } from '@/domain/rules';

import { createSeed } from './seed';

describe('createSeed', () => {
  it('produces bookings that satisfy the rules relative to now', () => {
    const seed = createSeed({ date: '2026-10-07', minutes: 8 * 60 });
    expect(seed.map((b) => b.date)).toContain('2026-10-06');

    for (const booking of seed) {
      const others = seed.filter((b) => b.id !== booking.id);
      // Validate as if it were created a day earlier, so the past rule does not interfere.
      const violations = validateBooking(booking, { now: { date: '2026-10-01', minutes: 0 }, existing: others });
      expect(violations).toEqual([]);
    }
  });
});
