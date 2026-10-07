'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { RefObject } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate } from '../../lib/format';
import { DayColumn } from './day-column';
import { type Draft, HOURS, pct, type SelectVia } from './geometry';

interface TimeGridProps {
  days: readonly IsoDate[];
  now: RoomNow;
  bookings: readonly Booking[];
  draft: Draft | null;
  /** Attached to the draft block so a popover can sit next to it. */
  draftRef: RefObject<HTMLDivElement | null>;
  editingId: string | null;
  onSelectRange: (day: IsoDate, range: TimeRange, via: SelectVia) => void;
  onSelectBooking: (booking: Booking, element: HTMLElement) => void;
  onOpenDay?: (day: IsoDate) => void;
}

/** Week and day views. Mouse: drag to select. Touch: tap. Keyboard: Enter on a free window. */
export function TimeGrid({ days, onOpenDay, ...columnProps }: TimeGridProps) {
  const single = days.length === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
      <div className={cn('flex min-h-[34rem] flex-1 flex-col', !single && 'min-w-[46rem]')}>
        {!single && (
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] pb-2">
            <div />
            {days.map((day) => (
              <WeekdayHeader key={day} day={day} now={columnProps.now} onOpenDay={onOpenDay} />
            ))}
          </div>
        )}

        <div
          className="grid flex-1 gap-1"
          style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <HourGutter />
          {days.map((day) => (
            <DayColumn key={day} day={day} {...columnProps} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekdayHeader({ day, now, onOpenDay }: { day: IsoDate; now: RoomNow; onOpenDay?: (d: IsoDate) => void }) {
  const local = isoDateToLocalDate(day);
  const isToday = day === now.date;

  return (
    <button
      type="button"
      onClick={() => onOpenDay?.(day)}
      aria-label={`Открыть ${format(local, 'd MMMM, EEEE', { locale: ru })}`}
      className="focus-ring flex items-center justify-center gap-2 rounded-lg py-1.5 transition-colors duration-fast hover:bg-muted"
    >
      <span className={cn('text-ui-sm first-letter:uppercase', 'text-muted-foreground')}>
        {format(local, 'EEEEEE', { locale: ru })}
      </span>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-ui font-semibold tabular-nums',
          isToday && 'bg-primary text-primary-foreground',
          day < now.date && 'text-muted-foreground',
        )}
      >
        {format(local, 'd')}
      </span>
    </button>
  );
}

function HourGutter() {
  return (
    <div aria-hidden className="relative">
      {HOURS.map((h, i) => (
        <span
          key={h}
          className={cn(
            'absolute right-2 text-xs text-muted-foreground tabular-nums',
            i === 0 ? 'top-1' : i === HOURS.length - 1 ? 'bottom-1' : '-translate-y-1/2',
          )}
          style={i === 0 || i === HOURS.length - 1 ? undefined : { top: pct(h * 60) }}
        >
          {String(h).padStart(2, '0')}:00
        </span>
      ))}
    </div>
  );
}
