'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { monthGrid } from '@/domain/calendar';
import { getBookingPhase } from '@/domain/rules';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';
import { BookingPopover } from './booking-popover';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MAX_CHIPS = 3;

interface MonthViewProps {
  date: IsoDate;
  now: RoomNow;
  bookings: readonly Booking[];
  onCreate: (date: IsoDate) => void;
  onOpenDay: (date: IsoDate) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

/** 6×7 month grid. Lines are 1px gaps between cells, not borders. */
export function MonthView({ date, now, bookings, onCreate, onOpenDay, onEdit, onDelete }: MonthViewProps) {
  const month = date.slice(0, 7);
  const byDate = Map.groupBy(bookings, (b) => b.date);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 pb-2" aria-hidden>
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-ui-sm text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div role="grid" aria-label={format(isoDateToLocalDate(date), 'LLLL yyyy', { locale: ru })} className="grid flex-1 auto-rows-fr gap-px overflow-hidden rounded-xl bg-border">
        {monthGrid(date).map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 gap-px">
            {week.map((day) => (
              <DayCell
                key={day}
                day={day}
                now={now}
                inMonth={day.startsWith(month)}
                bookings={byDate.get(day) ?? []}
                onCreate={onCreate}
                onOpenDay={onOpenDay}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DayCellProps extends Omit<MonthViewProps, 'date' | 'bookings'> {
  day: IsoDate;
  inMonth: boolean;
  bookings: readonly Booking[];
}

function DayCell({ day, now, inMonth, bookings, onCreate, onOpenDay, onEdit, onDelete }: DayCellProps) {
  const isToday = day === now.date;
  const isPast = day < now.date;
  const label = format(isoDateToLocalDate(day), 'd MMMM, EEEE', { locale: ru });
  const visible = bookings.slice(0, MAX_CHIPS);
  const hidden = bookings.length - visible.length;

  return (
    <div
      role="gridcell"
      aria-label={`${label}${bookings.length ? `, броней: ${bookings.length}` : ''}`}
      className={cn('group/cell relative flex min-h-24 flex-col gap-1 p-1.5 sm:min-h-28', inMonth && !isPast ? 'bg-card' : 'bg-muted/70')}
    >
      {/* The whole empty cell creates a booking; chips and the date sit above this layer. */}
      {!isPast && (
        <button
          type="button"
          aria-label={`Новая бронь на ${label}`}
          onClick={() => onCreate(day)}
          className="focus-ring absolute inset-0 cursor-copy transition-colors duration-fast hover:bg-primary/5"
        />
      )}

      <button
        type="button"
        onClick={() => onOpenDay(day)}
        aria-label={`Открыть ${label}`}
        className={cn(
          'focus-ring relative z-10 flex size-7 items-center justify-center self-start rounded-full text-ui-sm tabular-nums transition-colors duration-fast',
          isToday ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
          !inMonth && 'text-muted-foreground',
        )}
      >
        {Number(day.slice(8))}
      </button>

      <ul className="relative z-10 flex flex-col gap-0.5 max-sm:hidden">
        {visible.map((booking) => {
          const past = getBookingPhase(booking, now) === 'past';
          const tone = past ? PAST_TONE : toneFor(booking.id);
          return (
            <li key={booking.id}>
              <BookingPopover
                booking={booking}
                now={now}
                onEdit={onEdit}
                onDelete={onDelete}
                trigger={
                  <button
                    type="button"
                    className={cn(
                      'focus-ring flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-xs transition-colors duration-fast',
                      tone.chip,
                      past && 'line-through',
                    )}
                  >
                    <span className="tabular-nums opacity-70">{booking.start}</span>
                    <span className="truncate font-medium">{booking.title ?? 'Без названия'}</span>
                  </button>
                }
              />
            </li>
          );
        })}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="focus-ring rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              + ещё {hidden}
            </button>
          </li>
        )}
      </ul>

      {/* Phones: dots instead of chips; tapping the date opens the day. */}
      {bookings.length > 0 && (
        <div aria-hidden className="relative z-10 flex flex-wrap gap-0.5 px-1 sm:hidden">
          {bookings.slice(0, 4).map((b) => (
            <span key={b.id} className={cn('size-1.5 rounded-full', b.date < now.date ? PAST_TONE.bar : toneFor(b.id).bar)} />
          ))}
        </div>
      )}
    </div>
  );
}
