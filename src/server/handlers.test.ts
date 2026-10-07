import { beforeEach, describe, expect, it } from 'vitest';

import type { Booking } from '@/domain/booking';

import { createBookingHandlers, type BookingHandlers } from './handlers';
import { createInMemoryRepository } from './repository';

const TODAY = '2026-10-08';
const TOMORROW = '2026-10-09';
// 2026-10-08 12:05 in Asia/Bishkek (UTC+6)
const NOW = new Date('2026-10-08T06:05:00Z');

const seed: Booking[] = [
  { id: 'past', date: TODAY, start: '09:00', end: '10:00', title: 'Standup' },
  { id: 'ongoing', date: TODAY, start: '11:30', end: '12:30' },
  { id: 'later', date: TOMORROW, start: '10:00', end: '11:00', title: 'Planning' },
];

const json = (method: string, body: unknown) =>
  new Request('http://test/api/bookings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

let handlers: BookingHandlers;

beforeEach(() => {
  handlers = createBookingHandlers({
    repository: createInMemoryRepository(seed),
    clock: () => NOW,
    timeZone: 'Asia/Bishkek',
  });
});

describe('GET /api/bookings', () => {
  it('returns bookings of the date sorted by start', async () => {
    const res = await handlers.list(new Request(`http://test/api/bookings?date=${TODAY}`));
    expect(res.status).toBe(200);
    expect((await res.json()).map((b: Booking) => b.id)).toEqual(['past', 'ongoing']);
  });

  it('returns an empty list for a free date', async () => {
    const res = await handlers.list(new Request('http://test/api/bookings?date=2026-12-01'));
    expect(await res.json()).toEqual([]);
  });

  it.each(['', '?date=tomorrow', '?date=2026-02-30'])('rejects %j with 400', async (query) => {
    const res = await handlers.list(new Request(`http://test/api/bookings${query}`));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/bookings?from=&to=', () => {
  const range = (query: string) => handlers.list(new Request(`http://test/api/bookings?${query}`));

  it('returns bookings of an inclusive date range sorted by date and start', async () => {
    const res = await range(`from=${TODAY}&to=${TOMORROW}`);
    expect(res.status).toBe(200);
    expect((await res.json()).map((b: Booking) => b.id)).toEqual(['past', 'ongoing', 'later']);
  });

  it.each([
    ['from=2026-10-09&to=2026-10-08', 'reversed'],
    ['from=2026-10-01', 'missing to'],
    ['from=2026-01-01&to=2026-12-31', 'too long'],
    ['from=bad&to=2026-10-08', 'invalid'],
  ])('rejects %s (%s) with 400', async (query) => {
    const res = await range(query);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/bookings', () => {
  it('creates a booking and trims the title', async () => {
    const res = await handlers.create(json('POST', { date: TOMORROW, start: '11:00', end: '12:00', title: ' Sync ' }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ date: TOMORROW, start: '11:00', end: '12:00', title: 'Sync' });
    expect(created.id).toEqual(expect.any(String));

    const list = await (await handlers.list(new Request(`http://test/api/bookings?date=${TOMORROW}`))).json();
    expect(list).toHaveLength(2);
  });

  it('returns 409 with the conflicting bookings', async () => {
    const res = await handlers.create(json('POST', { date: TOMORROW, start: '10:30', end: '11:30' }));
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error.code).toBe('CONFLICT');
    expect(error.fields).toEqual({ start: 'CONFLICT' });
    expect(error.conflicts.map((b: Booking) => b.id)).toEqual(['later']);
  });

  it('allows touching boundaries', async () => {
    const res = await handlers.create(json('POST', { date: TOMORROW, start: '11:00', end: '11:30' }));
    expect(res.status).toBe(201);
  });

  it('returns 422 with the field for a business rule violation', async () => {
    const res = await handlers.create(json('POST', { date: TOMORROW, start: '10:00', end: '12:30' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'TOO_LONG', fields: { end: 'TOO_LONG' } });
  });

  it('uses the server clock for the past rule', async () => {
    const res = await handlers.create(json('POST', { date: TODAY, start: '12:00', end: '13:00' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('IN_PAST');
  });

  it.each([
    ['malformed JSON', '{oops'],
    ['missing fields', { date: TOMORROW }],
    ['wrong types', { date: TOMORROW, start: 10, end: 11 }],
  ])('returns 400 for %s', async (_, body) => {
    const res = await handlers.create(json('POST', body));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('BAD_REQUEST');
  });
});

describe('PATCH /api/bookings/:id', () => {
  it('updates fields and does not conflict with itself', async () => {
    const res = await handlers.update(json('PATCH', { end: '12:00', title: 'Longer planning' }), 'later');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'later',
      date: TOMORROW,
      start: '10:00',
      end: '12:00',
      title: 'Longer planning',
    });
  });

  it('clears the title when an empty string is sent', async () => {
    const res = await handlers.update(json('PATCH', { title: '' }), 'later');
    expect(await res.json()).not.toHaveProperty('title');
  });

  it('can move a booking to another date', async () => {
    const res = await handlers.update(json('PATCH', { date: '2026-10-10' }), 'later');
    expect(res.status).toBe(200);
    const list = await (await handlers.list(new Request(`http://test/api/bookings?date=${TOMORROW}`))).json();
    expect(list).toEqual([]);
  });

  it('extends an ongoing booking but refuses to move its start', async () => {
    expect((await handlers.update(json('PATCH', { end: '13:00' }), 'ongoing')).status).toBe(200);

    const res = await handlers.update(json('PATCH', { start: '12:15' }), 'ongoing');
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('BOOKING_LOCKED');
  });

  it('refuses to edit a booking that has ended', async () => {
    const res = await handlers.update(json('PATCH', { title: 'x' }), 'past');
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('BOOKING_LOCKED');
  });

  it('returns 409 when moved onto another booking', async () => {
    await handlers.create(json('POST', { date: TOMORROW, start: '14:00', end: '15:00' }));
    const res = await handlers.update(json('PATCH', { start: '13:30', end: '14:30' }), 'later');
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await handlers.update(json('PATCH', { title: 'x' }), 'nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/bookings/:id', () => {
  it('deletes an upcoming booking', async () => {
    const res = await handlers.remove('later');
    expect(res.status).toBe(204);
    expect((await handlers.remove('later')).status).toBe(404);
  });

  it('deletes an ongoing booking', async () => {
    expect((await handlers.remove('ongoing')).status).toBe(204);
  });

  it('refuses to delete a booking that has ended', async () => {
    const res = await handlers.remove('past');
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('BOOKING_LOCKED');
  });
});
