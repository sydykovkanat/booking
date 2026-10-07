'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import type { IsoDate, RoomNow } from '@/domain/booking';
import { addDaysToIsoDate } from '@/domain/time';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate } from '../lib/format';

/** Monday of the week that contains `date`. */
function weekStart(date: IsoDate): IsoDate {
  const weekday = (isoDateToLocalDate(date).getDay() + 6) % 7;
  return addDaysToIsoDate(date, -weekday);
}

interface WeekStripProps {
  date: IsoDate;
  now: RoomNow;
  onChange: (date: IsoDate) => void;
}

/** Mobile day picker: the selected week as tappable day pills. */
export function WeekStrip({ date, now, onChange }: WeekStripProps) {
  const monday = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(monday, i));

  return (
    <nav aria-label="Выбор дня" className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Предыдущая неделя" onClick={() => onChange(addDaysToIsoDate(date, -7))}>
        <IconChevronLeft aria-hidden />
      </Button>
      <ol className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => {
          const local = isoDateToLocalDate(day);
          const selected = day === date;
          const isToday = day === now.date;
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onChange(day)}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${format(local, 'EEEE, d MMMM', { locale: ru })}${isToday ? ', сегодня' : ''}`}
                className={cn(
                  'focus-ring relative flex w-full flex-col items-center gap-0.5 rounded-xl py-2 transition-colors duration-fast',
                  selected ? 'bg-foreground text-background' : 'hover:bg-muted',
                  !selected && day < now.date && 'text-muted-foreground',
                )}
              >
                <span className="text-caption uppercase opacity-60">{format(local, 'EEEEEE', { locale: ru })}</span>
                <span className="text-ui font-semibold tabular-nums">{format(local, 'd')}</span>
                <span
                  aria-hidden
                  className={cn('size-1 rounded-full', isToday ? (selected ? 'bg-primary' : 'bg-primary-strong') : 'bg-transparent')}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" size="icon-sm" aria-label="Следующая неделя" onClick={() => onChange(addDaysToIsoDate(date, 7))}>
        <IconChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
