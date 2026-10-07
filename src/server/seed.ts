import type { Booking, RoomNow } from '@/domain/booking';
import { addDaysToIsoDate } from '@/domain/time';

/** Demo data relative to "today" so the app never looks empty after a restart. */
export function createSeed(now: RoomNow): Booking[] {
  const day = (offset: number) => addDaysToIsoDate(now.date, offset);

  return [
    { id: 'seed-1', date: day(-1), start: '10:00', end: '11:00', title: 'Демо спринта' },
    { id: 'seed-2', date: day(0), start: '09:00', end: '09:30', title: 'Стендап' },
    { id: 'seed-3', date: day(0), start: '11:00', end: '12:00', title: 'Синк с дизайном' },
    { id: 'seed-4', date: day(0), start: '15:00', end: '16:30', title: 'Ретроспектива' },
    { id: 'seed-5', date: day(1), start: '10:00', end: '11:00', title: 'Планирование спринта' },
    { id: 'seed-6', date: day(1), start: '14:00', end: '14:30' },
  ];
}
