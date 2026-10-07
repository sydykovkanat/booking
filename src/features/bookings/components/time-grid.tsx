'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type PointerEvent, type RefObject, useRef, useState } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { buildAgenda, type DayContext } from '@/domain/schedule';
import { rangeAtMinute, rangeFromDrag } from '@/domain/selection';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange, isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';

const DAY_START = toMinutes(BOOKING_RULES.workStart);
const DAY_END = toMinutes(BOOKING_RULES.workEnd);
const SPAN = DAY_END - DAY_START;
const HOURS = Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START / 60 + i);

/** Vertical position as a percentage, so the grid can stretch to any height. */
const pct = (minutes: number) => `${((Math.min(Math.max(minutes, DAY_START), DAY_END) - DAY_START) / SPAN) * 100}%`;
const box = (range: TimeRange) => ({
  top: pct(toMinutes(range.start)),
  height: `calc(${pct(toMinutes(range.end))} - ${pct(toMinutes(range.start))})`,
});

export interface Draft extends TimeRange {
  day: IsoDate;
  conflict: boolean;
}

export type SelectVia = 'pointer' | 'touch' | 'keyboard';

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
          className="grid flex-1 gap-px overflow-hidden rounded-xl bg-border/70"
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
      <span className={cn('text-ui-sm first-letter:uppercase', day < now.date ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
        {format(local, 'EEEEEE', { locale: ru })}
      </span>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-ui font-semibold tabular-nums',
          isToday && 'bg-primary text-primary-foreground',
          day < now.date && 'text-muted-foreground/70',
        )}
      >
        {format(local, 'd')}
      </span>
    </button>
  );
}

function HourGutter() {
  return (
    <div aria-hidden className="relative bg-card">
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

type ColumnProps = Omit<TimeGridProps, 'days' | 'onOpenDay'> & { day: IsoDate };

function DayColumn({ day, now, bookings, draft, draftRef, editingId, onSelectRange, onSelectBooking }: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const lastPointer = useRef<string>('mouse');

  const ctx: DayContext = { date: day, bookings, now };
  const items = buildAgenda(ctx);
  const isPastDay = day < now.date;
  const pastUntil = isPastDay ? DAY_END : day === now.date ? now.minutes : DAY_START;

  const minuteAt = (clientY: number) => {
    const rect = columnRef.current!.getBoundingClientRect();
    return DAY_START + ((clientY - rect.top) / rect.height) * SPAN;
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    lastPointer.current = event.pointerType;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const minute = minuteAt(event.clientY);
    setDrag({ anchor: minute, current: minute });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return;
    const minute = minuteAt(event.clientY);
    if (drag) setDrag({ ...drag, current: minute });
    else setHover(minute);
  };

  const onPointerUp = () => {
    if (!drag) return;
    const range = rangeFromDrag(ctx, drag.anchor, drag.current);
    setDrag(null);
    if (range) onSelectRange(day, range, 'pointer');
  };

  const dragRange = drag ? rangeFromDrag(ctx, drag.anchor, drag.current) : null;
  const hoverRange = !drag && hover !== null && draft?.day !== day ? rangeAtMinute(ctx, hover) : null;
  const ownDraft = draft?.day === day ? draft : null;

  return (
    <div
      ref={columnRef}
      className={cn('relative bg-card', isPastDay && 'bg-muted/50')}
      onPointerLeave={() => setHover(null)}
    >
      {/* Hour lines and the dimmed past (no hatching: it competed with the bookings). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {HOURS.slice(1, -1).map((h) => (
          <div key={h} className="absolute inset-x-0 h-px bg-border/60" style={{ top: pct(h * 60) }} />
        ))}
        {!isPastDay && pastUntil > DAY_START && (
          <div className="absolute inset-x-0 top-0 bg-muted/60" style={{ height: pct(pastUntil) }} />
        )}
      </div>

      <ol aria-label={format(isoDateToLocalDate(day), 'd MMMM', { locale: ru })} className="absolute inset-0">
        {items.map((item) =>
          item.kind === 'free' ? (
            <li key={`free-${item.start}`} className="absolute inset-x-0" style={box(item)}>
              <button
                type="button"
                aria-label={`Забронировать ${formatRange(item)}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={(event) => {
                  // Mouse selections are handled on pointer up; this is touch and keyboard.
                  if (event.detail === 0) {
                    onSelectRange(day, rangeAtMinute(ctx, toMinutes(item.start))!, 'keyboard');
                  } else if (lastPointer.current !== 'mouse') {
                    const range = rangeAtMinute(ctx, minuteAt(event.clientY));
                    if (range) onSelectRange(day, range, 'touch');
                  }
                }}
                className="focus-ring absolute inset-0 cursor-cell rounded-sm select-none"
              />
            </li>
          ) : (
            <li
              key={item.booking.id}
              className={cn('absolute inset-x-1', item.booking.id === editingId && 'opacity-40')}
              style={box(item.booking)}
            >
              <BookingBlock booking={item.booking} phase={item.phase} onSelect={onSelectBooking} />
            </li>
          ),
        )}
      </ol>

      {hoverRange && <Ghost range={hoverRange} />}
      {dragRange && <DraftBlock range={dragRange} conflict={false} />}
      {!dragRange && ownDraft && <DraftBlock range={ownDraft} conflict={ownDraft.conflict} innerRef={draftRef} />}

      {day === now.date && now.minutes > DAY_START && now.minutes < DAY_END && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: pct(now.minutes) }}>
          <span className="-ml-1 size-2.5 rounded-full bg-destructive" />
          <span className="h-0.5 flex-1 bg-destructive" />
        </div>
      )}
    </div>
  );
}

function BookingBlock({
  booking,
  phase,
  onSelect,
}: {
  booking: Booking;
  phase: 'past' | 'ongoing' | 'upcoming';
  onSelect: (booking: Booking, element: HTMLElement) => void;
}) {
  const tone = phase === 'past' ? PAST_TONE : toneFor(booking.id);
  const duration = toMinutes(booking.end) - toMinutes(booking.start);
  const compact = duration <= 30;
  const title = booking.title ?? 'Без названия';

  return (
    <button
      type="button"
      onClick={(event) => onSelect(booking, event.currentTarget)}
      aria-label={`${formatRange(booking)}, ${title}${phase === 'ongoing' ? ', идёт сейчас' : ''}${phase === 'past' ? ', завершена' : ''}`}
      className={cn(
        'focus-ring relative z-10 flex size-full overflow-hidden rounded-lg pr-2 pl-3 text-left transition-colors duration-fast',
        compact ? 'items-center gap-2' : 'flex-col gap-0.5 py-1.5',
        tone.chip,
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-1.5 left-1 w-[3px] rounded-full', tone.bar)} />
      <span className={cn('truncate text-ui-sm font-semibold', phase === 'past' && 'line-through decoration-1')}>{title}</span>
      <span className={cn('shrink-0 text-xs tabular-nums opacity-75', compact && 'ml-auto')}>
        {formatRange(booking)}
        {!compact && duration >= 60 && ` · ${formatDuration(duration)}`}
      </span>
    </button>
  );
}

function DraftBlock({
  range,
  conflict,
  innerRef,
}: {
  range: TimeRange;
  conflict: boolean;
  innerRef?: RefObject<HTMLDivElement | null>;
}) {
  const duration = toMinutes(range.end) - toMinutes(range.start);
  return (
    <div
      ref={innerRef}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-1 z-30 flex flex-col overflow-hidden rounded-lg px-3 py-1.5 shadow-floating transition-[top,height] duration-fast ease-out',
        // With a red brand accent, a conflict must not look like a normal (solid red) draft.
        conflict
          ? 'bg-destructive/10 text-destructive shadow-none ring-2 ring-destructive ring-inset [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--destructive)_14%,transparent)_6px_9px)]'
          : 'bg-primary text-primary-foreground',
      )}
      style={box(range)}
    >
      <span className="truncate text-ui-sm font-semibold">{conflict ? 'Время занято' : 'Новая бронь'}</span>
      <span className="text-xs tabular-nums opacity-80">
        {formatRange(range)} · {formatDuration(duration)}
      </span>
    </div>
  );
}

function Ghost({ range }: { range: TimeRange }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-1 z-0 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-strong tabular-nums"
      style={box(range)}
    >
      + {formatRange(range)}
    </div>
  );
}
