'use client';

import { AlertCircleIcon, CalendarCheckIcon, Loader2Icon, RotateCwIcon } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
      <StatePanel
        icon={<AlertCircleIcon className="text-destructive" />}
        title="Не удалось загрузить бронирования"
        description={apiErrorMessage(error)}
        role="alert"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCwIcon /> Повторить
          </Button>
        }
      />
    );
  }

  const bookings = data ?? [];

  return (
    <section aria-labelledby="schedule-heading" aria-busy={isFetching} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="schedule-heading" className="text-sm font-medium text-muted-foreground">
          {bookings.length > 0 ? `Бронирований: ${bookings.length}` : 'Бронирований нет'}
        </h2>
        <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching && (
            <>
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Обновляем…
            </>
          )}
        </p>
      </div>

      <OccupancyBar date={date} now={now} bookings={bookings} selection={selection} />

      {isError && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-warning/10 p-3 pl-4 text-sm">
          <AlertCircleIcon className="size-4 shrink-0 text-warning" aria-hidden />
          <p className="flex-1">Не удалось обновить расписание — данные могут быть неактуальны.</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Обновить
          </Button>
        </div>
      )}

      {bookings.length === 0 && (
        <StatePanel
          icon={<CalendarCheckIcon className="text-muted-foreground" />}
          title={readOnly ? 'В этот день переговорку не бронировали' : 'Весь день свободен'}
          description={readOnly ? 'Прошедшие даты доступны только для просмотра.' : 'Выберите удобное время ниже.'}
        />
      )}

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

      {!readOnly && agenda.every((i) => i.kind === 'booking') && bookings.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">На этот день свободного времени больше нет.</p>
      )}
    </section>
  );
}

interface StatePanelProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  role?: 'alert';
}

function StatePanel({ icon, title, description, action, role }: StatePanelProps) {
  return (
    <div role={role} className="flex flex-col items-center gap-2 rounded-3xl bg-card/70 px-6 py-10 text-center">
      <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-muted [&_svg]:size-5" aria-hidden>
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загружаем расписание" className="flex flex-col gap-5">
      <Skeleton className="h-4 w-32 rounded-full" />
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
