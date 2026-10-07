'use client';

import { IconAlertTriangle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type RefObject, type TouchEvent, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { type CalendarView, shiftAnchor, visibleRange, weekDays } from '@/domain/calendar';
import { getBookingPhase } from '@/domain/rules';
import { buildAgenda } from '@/domain/schedule';
import { rangeAtMinute } from '@/domain/selection';
import { toMinutes } from '@/domain/time';
import { useMediaQuery } from '@/hooks/use-media-query';
import { demoApi } from '@/lib/api/demo-api';

import { useBookingsRange } from '../api/queries';
import { bookingKeys } from '../api/query-keys';
import { QuickBookingForm } from '../composer/quick-booking-form';
import { type Presentation, Surface } from '../composer/surface';
import type { BookingFormValues } from '../form/booking-form-schema';
import type { BookingPreview } from '../form/use-booking-form-controller';
import { useCalendarState } from '../hooks/use-calendar-state';
import { useRoomNow } from '../hooks/use-room-now';
import { formatRange, isoDateToLocalDate } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';
import { notify } from '../lib/notify';
import { AgendaList } from './agenda-list';
import { BookingDetails } from './booking-details';
import { CalendarToolbar } from './calendar-toolbar';
import { DeleteBookingDialog } from './delete-booking-dialog';
import { MonthView } from './month-view';
import { type Draft, type SelectVia, TimeGrid } from './time-grid';

const SWIPE_MIN_PX = 60;

/** `'draft-cell'`: the month cell of the draft's current day, which moves with the draft. */
type Anchor = Element | null | RefObject<Element | null> | 'draft-cell';

type Panel =
  | {
      kind: 'compose';
      key: number;
      mode: 'create' | 'edit';
      initialValues: BookingFormValues;
      original?: Booking;
      presentation: Presentation;
      anchor: Anchor;
    }
  | { kind: 'details'; key: number; booking: Booking; presentation: Presentation; anchor: Anchor };

export function CalendarScreen() {
  const now = useRoomNow();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [state, navigate] = useCalendarState(now?.date ?? null, isDesktop ? 'month' : 'day');

  if (!now || !state) return <ScreenSkeleton />;
  return <Calendar now={now} view={state.view} date={state.date} compact={!isDesktop} navigate={navigate} />;
}

interface CalendarProps {
  now: RoomNow;
  view: CalendarView;
  date: IsoDate;
  compact: boolean;
  navigate: (next: { view?: CalendarView; date?: IsoDate }) => void;
}

function Calendar({ now, view, date, compact, navigate }: CalendarProps) {
  const queryClient = useQueryClient();
  const { from, to } = visibleRange(view, date);
  const range = useBookingsRange(from, to);
  const bookings = range.data ?? [];
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const [draftCell, setDraftCell] = useState<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const isCurrentPeriod = now.date >= from && now.date <= to;
  const floating: Presentation = compact ? 'drawer' : 'popover';

  /** First free hour of a day, or null when the day is full or over. */
  const firstFreeRange = (day: IsoDate): TimeRange | null => {
    const ctx = { date: day, bookings, now };
    const free = buildAgenda(ctx).find((i) => i.kind === 'free');
    return free ? rangeAtMinute(ctx, toMinutes(free.start)) : null;
  };

  const close = () => {
    setPanel(null);
    setDraft(null);
  };

  const compose = (day: IsoDate, slot: TimeRange, presentation: Presentation, anchor: Anchor) => {
    setDraft({ day, ...slot, conflict: false });
    setPanel({
      kind: 'compose',
      key: Date.now(),
      mode: 'create',
      initialValues: { date: day, start: slot.start, end: slot.end, title: '' },
      presentation,
      anchor,
    });
  };

  const composeOnDay = (day: IsoDate, presentation: Presentation, anchor: Anchor = null) => {
    const slot = firstFreeRange(day);
    if (!slot) {
      notify('info', 'Свободного времени нет', 'На этот день всё занято или рабочий день уже закончился.');
      return;
    }
    compose(day, slot, presentation, anchor);
  };

  const createFromToolbar = () => {
    const day = date < now.date ? now.date : date;
    composeOnDay(day, compact ? 'drawer' : 'dialog');
  };

  const onSelectRange = (day: IsoDate, slot: TimeRange, via: SelectVia) =>
    compose(day, slot, via === 'touch' || compact ? 'drawer' : 'popover', draftRef);

  const showDetails = (booking: Booking, element: HTMLElement) => {
    setDraft(null);
    setPanel({ kind: 'details', key: Date.now(), booking, presentation: floating, anchor: element });
  };

  const edit = (booking: Booking, anchor: Anchor) =>
    setPanel({
      kind: 'compose',
      key: Date.now(),
      mode: 'edit',
      original: booking,
      initialValues: { date: booking.date, start: booking.start, end: booking.end, title: booking.title ?? '' },
      presentation: floating,
      anchor,
    });

  const onPreviewChange = (preview: BookingPreview | null) => {
    // Keep the last draft while the form is incomplete: the popover is anchored to it.
    if (!preview) return;
    setDraft({ day: preview.date, start: preview.start, end: preview.end, conflict: preview.conflict });
    // The date was changed in the form: bring that day into view so the draft (and the popover) follow.
    if (preview.date < from || preview.date > to) navigate({ date: preview.date });
  };

  const onSaved = (booking: Booking, mode: 'create' | 'edit') => {
    close();
    notify('success', mode === 'edit' ? 'Бронь обновлена' : 'Переговорка забронирована', formatRange(booking));
    if (booking.date < from || booking.date > to) navigate({ date: booking.date });
  };

  const resetDemo = async () => {
    if (!(await demoApi.reset())) {
      notify('error', 'Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    close();
    notify('success', 'Данные сброшены к демо-набору');
  };

  // Phones: swipe left/right to change the period.
  const onTouchStart = (e: TouchEvent) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !compact) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigate({ date: shiftAnchor(view, date, dx < 0 ? 1 : -1) });
    }
  };

  const editingId = panel?.kind === 'compose' && panel.mode === 'edit' ? panel.original!.id : null;
  const freshDetails =
    panel?.kind === 'details' ? (bookings.find((b) => b.id === panel.booking.id) ?? panel.booking) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <main className="flex min-h-dvh flex-1 flex-col p-2 pb-24 sm:p-5">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-card p-3 sm:p-5">
          <CalendarToolbar
            view={view}
            date={date}
            compact={compact}
            isCurrentPeriod={isCurrentPeriod}
            refreshing={range.isFetching && !range.isPending}
            onToday={() => navigate({ date: now.date })}
            onShift={(direction) => navigate({ date: shiftAnchor(view, date, direction) })}
            onViewChange={(next) => navigate({ view: next })}
            onCreate={createFromToolbar}
            onResetDemo={resetDemo}
          />

          {range.isError && range.data && (
            <Alert variant="warning" role="alert">
              <IconAlertTriangle aria-hidden />
              <AlertTitle>Не удалось обновить расписание</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                {apiErrorMessage(range.error)}
                <Button size="xs" variant="secondary" onClick={() => range.refetch()}>
                  <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex min-h-0 flex-1 flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {range.isPending ? (
              <Skeleton role="status" className="min-h-[32rem] flex-1 rounded-xl" aria-label="Загружаем бронирования" />
            ) : !range.data ? (
              // Without data the grid would look entirely free: show the error instead of it.
              <Empty role="alert" className="flex-1 rounded-xl bg-muted/50">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                    <IconAlertTriangle />
                  </EmptyMedia>
                  <EmptyTitle>Не удалось загрузить бронирования</EmptyTitle>
                  <EmptyDescription>{apiErrorMessage(range.error)}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="secondary" onClick={() => range.refetch()}>
                    <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
                  </Button>
                </EmptyContent>
              </Empty>
            ) : view === 'month' ? (
              <>
                <MonthView
                  date={date}
                  now={now}
                  bookings={bookings}
                  compact={compact}
                  activeCreateDay={panel?.kind === 'compose' && draft ? draft.day : null}
                  onActiveCell={setDraftCell}
                  onCreate={(day) => composeOnDay(day, floating, 'draft-cell')}
                  onPickDay={(day) => navigate({ date: day })}
                  onOpenDay={(day) => navigate({ view: 'day', date: day })}
                  onSelectBooking={showDetails}
                />
                {compact && (
                  <section className="mt-5 flex flex-col gap-3">
                    <h2 className="text-ui font-semibold first-letter:uppercase">
                      {format(isoDateToLocalDate(date), 'EEEE, d MMMM', { locale: ru })}
                    </h2>
                    <AgendaList days={[date]} hideHeaders now={now} bookings={bookings} onSelectBooking={showDetails} />
                  </section>
                )}
              </>
            ) : view === 'week' && compact ? (
              <AgendaList
                days={weekDays(date)}
                now={now}
                bookings={bookings}
                onSelectBooking={showDetails}
                onOpenDay={(day) => navigate({ view: 'day', date: day })}
              />
            ) : (
              <TimeGrid
                days={view === 'week' ? weekDays(date) : [date]}
                now={now}
                bookings={bookings}
                draft={draft}
                draftRef={draftRef}
                editingId={editingId}
                onSelectRange={onSelectRange}
                onSelectBooking={showDetails}
                onOpenDay={(day) => navigate({ view: 'day', date: day })}
              />
            )}
          </div>
        </div>
      </main>

      {compact && (
        <Button
          size="icon-lg"
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-sticky size-14 rounded-2xl shadow-floating"
          aria-label="Новая бронь"
          onClick={createFromToolbar}
        >
          <IconPlus className="size-6" aria-hidden />
        </Button>
      )}

      <Surface
        open={panel !== null}
        presentation={panel?.presentation ?? 'dialog'}
        anchor={panel?.anchor === 'draft-cell' ? draftCell : panel?.anchor}
        label={panel?.kind === 'details' ? 'Бронь' : panel?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь'}
        onClose={close}
      >
        {panel?.kind === 'compose' && (
          <QuickBookingForm
            key={panel.key}
            mode={panel.mode}
            original={panel.original}
            initialValues={panel.initialValues}
            autoFocusTitle={!compact}
            onSaved={onSaved}
            onCancel={close}
            onRecreate={(values) =>
              setPanel({ ...panel, key: Date.now(), mode: 'create', original: undefined, initialValues: values })
            }
            onPreviewChange={onPreviewChange}
          />
        )}
        {panel?.kind === 'details' && freshDetails && (
          <BookingDetails
            booking={freshDetails}
            phase={getBookingPhase(freshDetails, now)}
            onEdit={() => edit(freshDetails, panel.anchor === 'draft-cell' ? draftCell : panel.anchor)}
            onDelete={() => {
              close();
              setDeleting(freshDetails);
            }}
          />
        )}
      </Surface>

      <DeleteBookingDialog booking={deleting} onClose={() => setDeleting(null)} onDeleted={() => setDeleting(null)} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Загрузка" className="flex min-h-dvh bg-muted p-2 sm:p-5">
      <Skeleton className="flex-1 rounded-2xl" />
    </div>
  );
}
