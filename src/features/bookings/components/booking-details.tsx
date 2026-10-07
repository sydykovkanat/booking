'use client';

import { IconCalendarEvent, IconClock, IconPencil, IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import type { Booking, BookingPhase } from '@/domain/booking';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange, isoDateToLocalDate } from '../lib/format';
import { PAST_TONE, toneFor } from '../lib/tone';

const PHASE_LABEL: Record<BookingPhase, string> = {
  upcoming: 'Предстоит',
  ongoing: 'Идёт сейчас',
  past: 'Завершена',
};

interface BookingDetailsProps {
  booking: Booking;
  phase: BookingPhase;
  onEdit: () => void;
  onDelete: () => void;
}

export function BookingDetails({ booking, phase, onEdit, onDelete }: BookingDetailsProps) {
  const tone = phase === 'past' ? PAST_TONE : toneFor(booking.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <span aria-hidden className={cn('mt-2 size-3 shrink-0 rounded-full', tone.bar)} />
        <div className="min-w-0">
          <p className={cn('text-lg leading-snug font-semibold break-words', !booking.title && 'text-muted-foreground')}>
            {booking.title ?? 'Без названия'}
          </p>
          <p className={cn('text-ui-sm', phase === 'ongoing' ? 'font-medium text-success' : 'text-muted-foreground')}>
            {PHASE_LABEL[phase]}
          </p>
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

      {phase !== 'past' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onEdit}>
            <IconPencil data-icon="inline-start" aria-hidden /> Изменить
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <IconTrash data-icon="inline-start" aria-hidden /> Удалить
          </Button>
        </div>
      ) : (
        <p className="text-ui-sm text-muted-foreground">Завершённые брони доступны только для просмотра.</p>
      )}
    </div>
  );
}
