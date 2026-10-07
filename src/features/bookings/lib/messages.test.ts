import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { apiErrorMessage, violationMessage } from './messages';

const err = (status: number, code: ConstructorParameters<typeof ApiError>[0]['code']) =>
  new ApiError({ status, code, message: 'x' });

describe('violationMessage', () => {
  it('names the conflicting bookings', () => {
    expect(
      violationMessage('CONFLICT', [
        { id: 'a', date: '2026-10-08', start: '10:00', end: '11:00', title: 'Sync' },
        { id: 'b', date: '2026-10-08', start: '11:00', end: '11:30' },
      ]),
    ).toBe('Пересекается с 10:00–11:00 «Sync», 11:00–11:30');
  });

  it('uses rule values in texts', () => {
    expect(violationMessage('TOO_LONG')).toBe('Максимум 2 ч');
    expect(violationMessage('OUTSIDE_WORKING_HOURS')).toBe('Переговорка доступна с 09:00 до 18:00');
  });
});

describe('apiErrorMessage', () => {
  it.each([
    [err(0, 'NETWORK'), /Нет соединения/],
    [err(0, 'TIMEOUT'), /слишком долго/],
    [err(404, 'NOT_FOUND'), /не найдена/],
    [err(409, 'CONFLICT'), /только что занял/],
    [err(400, 'BAD_REQUEST'), /не понял запрос/],
    [err(200, 'INVALID_RESPONSE'), /не понял запрос/],
    [err(500, 'INTERNAL'), /Ошибка на сервере/],
    [err(502, 'HTTP_ERROR'), /Ошибка на сервере/],
    [err(422, 'TOO_SHORT'), /Минимум 30 мин/],
    [new Error('boom'), /Что-то пошло не так/],
  ])('%#: maps to a human message', (error, expected) => {
    expect(apiErrorMessage(error)).toMatch(expected);
  });
});
