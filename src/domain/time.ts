import { tz } from '@date-fns/tz';
import { format } from 'date-fns';

import type { IsoDate, RoomNow, TimeString } from './booking';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTime(value: string): value is TimeString {
  return TIME_RE.test(value);
}

export function isValidIsoDate(value: string): value is IsoDate {
  const match = DATE_RE.exec(value);
  if (!match) return false;

  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function toMinutes(time: TimeString): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): TimeString {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ceilToStep(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

export function getRoomNow(instant: Date, timeZone: string): RoomNow {
  const inRoom = { in: tz(timeZone) };
  const [date, time] = format(instant, "yyyy-MM-dd'|'HH:mm", inRoom).split('|');
  return { date, minutes: toMinutes(time) };
}

/** Shifts an ISO date by whole days, independent of the host time zone. */
export function addDaysToIsoDate(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
