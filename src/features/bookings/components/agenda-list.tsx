'use client';

import { IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { getBookingPhase } from '@/domain/rules';
import { cn } from '@/lib/utils';

import { formatRange, isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';

interface AgendaListProps {
  days: readonly IsoDate[];
  now: RoomNow;
  bookings: readonly Booking[];
  /** Hide per-day headers (a single, already titled day). */
  hideHeaders?: boolean;
  onSelectBooking: (booking: Booking, element: HTMLElement) => void;
  onOpenDay?: (day: IsoDate) => void;
}

/** Phone-friendly schedule: days with their bookings as large tappable rows. */
export function AgendaList({ days, now, bookings, hideHeaders, onSelectBooking, onOpenDay }: AgendaListProps) {
  const byDate = Map.groupBy(bookings, (b) => b.date);

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => {
        const items = byDate.get(day) ?? [];
        const local = isoDateToLocalDate(day);
        const isToday = day === now.date;

        return (
          <section key={day} aria-label={format(local, 'EEEE, d MMMM', { locale: ru })} className="flex flex-col gap-1.5">
            {!hideHeaders && (
              <button
                type="button"
                onClick={() => onOpenDay?.(day)}
                className="focus-ring flex items-center gap-2 rounded-lg py-1 text-left"
              >
                <span className={cn('text-ui font-semibold first-letter:uppercase', day < now.date && 'text-muted-foreground')}>
                  {format(local, 'EEEEEE, d MMMM', { locale: ru })}
                </span>
                {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">сегодня</span>}
                <IconChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
              </button>
            )}

            {items.length === 0 ? (
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-ui-sm text-muted-foreground">Броней нет</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((booking) => {
                  const phase = getBookingPhase(booking, now);
                  const tone = phase === 'past' ? PAST_TONE : toneFor(booking.id);
                  return (
                    <li key={booking.id}>
                      <button
                        type="button"
                        onClick={(event) => onSelectBooking(booking, event.currentTarget)}
                        className={cn(
                          'focus-ring relative flex w-full items-center gap-3 rounded-xl py-3 pr-4 pl-5 text-left transition-colors duration-fast',
                          tone.chip,
                        )}
                      >
                        <span aria-hidden className={cn('absolute inset-y-2.5 left-2 w-[3px] rounded-full', tone.bar)} />
                        <span className="w-24 shrink-0 text-ui-sm tabular-nums">{formatRange(booking)}</span>
                        <span className={cn('min-w-0 flex-1 truncate text-ui font-medium', phase === 'past' && 'line-through')}>
                          {booking.title ?? 'Без названия'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
