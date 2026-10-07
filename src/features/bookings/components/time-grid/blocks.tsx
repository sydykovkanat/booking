'use client';

import type { Ref } from 'react';

import type { Booking, TimeRange } from '@/domain/booking';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange } from '../../lib/format';
import { PAST_TONE, toneFor } from '../../lib/tone';
import { box } from './geometry';

export function BookingBlock({
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
      <span className={cn('shrink-0 text-xs font-normal tabular-nums', compact && 'ml-auto')}>
        {formatRange(booking)}
        {!compact && duration >= 60 && ` · ${formatDuration(duration)}`}
      </span>
    </button>
  );
}

export function DraftBlock({
  range,
  conflict,
  innerRef,
}: {
  range: TimeRange;
  conflict: boolean;
  innerRef?: Ref<HTMLDivElement>;
}) {
  const duration = toMinutes(range.end) - toMinutes(range.start);
  return (
    <div
      ref={innerRef}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-1 z-30 flex flex-col overflow-hidden rounded-lg px-3 py-1.5 transition-[top,height] duration-fast ease-out',
        // With a red brand accent, a conflict must not look like a normal (solid red) draft.
        conflict
          ? 'bg-destructive/15 text-destructive [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--destructive)_22%,transparent)_6px_9px)]'
          : 'bg-primary text-primary-foreground',
      )}
      style={box(range)}
    >
      <span className="truncate text-ui-sm font-semibold">{conflict ? 'Время занято' : 'Новая бронь'}</span>
      <span className="text-xs tabular-nums">
        {formatRange(range)} · {formatDuration(duration)}
      </span>
    </div>
  );
}

export function Ghost({ range }: { range: TimeRange }) {
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
