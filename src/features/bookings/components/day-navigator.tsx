'use client';

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
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
        <ChevronLeftIcon />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="min-w-0 flex-1 justify-start gap-2.5 px-4 sm:flex-none sm:min-w-64" />
          }
        >
          <CalendarDaysIcon className="text-muted-foreground" aria-hidden />
          <span className="truncate font-semibold">{formatDayTitle(date, now)}</span>
          <span className="sr-only">, открыть календарь</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
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
        <ChevronRightIcon />
      </Button>

      {!isToday && (
        <Button variant="ghost" className="text-primary" onClick={() => onChange(now.date)}>
          Сегодня
        </Button>
      )}
    </nav>
  );
}
