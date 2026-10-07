'use client';

import { IconAlertTriangle, IconClock, IconDoor, IconPencil, IconRefresh, IconTrash, IconWorld } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { appConfig } from '@/config/app-config';
import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { getBookingPhase } from '@/domain/rules';
import { cn } from '@/lib/utils';

import { useBookings } from '../api/queries';
import { formatDuration, formatRange, isoDateToLocalDate } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';

interface InfoPanelProps {
  date: IsoDate;
  now: RoomNow;
  activeBookingId: string | null;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

export function InfoPanel({ date, now, activeBookingId, onEdit, onDelete }: InfoPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
          <IconDoor className="size-6" />
        </div>
        <div>
          <p className="text-ui-sm text-muted-foreground">Переговорная комната</p>
          <h1 className="text-2xl font-semibold tracking-tight">Переговорка</h1>
        </div>
        <ul className="flex flex-col gap-2.5 text-ui text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <IconClock className="size-5 shrink-0" aria-hidden />
            {formatDuration(BOOKING_RULES.minDurationMinutes)} – {formatDuration(BOOKING_RULES.maxDurationMinutes)}, шаг{' '}
            {BOOKING_RULES.stepMinutes} мин
          </li>
          <li className="flex items-center gap-2.5">
            <IconDoor className="size-5 shrink-0" aria-hidden />
            Рабочий день {BOOKING_RULES.workStart}–{BOOKING_RULES.workEnd}
          </li>
          <li className="flex items-center gap-2.5">
            <IconWorld className="size-5 shrink-0" aria-hidden />
            Время: {appConfig.roomTimeZone.replace('_', ' ')}
          </li>
        </ul>
      </div>

      <section aria-labelledby="day-bookings-heading" className="flex flex-col gap-3">
        <h2 id="day-bookings-heading" className="text-ui font-semibold first-letter:uppercase">
          Брони на {format(isoDateToLocalDate(date), 'd MMMM', { locale: ru })}
        </h2>
        <DayBookings date={date} now={now} activeBookingId={activeBookingId} onEdit={onEdit} onDelete={onDelete} />
      </section>
    </div>
  );
}

function DayBookings({ date, now, activeBookingId, onEdit, onDelete }: InfoPanelProps) {
  const { data, isPending, isError, error, refetch } = useBookings(date);

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Загружаем брони" className="flex flex-col gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-destructive/10 p-3 text-ui-sm text-destructive">
        <span className="flex items-center gap-2">
          <IconAlertTriangle className="size-4" aria-hidden /> {apiErrorMessage(error)}
        </span>
        <Button size="xs" variant="secondary" onClick={() => refetch()}>
          <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-ui-sm text-muted-foreground">Пока никто не бронировал.</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {data.map((booking) => {
        const phase = getBookingPhase(booking, now);
        const range = formatRange(booking);
        return (
          <li
            key={booking.id}
            id={`booking-${booking.id}`}
            tabIndex={-1}
            className={cn(
              'focus-ring group flex items-center gap-3 rounded-xl py-2 pr-1.5 pl-3 transition-colors duration-fast',
              booking.id === activeBookingId ? 'bg-primary/15' : 'bg-muted/60',
              phase === 'past' && 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden
              className={cn('h-8 w-1 shrink-0 rounded-full', phase === 'past' ? 'bg-foreground/15' : 'bg-primary-strong')}
            />
            <div className="min-w-0 flex-1">
              <p className="text-ui-sm tabular-nums">
                {range}
                {phase === 'ongoing' && <span className="ml-1.5 font-medium text-success">· идёт</span>}
              </p>
              <p className={cn('line-clamp-2 text-ui font-medium', !booking.title && 'font-normal text-muted-foreground')}>
                {booking.title ?? 'Без названия'}
              </p>
            </div>
            {phase !== 'past' && (
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon-sm" aria-label={`Изменить бронь ${range}`} onClick={() => onEdit(booking)}>
                  <IconPencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Удалить бронь ${range}`}
                  onClick={() => onDelete(booking)}
                >
                  <IconTrash aria-hidden />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
