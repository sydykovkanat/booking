import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { addDaysToIsoDate } from '@/domain/time';

export function isoDateToLocalDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function formatRange({ start, end }: TimeRange): string {
  return `${start}–${end}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 && `${h} ч`, m > 0 && `${m} мин`].filter(Boolean).join(' ') || '0 мин';
}

const RELATIVE_DAYS: Record<number, string> = { [-1]: 'Вчера', 0: 'Сегодня', 1: 'Завтра' };

/** "Сегодня, 8 октября" or "Пятница, 10 октября"; `short` gives "Сегодня, 8 окт." */
export function formatDayTitle(date: IsoDate, now: RoomNow, { short = false } = {}): string {
  const local = isoDateToLocalDate(date);
  const dayMonth = format(local, short ? 'd MMM' : 'd MMMM', { locale: ru });
  const offset = [-1, 0, 1].find((o) => addDaysToIsoDate(now.date, o) === date);
  if (offset !== undefined) return `${RELATIVE_DAYS[offset]}, ${dayMonth}`;

  const weekday = format(local, short ? 'EEEEEE' : 'EEEE', { locale: ru });
  const year = date.slice(0, 4) === now.date.slice(0, 4) ? '' : ` ${date.slice(0, 4)}`;
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dayMonth}${year}`;
}
