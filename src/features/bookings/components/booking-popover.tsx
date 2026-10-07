'use client';

import { IconCalendarEvent, IconClock, IconPencil, IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type ReactElement, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Booking, BookingPhase, RoomNow } from '@/domain/booking';
import { getBookingPhase } from '@/domain/rules';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange, isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';

const PHASE_LABEL: Record<BookingPhase, string> = {
  upcoming: 'Предстоит',
  ongoing: 'Идёт сейчас',
  past: 'Завершена',
};

interface BookingPopoverProps {
  booking: Booking;
  now: RoomNow;
  /** The element that opens the popover (an event chip or block). */
  trigger: ReactElement;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

/** Event details on click, with edit/delete for bookings that have not ended yet. */
export function BookingPopover({ booking, now, trigger, onEdit, onDelete }: BookingPopoverProps) {
  const [open, setOpen] = useState(false);
  const phase = getBookingPhase(booking, now);
  const tone = phase === 'past' ? PAST_TONE : toneFor(booking.id);

  const act = (action: (b: Booking) => void) => {
    setOpen(false);
    action(booking);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-80 gap-4 p-4">
        <div className="flex gap-3">
          <span aria-hidden className={cn('mt-1.5 size-3 shrink-0 rounded-full', tone.bar)} />
          <div className="min-w-0">
            <p className={cn('text-lg leading-snug font-semibold break-words', !booking.title && 'text-muted-foreground')}>
              {booking.title ?? 'Без названия'}
            </p>
            <p className="text-ui-sm text-muted-foreground">{PHASE_LABEL[phase]}</p>
          </div>
        </div>
        <dl className="flex flex-col gap-2 text-ui">
          <div className="flex items-center gap-3">
            <IconCalendarEvent className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Дата</dt>
            <dd className="first-letter:uppercase">{format(isoDateToLocalDate(booking.date), 'EEEE, d MMMM', { locale: ru })}</dd>
          </div>
          <div className="flex items-center gap-3">
            <IconClock className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Время</dt>
            <dd className="tabular-nums">
              {formatRange(booking)}
              <span className="text-muted-foreground"> · {formatDuration(toMinutes(booking.end) - toMinutes(booking.start))}</span>
            </dd>
          </div>
        </dl>
        {phase !== 'past' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => act(onEdit)}>
              <IconPencil data-icon="inline-start" aria-hidden /> Изменить
            </Button>
            <Button variant="destructive" size="sm" onClick={() => act(onDelete)}>
              <IconTrash data-icon="inline-start" aria-hidden /> Удалить
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
