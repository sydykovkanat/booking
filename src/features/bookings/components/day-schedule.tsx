'use client';

import { IconAlertTriangle, IconCalendarCheck, IconCalendarOff, IconRefresh } from '@tabler/icons-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { buildAgenda } from '@/domain/schedule';

import { useBookings } from '../api/queries';
import { apiErrorMessage } from '../lib/messages';
import { Agenda } from './agenda';
import { OccupancyBar } from './occupancy-bar';

interface DayScheduleProps {
  date: IsoDate;
  now: RoomNow;
  readOnly: boolean;
  selection?: TimeRange & { conflict: boolean };
  highlightedIds: ReadonlySet<string>;
  onBook: (range: TimeRange) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

export function DaySchedule({ date, now, readOnly, selection, highlightedIds, onBook, onEdit, onDelete }: DayScheduleProps) {
  const { data, isPending, isError, error, isFetching, refetch } = useBookings(date);
  const agenda = useMemo(() => (data ? buildAgenda({ date, bookings: data, now }) : []), [data, date, now]);

  if (isPending) return <ScheduleSkeleton />;

  if (isError && !data) {
    return (
      <Empty className="rounded-xl bg-muted/50" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <IconAlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Не удалось загрузить бронирования</EmptyTitle>
          <EmptyDescription>{apiErrorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => refetch()}>
            <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const bookings = data ?? [];
  const hasFreeTime = agenda.some((i) => i.kind === 'free');

  return (
    <section aria-labelledby="schedule-heading" aria-busy={isFetching} className="flex flex-col gap-5">
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h2 id="schedule-heading" className="text-ui-sm font-medium text-muted-foreground">
          {bookings.length > 0 ? `Бронирований: ${bookings.length}` : 'Бронирований нет'}
        </h2>
        <p aria-live="polite" className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
          {isFetching && (
            <>
              <Spinner className="size-3.5" label="Обновляем расписание" /> Обновляем…
            </>
          )}
        </p>
      </div>

      <OccupancyBar date={date} now={now} bookings={bookings} selection={selection} />

      {isError && (
        <Alert variant="warning" role="alert">
          <IconAlertTriangle aria-hidden />
          <AlertTitle>Не удалось обновить расписание</AlertTitle>
          <AlertDescription>
            Данные могут быть неактуальны.{' '}
            <button type="button" className="underline underline-offset-4" onClick={() => refetch()}>
              Обновить
            </button>
          </AlertDescription>
        </Alert>
      )}

      {bookings.length === 0 && <EmptyDay readOnly={readOnly} hasFreeTime={hasFreeTime} />}

      {agenda.length > 0 && (
        <Agenda
          items={agenda}
          readOnly={readOnly}
          highlightedIds={highlightedIds}
          onBook={onBook}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {!readOnly && !hasFreeTime && bookings.length > 0 && (
        <p className="text-center text-ui-sm text-muted-foreground">На этот день свободного времени больше нет.</p>
      )}
    </section>
  );
}

function EmptyDay({ readOnly, hasFreeTime }: { readOnly: boolean; hasFreeTime: boolean }) {
  const [title, description] = readOnly
    ? ['В этот день переговорку не бронировали', 'Прошедшие даты доступны только для просмотра.']
    : hasFreeTime
      ? ['Весь день свободен', 'Выберите удобное время ниже.']
      : ['Рабочий день закончился', 'На сегодня бронирование уже недоступно — выберите другую дату.'];

  return (
    <Empty className="rounded-xl bg-muted/50 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">{hasFreeTime ? <IconCalendarCheck /> : <IconCalendarOff />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загружаем расписание" className="flex flex-col gap-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
