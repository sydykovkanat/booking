'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';
import { ru } from 'react-day-picker/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import type { IsoDate, RoomNow } from '@/domain/booking';

import { formatDayTitle, isoDateToLocalDate, localDateToIsoDate } from '../lib/format';
import { WeekStrip } from './week-strip';

interface DayToolbarProps {
  date: IsoDate;
  now: RoomNow;
  bookingsCount: number | null;
  refreshing: boolean;
  onChange: (date: IsoDate) => void;
}

/** Day title (opens a month calendar), a jump to today and the week strip for stepping. */
export function DayToolbar({ date, now, bookingsCount, refreshing, onChange }: DayToolbarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const subtitle =
    bookingsCount === null ? 'Загружаем…' : bookingsCount === 0 ? 'Броней нет' : `Бронирований: ${bookingsCount}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="focus-ring -mx-2 flex max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors duration-fast hover:bg-muted"
                />
              }
            >
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{formatDayTitle(date, now)}</h1>
              <IconChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">, выбрать дату в календаре</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={ru}
                weekStartsOn={1}
                required
                selected={isoDateToLocalDate(date)}
                defaultMonth={isoDateToLocalDate(date)}
                today={isoDateToLocalDate(now.date)}
                onSelect={(day) => {
                  onChange(localDateToIsoDate(day));
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <p aria-live="polite" className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
            {subtitle}
            {refreshing && <Spinner className="size-3.5" label="Обновляем расписание" />}
          </p>
        </div>

        {date !== now.date && (
          <Button variant="secondary" size="sm" onClick={() => onChange(now.date)}>
            Сегодня
          </Button>
        )}
      </div>

      <WeekStrip date={date} now={now} onChange={onChange} />
    </div>
  );
}
