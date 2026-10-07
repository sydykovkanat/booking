'use client';

import { IconCalendarEvent, IconChevronDown } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru as ruDateFns } from 'date-fns/locale';
import { useState } from 'react';
import { ru } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { IsoDate } from '@/domain/booking';

import { isoDateToLocalDate, localDateToIsoDate } from '../lib/format';

interface DateFieldProps {
  value: IsoDate;
  min?: IsoDate;
  disabled?: boolean;
  onChange: (date: IsoDate) => void;
}

/** The date as a quiet text button; a month calendar opens on click. */
export function DateField({ value, min, disabled, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const local = isoDateToLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`Дата: ${format(local, 'd MMMM', { locale: ruDateFns })}. Изменить`}
        className="focus-ring -mx-2 flex items-center gap-2 self-start rounded-lg px-2 py-1 text-ui text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground disabled:pointer-events-none"
      >
        <IconCalendarEvent className="size-4" aria-hidden />
        <span className="first-letter:uppercase">{format(local, 'EEEE, d MMMM', { locale: ruDateFns })}</span>
        {!disabled && <IconChevronDown className="size-4" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ru}
          weekStartsOn={1}
          required
          selected={local}
          defaultMonth={local}
          disabled={min ? { before: isoDateToLocalDate(min) } : undefined}
          onSelect={(day) => {
            onChange(localDateToIsoDate(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
