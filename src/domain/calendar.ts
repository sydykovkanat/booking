import type { IsoDate } from './booking';
import { addDaysToIsoDate } from './time';

export const CALENDAR_VIEWS = ['month', 'week', 'day'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const MONTH_GRID_WEEKS = 6;

function parts(date: IsoDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

/** ISO weekday where Monday = 0 … Sunday = 6. */
function weekdayIndex(date: IsoDate): number {
  const [y, m, d] = parts(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: IsoDate): IsoDate {
  return addDaysToIsoDate(date, -weekdayIndex(date));
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function weekDays(date: IsoDate): IsoDate[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(monday, i));
}

/** Six full weeks, so the grid never changes height between months. */
export function monthGrid(date: IsoDate): IsoDate[][] {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: MONTH_GRID_WEEKS }, (_, w) => weekDays(addDaysToIsoDate(first, w * 7)));
}

export function visibleRange(view: CalendarView, date: IsoDate): { from: IsoDate; to: IsoDate } {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const days = weekDays(date);
    return { from: days[0], to: days[6] };
  }
  const grid = monthGrid(date);
  return { from: grid[0][0], to: grid[MONTH_GRID_WEEKS - 1][6] };
}

/** Next/previous period. Months land on the 1st to avoid 31st → 3rd overflow. */
export function shiftAnchor(view: CalendarView, date: IsoDate, direction: 1 | -1): IsoDate {
  if (view === 'day') return addDaysToIsoDate(date, direction);
  if (view === 'week') return addDaysToIsoDate(date, 7 * direction);
  const [y, m] = parts(date);
  return new Date(Date.UTC(y, m - 1 + direction, 1)).toISOString().slice(0, 10);
}
