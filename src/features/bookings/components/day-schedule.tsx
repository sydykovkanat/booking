'use client';

import { IconAlertTriangle, IconCalendarOff, IconRefresh } from '@tabler/icons-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { buildAgenda } from '@/domain/schedule';

import { useBookings } from '../api/queries';
import { apiErrorMessage } from '../lib/messages';
import { DayTimeline, type TimelineSelection } from './day-timeline';

interface DayScheduleProps {
  date: IsoDate;
  now: RoomNow;
  readOnly: boolean;
  selectedBookingId: string | null;
  selection?: TimelineSelection;
  highlightedIds: ReadonlySet<string>;
  onBook: (range: TimeRange) => void;
  onSelectBooking: (booking: Booking) => void;
}

/** Loads the day and renders its state: skeleton, error, empty notice or the timeline. */
export function DaySchedule({ date, now, readOnly, ...timelineProps }: DayScheduleProps) {
  const { data, isPending, isError, error, refetch } = useBookings(date);
  const agenda = useMemo(() => (data ? buildAgenda({ date, bookings: data, now }) : []), [data, date, now]);

  if (isPending) return <TimelineSkeleton />;

  if (isError && !data) {
    return (
      <Empty className="rounded-2xl bg-muted/50" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <IconAlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Не удалось загрузить бронирования</EmptyTitle>
          <EmptyDescription>{apiErrorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" onClick={() => refetch()}>
            <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const bookings = data ?? [];
  const hasFreeTime = agenda.some((i) => i.kind === 'free');
  const notice = !hasFreeTime && bookings.length === 0 ? (readOnly ? 'past-empty' : 'day-over') : null;

  return (
    <div className="flex flex-col gap-4">
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

      {notice && (
        <Empty className="rounded-2xl bg-muted/50 py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconCalendarOff />
            </EmptyMedia>
            <EmptyTitle>
              {notice === 'past-empty' ? 'В этот день переговорку не бронировали' : 'Рабочий день закончился'}
            </EmptyTitle>
            <EmptyDescription>
              {notice === 'past-empty'
                ? 'Прошедшие даты доступны только для просмотра.'
                : 'На сегодня бронирование уже недоступно — выберите другую дату.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!readOnly && hasFreeTime && bookings.length === 0 && (
        <p className="text-ui-sm text-muted-foreground">Весь день свободен — нажмите на время, чтобы забронировать.</p>
      )}

      <DayTimeline date={date} now={now} items={agenda} readOnly={readOnly} {...timelineProps} />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загружаем расписание" className="grid grid-cols-[3.5rem_1fr] gap-0">
      <div />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
