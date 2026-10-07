'use client';

import { PlusIcon, RotateCcwIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { appConfig } from '@/config/app-config';
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
import { bookingElementId } from './agenda';
import { BookingEditor, type EditorRequest, type EditorState } from './booking-editor';
import { DayNavigator } from './day-navigator';
import { DaySchedule } from './day-schedule';
import { DeleteBookingDialog } from './delete-booking-dialog';

const PREFERRED_DURATION_MINUTES = 60;

function valuesForRange(date: IsoDate, range: TimeRange): BookingFormValues {
  const end = Math.min(toMinutes(range.start) + PREFERRED_DURATION_MINUTES, toMinutes(range.end));
  return { date, start: range.start, end: fromMinutes(end), title: '' };
}

function defaultCreateValues(date: IsoDate, bookings: readonly Booking[], now: RoomNow): BookingFormValues {
  const firstFree = buildAgenda({ date, bookings, now }).find((i) => i.kind === 'free');
  return firstFree ? valuesForRange(date, firstFree) : { date, start: '', end: '', title: '' };
}

function focusBooking(id: string) {
  requestAnimationFrame(() => document.getElementById(bookingElementId(id))?.focus());
}

export function BookingsScreen() {
  const now = useRoomNow();
  const [date, setDate] = useSelectedDate(now?.date ?? null);

  if (!now || !date) return <ScreenSkeleton />;
  return <BookingsDay now={now} date={date} onDateChange={setDate} />;
}

interface BookingsDayProps {
  now: RoomNow;
  date: IsoDate;
  onDateChange: (date: IsoDate) => void;
}

function BookingsDay({ now, date, onDateChange }: BookingsDayProps) {
  const queryClient = useQueryClient();
  const { data: bookings = [] } = useBookings(date);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const [preview, setPreview] = useState<BookingPreview | null>(null);

  const readOnly = date < now.date;
  const hasFreeTime = useMemo(
    () => buildAgenda({ date, bookings, now }).some((i) => i.kind === 'free'),
    [date, bookings, now],
  );
  const canCreate = !readOnly && hasFreeTime;
  const visiblePreview = preview?.date === date ? preview : undefined;
  const highlightedIds = useMemo(() => new Set(visiblePreview?.conflictIds ?? []), [visiblePreview]);

  const openEditor = (request: EditorRequest) => setEditor({ ...request, key: Date.now() });

  const closeEditor = useCallback(() => setEditor(null), []);

  const handleSaved = (saved: Booking) => {
    toast.success(
      editor?.mode === 'edit' ? `Бронь обновлена: ${formatRange(saved)}` : `Забронировано: ${formatRange(saved)}`,
    );
    setEditor(null);
    if (saved.date !== date) onDateChange(saved.date);
    focusBooking(saved.id);
  };

  const handleDeleted = (booking: Booking) => {
    setDeleting(null);
    if (editor?.mode === 'edit' && editor.booking.id === booking.id) setEditor(null);
  };

  const resetDemo = async () => {
    if (!(await demoApi.reset())) {
      toast.error('Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    setEditor(null);
    toast.success('Данные сброшены к демо-набору');
  };

  const startCreate = () =>
    openEditor({ mode: 'create', initialValues: defaultCreateValues(date, bookings, now) });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 lg:pb-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Переговорка</h1>
          <p className="mt-1 text-sm text-muted-foreground">Бронирование на рабочий день, 09:00–18:00</p>
        </div>
        {appConfig.demoTools && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetDemo}>
            <RotateCcwIcon /> Сбросить демо-данные
          </Button>
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <main className="flex min-w-0 flex-col gap-6">
          <DayNavigator date={date} now={now} onChange={onDateChange} />
          {readOnly && (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Прошедшая дата — только просмотр.
            </p>
          )}
          <DaySchedule
            date={date}
            now={now}
            readOnly={readOnly}
            selection={visiblePreview}
            highlightedIds={highlightedIds}
            onBook={(range) => openEditor({ mode: 'create', initialValues: valuesForRange(date, range) })}
            onEdit={(booking) => openEditor({ mode: 'edit', booking })}
            onDelete={setDeleting}
          />
        </main>

        <BookingEditor
          editor={editor}
          canCreate={canCreate}
          cannotCreateReason={readOnly ? 'Прошедшие даты доступны только для просмотра.' : 'На этот день свободного времени не осталось — выберите другую дату.'}
          onCreate={startCreate}
          onSuccess={handleSaved}
          onCancel={closeEditor}
          onSwitchToCreate={(values) => openEditor({ mode: 'create', initialValues: values })}
          onPreviewChange={setPreview}
        />
      </div>

      {canCreate && !editor && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-linear-to-t from-background via-background/90 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button size="lg" className="w-full" onClick={startCreate}>
            <PlusIcon /> Новая бронь
          </Button>
        </div>
      )}

      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="mt-3 h-4 w-72 rounded-full" />
      <Skeleton className="mt-8 h-11 w-full max-w-md rounded-xl" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
