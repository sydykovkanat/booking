'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type RefObject, useMemo, useRef } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { buildAgenda } from '@/domain/schedule';
import { cn } from '@/lib/utils';

import { formatRange, isoDateToLocalDate } from '../../lib/format';
import { BookingBlock, DraftBlock, Ghost } from './blocks';
import { box, DAY_END, DAY_START, type Draft, HOURS, pct, type SelectVia, SPAN } from './geometry';
import { usePointerSelection } from './use-pointer-selection';

export interface DayColumnProps {
  day: IsoDate;
  now: RoomNow;
  bookings: readonly Booking[];
  draft: Draft | null;
  draftRef: RefObject<HTMLDivElement | null>;
  editingId: string | null;
  onSelectRange: (day: IsoDate, range: TimeRange, via: SelectVia) => void;
  onSelectBooking: (booking: Booking, element: HTMLElement) => void;
}

/** One day: tonal background, bookings, free windows as selection targets, the draft and "now". */
export function DayColumn({ day, now, bookings, draft, draftRef, editingId, onSelectRange, onSelectBooking }: DayColumnProps) {
  const ctx = useMemo(() => ({ date: day, bookings, now }), [day, bookings, now]);
  const items = useMemo(() => buildAgenda(ctx), [ctx]);
  const ownDraft = draft?.day === day ? draft : null;
  const columnRef = useRef<HTMLDivElement>(null);
  const { freeWindowHandlers, clearHover, dragRange, hoverRange } = usePointerSelection({
    day,
    columnRef,
    ctx,
    hasDraft: ownDraft !== null,
    onSelectRange,
  });
  const isPastDay = day < now.date;

  return (
    <div
      ref={columnRef}
      className={cn('relative overflow-hidden rounded-lg', isPastDay ? 'bg-muted/80' : 'bg-muted/40')}
      onPointerLeave={clearHover}
    >
      <ColumnBackground day={day} now={now} />

      <ol aria-label={format(isoDateToLocalDate(day), 'd MMMM', { locale: ru })} className="absolute inset-0">
        {items.map((item) =>
          item.kind === 'free' ? (
            // Keyed by the end: today the start moves with "now", which would remount the button
            // mid-drag (losing pointer capture) and drop keyboard focus.
            <li key={`free-${item.end}`} className="absolute inset-x-0" style={box(item)}>
              <button
                type="button"
                aria-label={`Забронировать ${formatRange(item)}`}
                data-start={item.start}
                className="focus-ring absolute inset-0 cursor-cell rounded-sm select-none"
                {...freeWindowHandlers}
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
      {day === now.date && now.minutes > DAY_START && now.minutes < DAY_END && <NowLine minutes={now.minutes} />}
    </div>
  );
}

/** Every other hour a shade darker (rhythm without lines) and the dimmed past of today. */
function ColumnBackground({ day, now }: { day: IsoDate; now: RoomNow }) {
  const pastUntil = day === now.date ? now.minutes : DAY_START;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {HOURS.slice(0, -1)
        .filter((_, i) => i % 2 === 1)
        .map((h) => (
          <div
            key={h}
            className="absolute inset-x-0 bg-foreground/[0.025]"
            style={{ top: pct(h * 60), height: `${(60 / SPAN) * 100}%` }}
          />
        ))}
      {pastUntil > DAY_START && <div className="absolute inset-x-0 top-0 bg-muted/70" style={{ height: pct(pastUntil) }} />}
    </div>
  );
}

function NowLine({ minutes }: { minutes: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: pct(minutes) }}>
      <span className="-ml-1 size-2.5 rounded-full bg-destructive" />
      <span className="h-0.5 flex-1 bg-destructive" />
    </div>
  );
}
