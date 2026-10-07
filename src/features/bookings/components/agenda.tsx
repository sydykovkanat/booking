'use client';

import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import type { Booking, TimeRange } from '@/domain/booking';
import type { AgendaItem } from '@/domain/schedule';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange } from '../lib/format';

const durationOf = ({ start, end }: TimeRange) => formatDuration(toMinutes(end) - toMinutes(start));

export const bookingElementId = (id: string) => `booking-${id}`;

interface AgendaProps {
  items: readonly AgendaItem[];
  readOnly: boolean;
  highlightedIds: ReadonlySet<string>;
  onBook: (range: TimeRange) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

export function Agenda({ items, readOnly, highlightedIds, onBook, onEdit, onDelete }: AgendaProps) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Расписание на день">
      {items.map((item) =>
        item.kind === 'booking' ? (
          <BookingRow
            key={item.booking.id}
            item={item}
            highlighted={highlightedIds.has(item.booking.id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          <FreeRow key={`free-${item.start}`} range={item} readOnly={readOnly} onBook={onBook} />
        ),
      )}
    </ol>
  );
}

interface BookingRowProps {
  item: Extract<AgendaItem, { kind: 'booking' }>;
  highlighted: boolean;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

function BookingRow({ item: { booking, phase }, highlighted, onEdit, onDelete }: BookingRowProps) {
  const range = formatRange(booking);
  const title = booking.title ?? 'Без названия';
  const editable = phase !== 'past';

  return (
    <li
      id={bookingElementId(booking.id)}
      tabIndex={-1}
      className={cn(
        'group flex items-center gap-3 rounded-xl bg-card p-3 pl-4 shadow-card outline-none transition-[box-shadow,opacity] duration-base focus-visible:ring-3 focus-visible:ring-ring/80 sm:gap-4',
        phase === 'past' && 'bg-muted/60 shadow-none',
        highlighted && 'ring-3 ring-destructive/50',
      )}
    >
      <div
        aria-hidden
        className={cn('h-10 w-1 shrink-0 rounded-full bg-primary', phase === 'past' && 'bg-muted-foreground/30')}
      />
      <div className={cn('min-w-0 flex-1', phase === 'past' && 'opacity-60')}>
        <p className="flex flex-wrap items-baseline gap-x-2 text-ui-sm">
          <span className="font-semibold tabular-nums">{range}</span>
          <span className="text-muted-foreground">{durationOf(booking)}</span>
          {phase === 'ongoing' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
              Идёт сейчас
            </span>
          )}
          {phase === 'past' && <span className="text-muted-foreground">Завершена</span>}
        </p>
        <p className={cn('mt-1 truncate text-ui font-medium', !booking.title && 'font-normal text-muted-foreground')}>{title}</p>
      </div>
      {editable && (
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Изменить бронь ${range}`} onClick={() => onEdit(booking)}>
            <IconPencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Удалить бронь ${range}`}
            onClick={() => onDelete(booking)}
          >
            <IconTrash aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

interface FreeRowProps {
  range: TimeRange;
  readOnly: boolean;
  onBook: (range: TimeRange) => void;
}

function FreeRow({ range, readOnly, onBook }: FreeRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3 pl-4 sm:gap-4">
      <div aria-hidden className="h-10 w-1 shrink-0 rounded-full bg-success/50" />
      <p className="min-w-0 flex-1 text-ui-sm">
        <span className="font-medium text-success">Свободно</span>{' '}
        <span className="tabular-nums">{formatRange(range)}</span>
        <span className="text-muted-foreground"> · {durationOf(range)}</span>
      </p>
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onBook(range)}
          aria-label={`Забронировать ${formatRange(range)}`}
        >
          <IconPlus data-icon="inline-start" aria-hidden />
          <span className="max-sm:sr-only">Забронировать</span>
        </Button>
      )}
    </li>
  );
}
