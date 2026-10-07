import { describe, expect, it } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';

import { classifyServerError } from './server-feedback';

const attempted = { date: '2026-10-08', start: '11:00', end: '12:00', title: 'Ревью' };
const ours: Booking = { ...attempted, id: 'mine' };
const other: Booking = { id: 'c', date: '2026-10-08', start: '11:00', end: '12:00', title: 'Коллега' };
const ctx = { mode: 'create' as const, attempted, afterTransientFailure: false };
const conflict = (conflicts: Booking[]) => new ApiError({ status: 409, code: 'CONFLICT', message: 'x', conflicts });

describe('classifyServerError', () => {
  it('a conflict with someone else keeps the form and reports the bookings', () => {
    expect(classifyServerError(conflict([other]), ctx)).toEqual({ kind: 'conflict', conflicts: [other] });
  });

  it('a conflict with our own booking after a timeout counts as saved', () => {
    expect(classifyServerError(conflict([ours]), { ...ctx, afterTransientFailure: true })).toEqual({
      kind: 'saved',
      booking: ours,
    });
    // Without a preceding timeout an identical booking is someone else's.
    expect(classifyServerError(conflict([ours]), ctx).kind).toBe('conflict');
  });

  it('a 409 without a parsed body is a plain error, not an empty conflict', () => {
    const error = new ApiError({ status: 409, code: 'HTTP_ERROR', message: 'Conflict' });
    expect(classifyServerError(error, ctx)).toMatchObject({ kind: 'alert', alert: { kind: 'error' } });
  });

  it('404 means "deleted meanwhile" only when editing', () => {
    const gone = new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' });
    expect(classifyServerError(gone, { ...ctx, mode: 'edit' })).toEqual({ kind: 'alert', alert: { kind: 'not-found' } });
    expect(classifyServerError(gone, ctx)).toMatchObject({ kind: 'alert', alert: { kind: 'error' } });
  });

  it('422 maps to field errors, focusing the first field in form order', () => {
    const error = new ApiError({
      status: 422,
      code: 'IN_PAST',
      message: 'x',
      fields: { end: 'TOO_LONG', start: 'IN_PAST' },
    });
    expect(classifyServerError(error, ctx)).toEqual({
      kind: 'fields',
      errors: { start: 'Это время уже прошло', end: 'Максимум 2 ч' },
      focus: 'start',
    });
  });

  it('anything else becomes a readable error', () => {
    expect(classifyServerError(new Error('boom'), ctx)).toMatchObject({ kind: 'alert', alert: { kind: 'error' } });
    const network = new ApiError({ status: 0, code: 'NETWORK', message: 'x' });
    expect(classifyServerError(network, ctx)).toMatchObject({
      alert: { message: expect.stringContaining('Нет соединения') },
    });
  });
});
