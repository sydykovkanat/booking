'use client';

import { IconAlertTriangle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { type CalendarView, shiftAnchor, visibleRange, weekDays } from '@/domain/calendar';
import { useMediaQuery } from '@/hooks/use-media-query';
import { demoApi } from '@/lib/api/demo-api';

import { useBookingsRange } from '../api/queries';
import { bookingKeys } from '../api/query-keys';
import type { BookingFormValues } from '../form/booking-form-schema';
import { useCalendarState } from '../hooks/use-calendar-state';
import { useRoomNow } from '../hooks/use-room-now';
import { formatRange } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';
import { notify } from '../lib/notify';
import { BookingDialog, type DialogState } from './booking-dialog';
import { CalendarToolbar } from './calendar-toolbar';
import { DeleteBookingDialog } from './delete-booking-dialog';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';

export function CalendarScreen() {
  const now = useRoomNow();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [state, navigate] = useCalendarState(now?.date ?? null, isDesktop ? 'month' : 'day');

  if (!now || !state) return <ScreenSkeleton />;
  return <Calendar now={now} view={state.view} date={state.date} navigate={navigate} />;
}

interface CalendarProps {
  now: RoomNow;
  view: CalendarView;
  date: IsoDate;
  navigate: (next: { view?: CalendarView; date?: IsoDate }) => void;
}

function Calendar({ now, view, date, navigate }: CalendarProps) {
  const queryClient = useQueryClient();
  const { from, to } = visibleRange(view, date);
  const range = useBookingsRange(from, to);
  const bookings = range.data ?? [];
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const isCurrentPeriod = now.date >= from && now.date <= to;

  const create = (day: IsoDate = date < now.date ? now.date : date, slot?: TimeRange) => {
    const initialValues: BookingFormValues = { date: day, start: slot?.start ?? '', end: slot?.end ?? '', title: '' };
    setDialog({ mode: 'create', key: Date.now(), initialValues });
  };
  const edit = (booking: Booking) => setDialog({ mode: 'edit', key: Date.now(), booking });
  const openDay = (day: IsoDate) => navigate({ view: 'day', date: day });

  const handleSaved = (booking: Booking, mode: 'create' | 'edit') => {
    setDialog(null);
    notify('success', mode === 'edit' ? 'Бронь обновлена' : 'Переговорка забронирована', formatRange(booking));
  };

  const resetDemo = async () => {
    if (!(await demoApi.reset())) {
      notify('error', 'Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    notify('success', 'Данные сброшены к демо-набору');
  };

  const viewProps = { now, bookings, onEdit: edit, onDelete: setDeleting };

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <main className="flex min-h-dvh flex-1 flex-col gap-4 p-3 sm:p-5">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-card p-3 shadow-card sm:p-5">
          <CalendarToolbar
            view={view}
            date={date}
            isCurrentPeriod={isCurrentPeriod}
            refreshing={range.isFetching && !range.isPending}
            onToday={() => navigate({ date: now.date })}
            onShift={(direction) => navigate({ date: shiftAnchor(view, date, direction) })}
            onViewChange={(next) => navigate({ view: next })}
            onCreate={() => create()}
            onResetDemo={resetDemo}
          />

          {range.isError && (
            <Alert variant={range.data ? 'warning' : 'destructive'} role="alert">
              <IconAlertTriangle aria-hidden />
              <AlertTitle>{range.data ? 'Не удалось обновить расписание' : 'Не удалось загрузить бронирования'}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                {apiErrorMessage(range.error)}
                <Button size="xs" variant="secondary" onClick={() => range.refetch()}>
                  <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {range.isPending ? (
            <Skeleton className="min-h-[32rem] flex-1 rounded-xl" aria-label="Загружаем бронирования" />
          ) : view === 'month' ? (
            <MonthView date={date} onCreate={(day) => create(day)} onOpenDay={openDay} {...viewProps} />
          ) : (
            <TimeGrid
              days={view === 'week' ? weekDays(date) : [date]}
              pxPerMinute={view === 'week' ? 1 : 1.2}
              onCreate={create}
              onOpenDay={openDay}
              {...viewProps}
            />
          )}
        </div>
      </main>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-sticky size-14 rounded-2xl shadow-floating sm:hidden"
        aria-label="Новая бронь"
        onClick={() => create()}
      >
        <IconPlus className="size-6" aria-hidden />
      </Button>

      <BookingDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={handleSaved}
        onRecreate={(values) => setDialog({ mode: 'create', key: Date.now(), initialValues: values })}
      />
      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={() => setDeleting(null)} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="flex min-h-dvh bg-muted p-3 sm:p-5">
      <Skeleton className="flex-1 rounded-2xl" />
    </div>
  );
}
