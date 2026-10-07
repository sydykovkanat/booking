'use client';

import { IconCircleCheck, IconRestore } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { appConfig } from '@/config/app-config';
import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { demoApi } from '@/lib/api/demo-api';

import { bookingKeys } from '../api/query-keys';
import type { BookingFormValues } from '../form/booking-form-schema';
import { useRoomNow } from '../hooks/use-room-now';
import { useSelectedDate } from '../hooks/use-selected-date';
import { formatRange, isoDateToLocalDate } from '../lib/format';
import { notify } from '../lib/notify';
import { BookingFlow } from './booking-flow';
import { DeleteBookingDialog } from './delete-booking-dialog';
import { InfoPanel } from './info-panel';

type FlowState =
  | { mode: 'create'; key: number; initialValues: BookingFormValues }
  | { mode: 'edit'; key: number; booking: Booking };

const emptyValues = (date: IsoDate): BookingFormValues => ({ date, start: '', end: '', title: '' });

const toValues = (booking: Booking): BookingFormValues => ({
  date: booking.date,
  start: booking.start,
  end: booking.end,
  title: booking.title ?? '',
});

export function BookingsScreen() {
  const now = useRoomNow();
  const [date, setDate] = useSelectedDate(now?.date ?? null);

  if (!now || !date) return <ScreenSkeleton />;
  return <BookingPage now={now} date={date} onDateChange={setDate} />;
}

interface BookingPageProps {
  now: RoomNow;
  date: IsoDate;
  onDateChange: (date: IsoDate) => void;
}

function BookingPage({ now, date, onDateChange }: BookingPageProps) {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<FlowState>(() => ({ mode: 'create', key: 0, initialValues: emptyValues(date) }));
  const [done, setDone] = useState<{ booking: Booking; mode: 'create' | 'edit' } | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const startCreate = (values: BookingFormValues = emptyValues(date)) => {
    setDone(null);
    setFlow({ mode: 'create', key: Date.now(), initialValues: values });
  };

  const startEdit = (booking: Booking) => {
    setDone(null);
    onDateChange(booking.date);
    setFlow({ mode: 'edit', key: Date.now(), booking });
  };

  // The confirmation screen announces the result itself (role="status"), so no toast here.
  const handleSaved = (booking: Booking, mode: 'create' | 'edit') => {
    onDateChange(booking.date);
    setDone({ booking, mode });
  };

  const handleDeleted = (booking: Booking) => {
    setDeleting(null);
    if (flow.mode === 'edit' && flow.booking.id === booking.id) startCreate();
  };

  const resetDemo = async () => {
    if (!(await demoApi.reset())) {
      notify('error', 'Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    startCreate();
    notify('success', 'Данные сброшены к демо-набору');
  };

  const activeBookingId = done ? done.booking.id : flow.mode === 'edit' ? flow.booking.id : null;

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <main className="site-container flex max-w-[68rem] flex-1 flex-col justify-center py-4 md:py-10">
        <div className="grid overflow-hidden rounded-2xl bg-card shadow-card lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="bg-muted/40 p-5 sm:p-8">
            <InfoPanel date={date} now={now} activeBookingId={activeBookingId} onEdit={startEdit} onDelete={setDeleting} />
          </div>

          <div className="p-5 sm:p-8 lg:min-h-[36rem]">
            {done ? (
              <DoneStep booking={done.booking} mode={done.mode} onAgain={() => startCreate()} />
            ) : (
              <BookingFlow
                key={flow.key}
                mode={flow.mode}
                original={flow.mode === 'edit' ? flow.booking : undefined}
                initialValues={flow.mode === 'edit' ? toValues(flow.booking) : flow.initialValues}
                onDateChange={onDateChange}
                onSaved={handleSaved}
                onCancelEdit={() => startCreate()}
                onRecreate={startCreate}
              />
            )}
          </div>
        </div>

        {appConfig.demoTools && (
          <Button variant="ghost" size="sm" className="mt-4 self-center text-muted-foreground" onClick={resetDemo}>
            <IconRestore data-icon="inline-start" aria-hidden /> Сбросить демо-данные
          </Button>
        )}
      </main>

      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
    </div>
  );
}

interface DoneStepProps {
  booking: Booking;
  mode: 'create' | 'edit';
  onAgain: () => void;
}

function DoneStep({ booking, mode, onAgain }: DoneStepProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
        <IconCircleCheck className="size-8" />
      </div>
      <div role="status">
        <h2 className="text-xl font-semibold">{mode === 'edit' ? 'Бронь обновлена' : 'Готово, переговорка ваша'}</h2>
        <p className="mt-1 text-muted-foreground first-letter:uppercase">
          {format(isoDateToLocalDate(booking.date), 'EEEE, d MMMM', { locale: ru })} · {formatRange(booking)}
        </p>
        {booking.title && <p className="mt-1 font-medium">{booking.title}</p>}
      </div>
      <Button size="lg" variant="secondary" onClick={onAgain}>
        Забронировать ещё
      </Button>
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="flex min-h-dvh items-center bg-muted">
      <div className="site-container max-w-[68rem]">
        <Skeleton className="h-[560px] rounded-2xl" />
      </div>
    </div>
  );
}
