'use client';

import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { ru } from 'react-day-picker/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { IsoDate, RoomNow } from '@/domain/booking';
import { addDaysToIsoDate } from '@/domain/time';

import { formatDayTitle, isoDateToLocalDate, localDateToIsoDate } from '../lib/format';

interface DayNavigatorProps {
  date: IsoDate;
  now: RoomNow;
  onChange: (date: IsoDate) => void;
}

export function DayNavigator({ date, now, onChange }: DayNavigatorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isToday = date === now.date;

  return (
    <nav aria-label="Выбор даты" className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Предыдущий день" onClick={() => onChange(addDaysToIsoDate(date, -1))}>
        <IconChevronLeft aria-hidden />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="min-w-0 flex-1 justify-center gap-2.5 px-3 sm:flex-none sm:min-w-64 sm:justify-start sm:px-4" />
          }
        >
          <IconCalendar className="text-muted-foreground max-[400px]:hidden" aria-hidden />
          <span className="truncate font-semibold sm:hidden">{formatDayTitle(date, now, { short: true })}</span>
          <span className="truncate font-semibold max-sm:hidden">{formatDayTitle(date, now)}</span>
          <span className="sr-only">, открыть календарь</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={ru}
            weekStartsOn={1}
            selected={isoDateToLocalDate(date)}
            defaultMonth={isoDateToLocalDate(date)}
            today={isoDateToLocalDate(now.date)}
            onSelect={(day) => {
              if (!day) return;
              onChange(localDateToIsoDate(day));
              setCalendarOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="icon" aria-label="Следующий день" onClick={() => onChange(addDaysToIsoDate(date, 1))}>
        <IconChevronRight aria-hidden />
      </Button>

      {!isToday && (
        <Button variant="ghost" className="px-3 text-primary-strong" onClick={() => onChange(now.date)}>
          Сегодня
        </Button>
      )}
    </nav>
  );
}
