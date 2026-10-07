'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { monthGrid } from '@/domain/calendar';
import { getBookingPhase } from '@/domain/rules';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MAX_CHIPS = 3;

interface MonthViewProps {
  date: IsoDate;
  now: RoomNow;
  bookings: readonly Booking[];
  /** Phones: tapping a day selects it (its bookings are listed below) instead of creating. */
  compact: boolean;
  /** Day of the booking being composed: highlighted, and its cell anchors the popover. */
  activeCreateDay: IsoDate | null;
  /** Receives the active cell element (stable callback, e.g. a state setter). */
  onActiveCell?: (element: HTMLElement | null) => void;
  onCreate: (day: IsoDate, anchor: HTMLElement) => void;
  onPickDay: (day: IsoDate) => void;
  onOpenDay: (day: IsoDate) => void;
  onSelectBooking: (booking: Booking, element: HTMLElement) => void;
}

/** 6×7 month grid. Lines are 1px gaps between cells, not borders. */
export function MonthView({ date, ...cellProps }: MonthViewProps) {
  const month = date.slice(0, 7);
  const byDate = Map.groupBy(cellProps.bookings, (b) => b.date);

  return (
    <div className={cn('flex flex-col', !cellProps.compact && 'min-h-0 flex-1')}>
      <div className="grid grid-cols-7 pb-2" aria-hidden>
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-ui-sm text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={format(isoDateToLocalDate(date), 'LLLL yyyy', { locale: ru })}
        className="grid flex-1 auto-rows-fr gap-1"
      >
        {monthGrid(date).map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 gap-1">
            {week.map((day) => (
              <DayCell
                key={day}
                day={day}
                selected={day === date}
                inMonth={day.startsWith(month)}
                dayBookings={byDate.get(day) ?? []}
                {...cellProps}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DayCellProps extends Omit<MonthViewProps, 'date'> {
  day: IsoDate;
  selected: boolean;
  inMonth: boolean;
  dayBookings: readonly Booking[];
}

function DayCell({
  day,
  now,
  selected,
  inMonth,
  dayBookings,
  compact,
  activeCreateDay,
  onActiveCell,
  onCreate,
  onPickDay,
  onOpenDay,
  onSelectBooking,
}: DayCellProps) {
  const isToday = day === now.date;
  const isPast = day < now.date;
  const label = format(isoDateToLocalDate(day), 'd MMMM, EEEE', { locale: ru });
  const visible = dayBookings.slice(0, MAX_CHIPS);
  const hidden = dayBookings.length - visible.length;

  const number = (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-full text-ui-sm tabular-nums transition-colors duration-fast',
        isToday && 'bg-primary font-semibold text-primary-foreground',
        !isToday && selected && compact && 'bg-foreground font-semibold text-background',
        !isToday && !(selected && compact) && (!inMonth || isPast) && 'text-muted-foreground',
      )}
    >
      {Number(day.slice(8))}
    </span>
  );

  if (compact) {
    return (
      <button
        type="button"
        role="gridcell"
        aria-selected={selected}
        aria-label={`${label}${dayBookings.length ? `, броней: ${dayBookings.length}` : ''}`}
        onClick={() => onPickDay(day)}
        className={cn(
          'focus-ring flex aspect-square flex-col items-center justify-center gap-1 rounded-lg',
          inMonth ? 'bg-muted/50' : 'bg-transparent',
        )}
      >
        {number}
        <span aria-hidden className="flex h-1.5 gap-0.5">
          {dayBookings.slice(0, 3).map((b) => (
            <span key={b.id} className={cn('size-1.5 rounded-full', b.date < now.date ? PAST_TONE.bar : toneFor(b.id).bar)} />
          ))}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={activeCreateDay === day ? onActiveCell : undefined}
      role="gridcell"
      data-active={activeCreateDay === day || undefined}
      aria-label={`${label}${dayBookings.length ? `, броней: ${dayBookings.length}` : ''}`}
      className={cn(
        'group/cell relative flex min-h-28 flex-col gap-1 overflow-hidden rounded-lg p-1.5',
        inMonth ? 'bg-muted/50' : 'bg-transparent',
        activeCreateDay === day && 'bg-primary/10',
      )}
    >
      {!isPast && (
        <button
          type="button"
          aria-label={`Новая бронь на ${label}`}
          onClick={(event) => onCreate(day, event.currentTarget)}
          className="focus-ring absolute inset-0 cursor-cell rounded-lg transition-colors duration-fast hover:bg-muted"
        />
      )}

      <button
        type="button"
        onClick={() => onOpenDay(day)}
        aria-label={`Открыть ${label}`}
        className="focus-ring relative z-10 self-start rounded-full transition-colors duration-fast hover:bg-muted"
      >
        {number}
      </button>

      <ul className="relative z-10 flex flex-col gap-0.5">
        {visible.map((booking) => {
          const past = getBookingPhase(booking, now) === 'past';
          const tone = past ? PAST_TONE : toneFor(booking.id);
          return (
            <li key={booking.id}>
              <button
                type="button"
                onClick={(event) => onSelectBooking(booking, event.currentTarget)}
                className={cn(
                  'focus-ring flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors duration-fast',
                  tone.chip,
                )}
              >
                <span className="shrink-0 tabular-nums">{booking.start}</span>
                <span className={cn('truncate font-medium', past && 'line-through')}>{booking.title ?? 'Без названия'}</span>
              </button>
            </li>
          );
        })}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="focus-ring rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Ещё {hidden}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
