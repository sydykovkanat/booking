'use client';

import { IconAlertTriangle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, IsoDate, RoomNow } from '@/domain/booking';
import { type CalendarView, shiftAnchor, visibleRange } from '@/domain/calendar';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSwipe } from '@/hooks/use-swipe';

import { useBookingsRange } from '../api/queries';
import { useCalendarPanels } from '../hooks/use-calendar-panels';
import { useCalendarState } from '../hooks/use-calendar-state';
import { useResetDemo } from '../hooks/use-reset-demo';
import { useRoomNow } from '../hooks/use-room-now';
import { apiErrorMessage } from '../lib/messages';
import { CalendarBody } from './calendar-body';
import { CalendarPanel } from './calendar-panel';
import { CalendarToolbar } from './calendar-toolbar';
import { DeleteBookingDialog } from './delete-booking-dialog';

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
  const visible = visibleRange(view, date);
  const range = useBookingsRange(visible.from, visible.to);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const panels = useCalendarPanels({ now, date, range: visible, bookings: range.data ?? [], compact, navigate });
  const resetDemo = useResetDemo(panels.close);
  const shift = (direction: 1 | -1) => navigate({ date: shiftAnchor(view, date, direction) });
  const swipe = useSwipe(shift, compact);

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <main className="flex min-h-dvh flex-1 flex-col p-2 pb-24 sm:p-5">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-card p-3 sm:p-5">
          <CalendarToolbar
            view={view}
            date={date}
            compact={compact}
            isCurrentPeriod={now.date >= visible.from && now.date <= visible.to}
            refreshing={range.isFetching && !range.isPending}
            onToday={() => navigate({ date: now.date })}
            onShift={shift}
            onViewChange={(next) => navigate({ view: next })}
            onCreate={panels.createFromToolbar}
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

          <div className="flex min-h-0 flex-1 flex-col" {...swipe}>
            <CalendarBody
              view={view}
              date={date}
              now={now}
              compact={compact}
              bookings={range.data}
              loading={range.isPending}
              error={range.error}
              onRetry={() => range.refetch()}
              panels={panels}
              navigate={navigate}
            />
          </div>
        </div>
      </main>

      {compact && (
        <Button
          size="icon-lg"
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-sticky size-14 rounded-2xl shadow-floating"
          aria-label="Новая бронь"
          onClick={panels.createFromToolbar}
        >
          <IconPlus className="size-6" aria-hidden />
        </Button>
      )}

      <CalendarPanel panels={panels} now={now} compact={compact} onDelete={setDeleting} />
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
