'use client';

import { IconCalendar } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru as ruDateFns } from 'date-fns/locale';
import { useState } from 'react';
import { ru } from 'react-day-picker/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { IsoDate } from '@/domain/booking';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate, localDateToIsoDate } from '../lib/format';

interface DatePickerProps {
  id: string;
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  /** Earliest selectable date. */
  min?: IsoDate;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function DatePicker({ id, value, onChange, min, disabled, invalid, describedBy }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoDateToLocalDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="secondary"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn('w-full justify-start px-3 font-normal', !selected && 'text-muted-foreground')}
          />
        }
      >
        <IconCalendar className="text-muted-foreground" aria-hidden />
        {selected ? format(selected, 'd MMMM yyyy, EEEEEE', { locale: ruDateFns }) : 'Выберите дату'}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ru}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          disabled={min ? { before: isoDateToLocalDate(min) } : undefined}
          onSelect={(day) => {
            if (!day) return;
            onChange(localDateToIsoDate(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
