'use client';

import { IconClock, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import type { Booking, BookingPhase } from '@/domain/booking';
import { toMinutes } from '@/domain/time';

import { cn } from '@/lib/utils';

import { formatDuration, formatRange, isoDateToLocalDate } from '../lib/format';

const PHASE: Record<BookingPhase, { label: string; dot: string }> = {
  upcoming: { label: 'Предстоит', dot: 'bg-primary-strong' },
  ongoing: { label: 'Идёт сейчас', dot: 'bg-success animate-pulse' },
  past: { label: 'Завершена', dot: 'bg-muted-foreground/50' },
};

interface BookingDetailsProps {
  booking: Booking;
  phase: BookingPhase;
  onEdit: () => void;
  onDelete: () => void;
  onClose?: () => void;
}

export function BookingDetails({ booking, phase, onEdit, onDelete, onClose }: BookingDetailsProps) {
  const duration = toMinutes(booking.end) - toMinutes(booking.start);
  const editable = phase !== 'past';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={cn('text-xl font-semibold break-words', !booking.title && 'text-muted-foreground')}>
            {booking.title ?? 'Без названия'}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-ui-sm text-muted-foreground">
            <span aria-hidden className={cn('size-2 rounded-full', PHASE[phase].dot)} />
            {PHASE[phase].label}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Закрыть" onClick={onClose}>
            <IconX aria-hidden />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
        <IconClock className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold tabular-nums">{formatRange(booking)}</p>
          <p className="text-ui-sm text-muted-foreground">
            {format(isoDateToLocalDate(booking.date), 'd MMMM, EEEE', { locale: ru })} · {formatDuration(duration)}
          </p>
        </div>
      </div>

      {editable ? (
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
