import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Booking } from '@/domain/booking';

import { ApiError } from './api-error';
import { createHttpBookingsApi } from './bookings-api';

const BASE = 'http://api.test';
const booking: Booking = { id: '1', date: '2026-10-09', start: '10:00', end: '11:00', title: 'Sync' };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const api = createHttpBookingsApi({ baseUrl: BASE, timeoutMs: 200 });

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the promise to reject');
}

describe('httpBookingsApi — success', () => {
  it('lists bookings for a date', async () => {
    server.use(
      http.get(`${BASE}/api/bookings`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('date')).toBe('2026-10-09');
        return HttpResponse.json([booking]);
      }),
    );
    expect(await api.list('2026-10-09')).toEqual([booking]);
  });

  it('creates, updates and removes', async () => {
    server.use(
      http.post(`${BASE}/api/bookings`, async ({ request }) =>
        HttpResponse.json({ ...(await request.json()) as object, id: '1' }, { status: 201 }),
      ),
      http.patch(`${BASE}/api/bookings/1`, async ({ request }) =>
        HttpResponse.json({ ...booking, ...((await request.json()) as object) }),
      ),
      http.delete(`${BASE}/api/bookings/1`, () => new HttpResponse(null, { status: 204 })),
    );

    const { id: _, ...input } = booking;
    expect(await api.create(input)).toEqual(booking);
    expect(await api.update('1', { title: 'New' })).toEqual({ ...booking, title: 'New' });
    await expect(api.remove('1')).resolves.toBeUndefined();
  });

  it('encodes the id in the URL', async () => {
    server.use(http.delete(`${BASE}/api/bookings/a%2Fb`, () => new HttpResponse(null, { status: 204 })));
    await expect(api.remove('a/b')).resolves.toBeUndefined();
  });
});

describe('httpBookingsApi — errors', () => {
  it('maps 409 to a conflict error with the conflicting bookings', async () => {
    server.use(
      http.post(`${BASE}/api/bookings`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'overlap', fields: { start: 'CONFLICT' }, conflicts: [booking] } },
          { status: 409 },
        ),
      ),
    );

    const error = await catchError(api.create({ date: '2026-10-09', start: '10:30', end: '11:30' }));
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', fields: { start: 'CONFLICT' }, conflicts: [booking] });
    expect(error.isConflict).toBe(true);
  });

  it('maps 404 to NOT_FOUND', async () => {
    server.use(
      http.delete(`${BASE}/api/bookings/1`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'gone' } }, { status: 404 }),
      ),
    );
    expect(await catchError(api.remove('1'))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('falls back to HTTP_ERROR when the error body is not ours', async () => {
    server.use(http.get(`${BASE}/api/bookings`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })));
    expect(await catchError(api.list('2026-10-09'))).toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('rejects a success response with an unexpected shape', async () => {
    server.use(http.get(`${BASE}/api/bookings`, () => HttpResponse.json([{ id: 1 }])));
    expect(await catchError(api.list('2026-10-09'))).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('maps a network failure to NETWORK', async () => {
    server.use(http.get(`${BASE}/api/bookings`, () => HttpResponse.error()));
    expect(await catchError(api.list('2026-10-09'))).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('times out slow requests', async () => {
    server.use(
      http.get(`${BASE}/api/bookings`, async () => {
        await delay(1_000);
        return HttpResponse.json([]);
      }),
    );
    expect(await catchError(api.list('2026-10-09'))).toMatchObject({ code: 'TIMEOUT' });
  });

  it('propagates caller cancellation as an AbortError', async () => {
    server.use(
      http.get(`${BASE}/api/bookings`, async () => {
        await delay(1_000);
        return HttpResponse.json([]);
      }),
    );
    const controller = new AbortController();
    const promise = api.list('2026-10-09', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
