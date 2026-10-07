'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { buildAgenda } from '@/domain/schedule';
import { fromMinutes, toMinutes } from '@/domain/time';
import { demoApi } from '@/lib/api/demo-api';

import { useBookings } from '../api/queries';
import { bookingKeys } from '../api/query-keys';
import type { BookingPreview } from '../form/booking-form';
import type { BookingFormValues } from '../form/booking-form-schema';
import { useRoomNow } from '../hooks/use-room-now';
import { useSelectedDate } from '../hooks/use-selected-date';
import { formatRange } from '../lib/format';
import { notify } from '../lib/notify';
import { AppHeader } from './app-header';
import { DaySchedule } from './day-schedule';
import { DayToolbar } from './day-toolbar';
import { bookingElementId } from './day-timeline';
import { DeleteBookingDialog } from './delete-booking-dialog';
import { type EditorRequest, Inspector, type PanelRequest, type PanelState } from './inspector';

const PREFERRED_DURATION_MINUTES = 60;

function valuesForRange(date: IsoDate, range: TimeRange): BookingFormValues {
  const end = Math.min(toMinutes(range.start) + PREFERRED_DURATION_MINUTES, toMinutes(range.end));
  return { date, start: range.start, end: fromMinutes(end), title: '' };
}

function focusBooking(id: string) {
  requestAnimationFrame(() => document.getElementById(bookingElementId(id))?.focus());
}

export function BookingsScreen() {
  const now = useRoomNow();
  const [date, setDate] = useSelectedDate(now?.date ?? null);

  if (!now || !date) return <ScreenSkeleton />;
  return <BookingsApp now={now} date={date} onDateChange={setDate} />;
}

interface BookingsAppProps {
  now: RoomNow;
  date: IsoDate;
  onDateChange: (date: IsoDate) => void;
}

function BookingsApp({ now, date, onDateChange }: BookingsAppProps) {
  const queryClient = useQueryClient();
  const day = useBookings(date);
  const bookings = useMemo(() => day.data ?? [], [day.data]);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const [preview, setPreview] = useState<BookingPreview | null>(null);

  const readOnly = date < now.date;
  const freeWindows = useMemo(
    () => buildAgenda({ date, bookings, now }).filter((i) => i.kind === 'free'),
    [date, bookings, now],
  );
  const canCreate = !readOnly && freeWindows.length > 0;
  const cannotCreateReason = readOnly
    ? 'Прошедшие даты доступны только для просмотра.'
    : 'На этот день свободного времени не осталось — выберите другую дату.';

  // Details always show the freshest copy; a booking deleted meanwhile closes the panel.
  const shownPanel = useMemo<PanelState | null>(() => {
    if (panel?.kind !== 'details' || panel.booking.date !== date || !day.data) return panel;
    const fresh = day.data.find((b) => b.id === panel.booking.id);
    return fresh ? { ...panel, booking: fresh } : null;
  }, [panel, date, day.data]);

  const selectedBookingId =
    shownPanel?.kind === 'details'
      ? shownPanel.booking.id
      : shownPanel?.kind === 'form' && shownPanel.editor.mode === 'edit'
        ? shownPanel.editor.booking.id
        : null;
  const visiblePreview = preview?.date === date ? preview : undefined;
  const highlightedIds = useMemo(() => new Set(visiblePreview?.conflictIds ?? []), [visiblePreview]);

  const open = (request: PanelRequest) => setPanel({ ...request, key: Date.now() });
  const openForm = (editor: EditorRequest) => open({ kind: 'form', editor });
  const closePanel = useCallback(() => setPanel(null), []);

  const startCreate = () =>
    openForm({
      mode: 'create',
      initialValues: freeWindows[0] ? valuesForRange(date, freeWindows[0]) : { date, start: '', end: '', title: '' },
    });

  const handleSaved = (saved: Booking) => {
    const wasEdit = panel?.kind === 'form' && panel.editor.mode === 'edit';
    notify('success', wasEdit ? `Бронь обновлена: ${formatRange(saved)}` : `Забронировано: ${formatRange(saved)}`);
    if (saved.date !== date) onDateChange(saved.date);
    open({ kind: 'details', booking: saved });
    focusBooking(saved.id);
  };

  const handleDeleted = (booking: Booking) => {
    setDeleting(null);
    if (selectedBookingId === booking.id) setPanel(null);
  };

  const resetDemo = async () => {
    if (!(await demoApi.reset())) {
      notify('error', 'Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    setPanel(null);
    notify('success', 'Данные сброшены к демо-набору');
  };

  return (
    <div className="min-h-dvh bg-muted">
      <div className="site-container flex max-w-6xl flex-col gap-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28 md:gap-6 md:pt-6 lg:pb-10">
        <AppHeader onResetDemo={resetDemo} />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6">
          <main className="flex min-w-0 flex-col gap-5 rounded-2xl bg-card p-4 shadow-card sm:p-6">
            <DayToolbar
              date={date}
              now={now}
              bookingsCount={day.data ? bookings.length : null}
              refreshing={day.isFetching && !day.isPending}
              onChange={onDateChange}
            />
            <DaySchedule
              date={date}
              now={now}
              readOnly={readOnly}
              selectedBookingId={selectedBookingId}
              selection={visiblePreview}
              highlightedIds={highlightedIds}
              onBook={(range) => openForm({ mode: 'create', initialValues: valuesForRange(date, range) })}
              onSelectBooking={(booking) => open({ kind: 'details', booking })}
            />
          </main>

          <Inspector
            panel={shownPanel}
            now={now}
            canCreate={canCreate}
            cannotCreateReason={cannotCreateReason}
            onCreate={startCreate}
            onEdit={(booking) => openForm({ mode: 'edit', booking })}
            onDelete={setDeleting}
            onClose={closePanel}
            onSuccess={handleSaved}
            onSwitchToCreate={(values) => openForm({ mode: 'create', initialValues: values })}
            onPreviewChange={setPreview}
          />
        </div>
      </div>

      {canCreate && !panel && (
        <Button
          size="icon-lg"
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-sticky size-14 rounded-2xl shadow-floating lg:hidden"
          aria-label="Новая бронь"
          onClick={startCreate}
        >
          <IconPlus className="size-6" aria-hidden />
        </Button>
      )}

      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="min-h-dvh bg-muted">
      <div className="site-container flex max-w-6xl flex-col gap-4 pt-4 md:gap-6 md:pt-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6">
          <Skeleton className="h-[720px] rounded-2xl" />
          <Skeleton className="hidden h-80 rounded-2xl lg:block" />
        </div>
      </div>
    </div>
  );
}
