'use client';

import { IconPlus } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type MouseEvent, useState } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { buildAgenda } from '@/domain/schedule';
import { fromMinutes, toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatRange, isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';
import { BookingPopover } from './booking-popover';

const DAY_START = toMinutes(BOOKING_RULES.workStart);
const DAY_END = toMinutes(BOOKING_RULES.workEnd);
const STEP = BOOKING_RULES.stepMinutes;
const MIN_DURATION = BOOKING_RULES.minDurationMinutes;
const PREFERRED_DURATION = 60;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);

interface TimeGridProps {
  days: readonly IsoDate[];
  now: RoomNow;
  bookings: readonly Booking[];
  /** Vertical scale; 1 hour = 60 × pxPerMinute pixels. */
  pxPerMinute: number;
  onCreate: (date: IsoDate, range?: TimeRange) => void;
  onOpenDay?: (date: IsoDate) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

/** Week and day views: one column per day, 09:00–18:00, free gaps are click-to-book buttons. */
export function TimeGrid({ days, now, bookings, pxPerMinute, onCreate, onOpenDay, onEdit, onDelete }: TimeGridProps) {
  const top = (minutes: number) => (minutes - DAY_START) * pxPerMinute;
  const gridHeight = top(DAY_END);
  const single = days.length === 1;

  return (
    <div className="min-h-0 flex-1 overflow-x-auto">
      <div className={cn('grid', single ? 'min-w-0' : 'min-w-[48rem]')} style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* Header row */}
        <div />
        {days.map((day) => (
          <DayHeader key={day} day={day} now={now} single={single} onOpenDay={onOpenDay} />
        ))}

        {/* Hour gutter */}
        <div aria-hidden className="relative" style={{ height: gridHeight }}>
          {[...HOURS, DAY_END / 60].map((h, i) => (
            <span
              key={h}
              className={cn(
                'absolute right-2 text-xs text-muted-foreground tabular-nums',
                i === 0 ? 'translate-y-0' : i === HOURS.length ? '-translate-y-full' : '-translate-y-1/2',
              )}
              style={{ top: top(h * 60) }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            now={now}
            bookings={bookings.filter((b) => b.date === day)}
            pxPerMinute={pxPerMinute}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function DayHeader({ day, now, single, onOpenDay }: { day: IsoDate; now: RoomNow; single: boolean; onOpenDay?: (d: IsoDate) => void }) {
  const local = isoDateToLocalDate(day);
  const isToday = day === now.date;
  if (single) return <div className="h-2" />;

  return (
    <button
      type="button"
      onClick={() => onOpenDay?.(day)}
      aria-label={`Открыть ${format(local, 'd MMMM, EEEE', { locale: ru })}`}
      className="focus-ring flex flex-col items-center gap-1 rounded-lg pb-3 transition-colors duration-fast hover:bg-muted/60"
    >
      <span className="text-ui-sm text-muted-foreground">{format(local, 'EEEEEE', { locale: ru })}</span>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-ui font-semibold tabular-nums',
          isToday && 'bg-primary text-primary-foreground',
          day < now.date && !isToday && 'text-muted-foreground',
        )}
      >
        {format(local, 'd')}
      </span>
    </button>
  );
}

interface DayColumnProps {
  day: IsoDate;
  now: RoomNow;
  bookings: readonly Booking[];
  pxPerMinute: number;
  onCreate: (date: IsoDate, range?: TimeRange) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

function DayColumn({ day, now, bookings, pxPerMinute, onCreate, onEdit, onDelete }: DayColumnProps) {
  const top = (minutes: number) => (minutes - DAY_START) * pxPerMinute;
  const box = (range: TimeRange) => ({
    top: top(toMinutes(range.start)),
    height: (toMinutes(range.end) - toMinutes(range.start)) * pxPerMinute,
  });
  const pastUntil = day < now.date ? DAY_END : day === now.date ? Math.min(Math.max(now.minutes, DAY_START), DAY_END) : DAY_START;
  const items = buildAgenda({ date: day, bookings, now });

  return (
    <div className="relative ml-px" style={{ height: top(DAY_END) }}>
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-lg">
        {HOURS.map((h, i) => (
          <div
            key={h}
            className={cn('absolute inset-x-0', i % 2 === 0 ? 'bg-muted/80' : 'bg-muted/40')}
            style={{ top: top(h * 60), height: 60 * pxPerMinute }}
          />
        ))}
        {pastUntil > DAY_START && (
          <div
            className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--foreground)_5%,transparent)_6px_8px)]"
            style={{ height: top(pastUntil) }}
          />
        )}
      </div>

      <ol aria-label={format(isoDateToLocalDate(day), 'd MMMM', { locale: ru })} className="absolute inset-0">
        {items.map((item) =>
          item.kind === 'free' ? (
            <FreeGap key={`free-${item.start}`} day={day} gap={item} pxPerMinute={pxPerMinute} onCreate={onCreate} />
          ) : (
            <li key={item.booking.id} className="absolute inset-x-0.5" style={box(item.booking)}>
              <BookingPopover
                booking={item.booking}
                now={now}
                onEdit={onEdit}
                onDelete={onDelete}
                trigger={<BookingBlock booking={item.booking} past={item.phase === 'past'} ongoing={item.phase === 'ongoing'} />}
              />
            </li>
          ),
        )}
      </ol>

      {day === now.date && now.minutes > DAY_START && now.minutes < DAY_END && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: top(now.minutes) }}>
          <span className="-ml-1 size-2 rounded-full bg-destructive" />
          <span className="h-0.5 flex-1 bg-destructive/70" />
        </div>
      )}
    </div>
  );
}

interface BookingBlockProps extends React.ComponentProps<'button'> {
  booking: Booking;
  past: boolean;
  ongoing: boolean;
}

function BookingBlock({ booking, past, ongoing, className, ...props }: BookingBlockProps) {
  const tone = past ? PAST_TONE : toneFor(booking.id);
  const duration = toMinutes(booking.end) - toMinutes(booking.start);
  const title = booking.title ?? 'Без названия';

  return (
    <button
      type="button"
      aria-label={`${formatRange(booking)}, ${title}${ongoing ? ', идёт сейчас' : ''}${past ? ', завершена' : ''}`}
      className={cn(
        'focus-ring relative flex size-full flex-col overflow-hidden rounded-md py-1 pr-2 pl-3 text-left text-xs transition-colors duration-fast',
        tone.chip,
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn('absolute inset-y-1 left-1 w-0.5 rounded-full', tone.bar)} />
      <span className={cn('truncate font-semibold', past && 'line-through')}>{title}</span>
      {duration > 30 && <span className="truncate tabular-nums opacity-70">{formatRange(booking)}</span>}
    </button>
  );
}

interface FreeGapProps {
  day: IsoDate;
  gap: TimeRange;
  pxPerMinute: number;
  onCreate: (date: IsoDate, range?: TimeRange) => void;
}

/** Pointer users get the start under the cursor (snapped to 15 min); keyboard users get the gap start. */
function FreeGap({ day, gap, pxPerMinute, onCreate }: FreeGapProps) {
  const [hoverStart, setHoverStart] = useState<number | null>(null);
  const gapStart = toMinutes(gap.start);
  const gapEnd = toMinutes(gap.end);

  const rangeAt = (start: number): TimeRange => ({
    start: fromMinutes(start),
    end: fromMinutes(Math.min(start + PREFERRED_DURATION, gapEnd)),
  });

  const startFromPointer = (event: MouseEvent<HTMLButtonElement>) => {
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const snapped = gapStart + Math.floor(offset / pxPerMinute / STEP) * STEP;
    return Math.min(Math.max(snapped, gapStart), gapEnd - MIN_DURATION);
  };

  const hover = hoverStart === null ? null : rangeAt(hoverStart);

  return (
    <li
      className="absolute inset-x-0"
      style={{ top: (gapStart - DAY_START) * pxPerMinute, height: (gapEnd - gapStart) * pxPerMinute }}
    >
      <button
        type="button"
        aria-label={`Забронировать ${formatRange(gap)}`}
        onClick={(e) => onCreate(day, rangeAt(e.detail === 0 ? gapStart : startFromPointer(e)))}
        onMouseMove={(e) => setHoverStart(startFromPointer(e))}
        onMouseLeave={() => setHoverStart(null)}
        className="focus-ring relative size-full cursor-copy rounded-md"
      >
        {hover && (
          <span
            aria-hidden
            className="absolute inset-x-0.5 flex items-start gap-1 overflow-hidden rounded-md bg-primary/20 px-2 py-1 text-xs font-medium text-primary-strong"
            style={{ top: (toMinutes(hover.start) - gapStart) * pxPerMinute, height: (toMinutes(hover.end) - toMinutes(hover.start)) * pxPerMinute }}
          >
            <IconPlus className="size-3.5 shrink-0" /> {formatRange(hover)}
          </span>
        )}
      </button>
    </li>
  );
}

