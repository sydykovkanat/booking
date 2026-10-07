'use client';

import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { type CalendarView, weekDays } from '@/domain/calendar';

import type { CalendarPanels } from '../hooks/use-calendar-panels';
import { isoDateToLocalDate } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';
import { AgendaList } from './agenda-list';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';

interface CalendarBodyProps {
  view: CalendarView;
  date: IsoDate;
  now: RoomNow;
  compact: boolean;
  /** `undefined` while the first load is pending or after it failed. */
  bookings: readonly Booking[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  panels: CalendarPanels;
  navigate: (next: { view?: CalendarView; date?: IsoDate }) => void;
}

/** Loading, error, or the view itself. Phones get list layouts where a grid would be too narrow. */
export function CalendarBody({ view, date, now, compact, bookings, loading, error, onRetry, panels, navigate }: CalendarBodyProps) {
  if (loading) {
    return <Skeleton role="status" className="min-h-[32rem] flex-1 rounded-xl" aria-label="Загружаем бронирования" />;
  }
  // Without data the grid would look entirely free: show the error instead of it.
  if (!bookings) return <LoadError error={error} onRetry={onRetry} />;

  const openDay = (day: IsoDate) => navigate({ view: 'day', date: day });

  if (view === 'month') {
    return (
      <>
        <MonthView
          date={date}
          now={now}
          bookings={bookings}
          compact={compact}
          activeCreateDay={panels.activeCreateDay}
          onActiveCell={panels.setDraftCell}
          onCreate={panels.createOnMonthDay}
          onPickDay={(day) => navigate({ date: day })}
          onOpenDay={openDay}
          onSelectBooking={panels.showDetails}
        />
        {compact && (
          <section className="mt-5 flex flex-col gap-3">
            <h2 className="text-ui font-semibold first-letter:uppercase">
              {format(isoDateToLocalDate(date), 'EEEE, d MMMM', { locale: ru })}
            </h2>
            <AgendaList days={[date]} hideHeaders now={now} bookings={bookings} onSelectBooking={panels.showDetails} />
          </section>
        )}
      </>
    );
  }

  if (view === 'week' && compact) {
    return (
      <AgendaList days={weekDays(date)} now={now} bookings={bookings} onSelectBooking={panels.showDetails} onOpenDay={openDay} />
    );
  }

  return (
    <>
      {view === 'day' && <EmptyDayHint date={date} now={now} bookings={bookings} compact={compact} />}
      <TimeGrid
      days={view === 'week' ? weekDays(date) : [date]}
      now={now}
      bookings={bookings}
      draft={panels.draft}
      draftRef={panels.draftRef}
      editingId={panels.editingId}
      onSelectRange={panels.selectRange}
      onSelectBooking={panels.showDetails}
      onOpenDay={openDay}
      />
    </>
  );
}

/** The day view says it in words when a day has no bookings, instead of an unexplained empty grid. */
function EmptyDayHint({ date, now, bookings, compact }: { date: IsoDate; now: RoomNow; bookings: readonly Booking[]; compact: boolean }) {
  if (bookings.some((b) => b.date === date)) return null;
  const text =
    date < now.date
      ? 'В этот день броней не было.'
      : `Броней нет — ${compact ? 'нажмите' : 'выделите'} время в сетке, чтобы забронировать.`;
  return (
    <p role="status" className="rounded-lg bg-muted/50 px-4 py-3 text-ui-sm text-muted-foreground">
      {text}
    </p>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Empty role="alert" className="flex-1 rounded-xl bg-muted/50">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <IconAlertTriangle />
        </EmptyMedia>
        <EmptyTitle>Не удалось загрузить бронирования</EmptyTitle>
        <EmptyDescription>{apiErrorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary" onClick={onRetry}>
          <IconRefresh data-icon="inline-start" aria-hidden /> Повторить
        </Button>
      </EmptyContent>
    </Empty>
  );
}
