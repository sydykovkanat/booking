'use client';

import { IconPlus } from '@tabler/icons-react';
import { type MouseEvent, useState } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { overlaps } from '@/domain/overlap';
import type { AgendaItem } from '@/domain/schedule';
import { fromMinutes, toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange } from '../lib/format';

const DAY_START = toMinutes(BOOKING_RULES.workStart);
const DAY_END = toMinutes(BOOKING_RULES.workEnd);
const STEP = BOOKING_RULES.stepMinutes;
const MIN_DURATION = BOOKING_RULES.minDurationMinutes;
const PREFERRED_DURATION = 60;
/** Vertical scale: 1 hour = 72px, so a 15-minute step is 18px. */
const PX_PER_MINUTE = 1.2;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);

const top = (minutes: number) => (minutes - DAY_START) * PX_PER_MINUTE;
const height = (range: TimeRange) => (toMinutes(range.end) - toMinutes(range.start)) * PX_PER_MINUTE;
const boxStyle = (range: TimeRange) => ({ top: top(toMinutes(range.start)), height: height(range) });

export const bookingElementId = (id: string) => `booking-${id}`;

export interface TimelineSelection extends TimeRange {
  conflict: boolean;
}

interface DayTimelineProps {
  date: IsoDate;
  now: RoomNow;
  items: readonly AgendaItem[];
  readOnly: boolean;
  selectedBookingId: string | null;
  selection?: TimelineSelection;
  highlightedIds: ReadonlySet<string>;
  onBook: (range: TimeRange) => void;
  onSelectBooking: (booking: Booking) => void;
}

/**
 * Day view: hours as tonal bands, bookings as filled blocks, free gaps as buttons.
 * The list is in chronological order, so assistive technology reads it as an agenda.
 */
export function DayTimeline({
  date,
  now,
  items,
  readOnly,
  selectedBookingId,
  selection,
  highlightedIds,
  onBook,
  onSelectBooking,
}: DayTimelineProps) {
  const pastUntil = date < now.date ? DAY_END : date === now.date ? Math.min(Math.max(now.minutes, DAY_START), DAY_END) : DAY_START;
  const showNowLine = date === now.date && now.minutes > DAY_START && now.minutes < DAY_END;

  return (
    <div className="relative grid grid-cols-[3.5rem_1fr] select-none">
      <div aria-hidden className="relative" style={{ height: top(DAY_END) }}>
        {[...HOURS, DAY_END / 60].map((h) => (
          <span
            key={h}
            className="absolute right-3 -translate-y-1/2 text-ui-sm text-muted-foreground tabular-nums first:translate-y-0 last:-translate-y-full"
            style={{ top: top(h * 60) }}
          >
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>

      <div className="relative" style={{ height: top(DAY_END) }}>
        {/* Hour bands instead of grid lines. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-xl">
          {HOURS.map((h, i) => (
            <div
              key={h}
              className={cn('absolute inset-x-0', i % 2 === 0 ? 'bg-muted' : 'bg-muted/40')}
              style={{ top: top(h * 60), height: 60 * PX_PER_MINUTE }}
            />
          ))}
          {pastUntil > DAY_START && (
            <div
              className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--foreground)_6%,transparent)_6px_8px)]"
              style={{ height: top(pastUntil) }}
            />
          )}
        </div>

        <ol aria-label="Расписание на день" className="absolute inset-0">
          {items.map((item) =>
            item.kind === 'booking' ? (
              <BookingBlock
                key={item.booking.id}
                item={item}
                selected={item.booking.id === selectedBookingId}
                highlighted={highlightedIds.has(item.booking.id)}
                onSelect={onSelectBooking}
              />
            ) : (
              <FreeGap key={`free-${item.start}`} gap={item} readOnly={readOnly} selection={selection} onBook={onBook} />
            ),
          )}
        </ol>

        {selection && (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-1.5 z-10 flex items-start gap-2 overflow-hidden rounded-lg px-3 py-1.5 text-ui-sm font-semibold shadow-card transition-[top,height] duration-base ease-out',
              selection.conflict
                ? 'bg-destructive/12 text-destructive [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--destructive)_16%,transparent)_6px_9px)]'
                : 'bg-primary text-primary-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_8px,rgb(255_255_255/0.22)_8px_11px)]',
            )}
            style={boxStyle(selection)}
          >
            <span className="truncate">{selection.conflict ? 'Пересечение' : 'Новая бронь'}</span>
            <span className="shrink-0 font-normal tabular-nums opacity-80">{formatRange(selection)}</span>
          </div>
        )}

        {showNowLine && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: top(now.minutes) }}>
            <span className="-ml-1 size-2 rounded-full bg-destructive" />
            <span className="h-0.5 flex-1 bg-destructive/70" />
          </div>
        )}
      </div>
    </div>
  );
}

interface BookingBlockProps {
  item: Extract<AgendaItem, { kind: 'booking' }>;
  selected: boolean;
  highlighted: boolean;
  onSelect: (booking: Booking) => void;
}

function BookingBlock({ item: { booking, phase }, selected, highlighted, onSelect }: BookingBlockProps) {
  const duration = toMinutes(booking.end) - toMinutes(booking.start);
  const compact = duration <= 30;
  const title = booking.title ?? 'Без названия';

  return (
    <li className="absolute inset-x-1.5" style={boxStyle(booking)}>
      <button
        type="button"
        id={bookingElementId(booking.id)}
        onClick={() => onSelect(booking)}
        aria-pressed={selected}
        aria-label={`${formatRange(booking)}, ${title}${phase === 'ongoing' ? ', идёт сейчас' : ''}${phase === 'past' ? ', завершена' : ''}`}
        className={cn(
          'focus-ring relative flex size-full gap-x-2 overflow-hidden rounded-lg py-1.5 pr-3 pl-4 text-left transition-colors duration-fast',
          compact ? 'items-center' : 'flex-col justify-start',
          phase === 'past'
            ? 'bg-foreground/6 text-muted-foreground hover:bg-foreground/10'
            : selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/22 text-foreground hover:bg-primary/35',
          highlighted && 'bg-destructive/15 text-destructive hover:bg-destructive/20',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1.5 left-1.5 w-1 rounded-full',
            phase === 'past' ? 'bg-foreground/15' : highlighted ? 'bg-destructive' : selected ? 'bg-primary-foreground/50' : 'bg-primary-strong',
          )}
        />
        <span className={cn('truncate text-ui font-semibold', compact && 'min-w-0 flex-1')}>{title}</span>
        <span className={cn('shrink-0 text-ui-sm tabular-nums', selected ? 'opacity-80' : 'text-muted-foreground')}>
          {formatRange(booking)}
          {!compact && ` · ${formatDuration(duration)}`}
          {phase === 'ongoing' && ' · идёт'}
        </span>
      </button>
    </li>
  );
}

interface FreeGapProps {
  gap: TimeRange;
  readOnly: boolean;
  selection?: TimelineSelection;
  onBook: (range: TimeRange) => void;
}

/** A bookable gap. Pointer users pick the start where they click; keyboard users get the gap start. */
function FreeGap({ gap, readOnly, selection, onBook }: FreeGapProps) {
  const [hoverStart, setHoverStart] = useState<number | null>(null);
  const gapStart = toMinutes(gap.start);
  const gapEnd = toMinutes(gap.end);

  const rangeAt = (start: number): TimeRange => ({
    start: fromMinutes(start),
    end: fromMinutes(Math.min(start + PREFERRED_DURATION, gapEnd)),
  });

  const startFromPointer = (event: MouseEvent<HTMLButtonElement>) => {
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const snapped = gapStart + Math.floor(offset / PX_PER_MINUTE / STEP) * STEP;
    return Math.min(Math.max(snapped, gapStart), gapEnd - MIN_DURATION);
  };

  if (readOnly) return null;
  const candidate = hoverStart === null ? null : rangeAt(hoverStart);
  // Never draw the hint on top of the draft that is already being edited.
  const hover = candidate && !(selection && overlaps(candidate, selection)) ? candidate : null;

  return (
    <li className="absolute inset-x-0" style={boxStyle(gap)}>
      <button
        type="button"
        aria-label={`Забронировать ${formatRange(gap)}`}
        onClick={(e) => onBook(rangeAt(e.detail === 0 ? gapStart : startFromPointer(e)))}
        onMouseMove={(e) => setHoverStart(startFromPointer(e))}
        onMouseLeave={() => setHoverStart(null)}
        className="focus-ring group/gap relative size-full cursor-copy rounded-xl"
      >
        {hover && (
          <span
            aria-hidden
            className="absolute inset-x-1.5 flex items-start gap-1.5 rounded-lg bg-primary/12 px-3 py-1.5 text-ui-sm font-medium text-primary-strong"
            style={{
              top: (toMinutes(hover.start) - gapStart) * PX_PER_MINUTE,
              height: height(hover),
            }}
          >
            <IconPlus className="size-4" /> {formatRange(hover)}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-3 top-1.5 hidden text-ui-sm text-muted-foreground group-focus-visible/gap:block">
          Свободно {formatRange(gap)} · Enter — забронировать
        </span>
      </button>
    </li>
  );
}
