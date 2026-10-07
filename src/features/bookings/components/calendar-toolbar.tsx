'use client';

import { IconChevronLeft, IconChevronRight, IconPlus, IconRestore } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { appConfig } from '@/config/app-config';
import type { IsoDate } from '@/domain/booking';
import { type CalendarView, weekDays } from '@/domain/calendar';

import { isoDateToLocalDate } from '../lib/format';

const VIEW_LABELS: Record<CalendarView, string> = { month: 'Месяц', week: 'Неделя', day: 'День' };

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function periodTitle(view: CalendarView, date: IsoDate): string {
  const local = isoDateToLocalDate(date);
  if (view === 'month') return capitalize(format(local, 'LLLL yyyy', { locale: ru }));
  if (view === 'day') return capitalize(format(local, 'EEEE, d MMMM', { locale: ru }));

  const days = weekDays(date);
  const [first, last] = [isoDateToLocalDate(days[0]), isoDateToLocalDate(days[6])];
  return first.getMonth() === last.getMonth()
    ? `${format(first, 'd')}–${format(last, 'd MMMM yyyy', { locale: ru })}`
    : `${format(first, 'd MMM', { locale: ru })} – ${format(last, 'd MMM yyyy', { locale: ru })}`;
}

interface CalendarToolbarProps {
  view: CalendarView;
  date: IsoDate;
  isCurrentPeriod: boolean;
  refreshing: boolean;
  onToday: () => void;
  onShift: (direction: 1 | -1) => void;
  onViewChange: (view: CalendarView) => void;
  onCreate: () => void;
  onResetDemo: () => void;
}

export function CalendarToolbar({
  view,
  date,
  isCurrentPeriod,
  refreshing,
  onToday,
  onShift,
  onViewChange,
  onCreate,
  onResetDemo,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onToday} disabled={isCurrentPeriod}>
        Сегодня
      </Button>
      <div className="flex">
        <Button variant="ghost" size="icon-sm" aria-label="Назад" onClick={() => onShift(-1)}>
          <IconChevronLeft aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Вперёд" onClick={() => onShift(1)}>
          <IconChevronRight aria-hidden />
        </Button>
      </div>
      <h1 aria-live="polite" className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
        <span className="truncate">{periodTitle(view, date)}</span>
        {refreshing && <Spinner className="size-4 text-muted-foreground" label="Обновляем" />}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        {appConfig.demoTools && (
          <Button variant="ghost" size="icon-sm" aria-label="Сбросить демо-данные" title="Сбросить демо-данные" onClick={onResetDemo}>
            <IconRestore aria-hidden />
          </Button>
        )}
        <Select value={view} onValueChange={(next) => next && onViewChange(next as CalendarView)}>
          <SelectTrigger size="sm" aria-label="Вид календаря" className="min-w-28">
            <SelectValue>{VIEW_LABELS[view]}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
              <SelectItem key={v} value={v}>
                {VIEW_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onCreate} className="max-sm:hidden">
          <IconPlus data-icon="inline-start" aria-hidden /> Новая бронь
        </Button>
      </div>
    </div>
  );
}
