'use client';

import { IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru as ruDateFns } from 'date-fns/locale';
import { type ReactNode, useState } from 'react';
import { ru } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IsoDate } from '@/domain/booking';
import { cn } from '@/lib/utils';

import { isoDateToLocalDate, localDateToIsoDate } from '../lib/format';

/** Rows as separate tonal tiles: no hairlines, an invalid group turns its tiles red-tinted. */
export function RowGroup({ invalid, children }: { invalid?: boolean; children: ReactNode }) {
  return (
    <div data-invalid={invalid || undefined} className="group/rows flex flex-col gap-1">
      {children}
    </div>
  );
}

const rowClass =
  'focus-ring flex h-12 w-full items-center gap-3 rounded-lg bg-muted/70 px-4 text-left text-ui transition-colors duration-fast hover:bg-muted group-data-invalid/rows:bg-destructive/10 disabled:pointer-events-none disabled:opacity-60';

interface DateRowProps {
  value: IsoDate;
  min?: IsoDate;
  disabled?: boolean;
  onChange: (date: IsoDate) => void;
}

export function DateRow({ value, min, disabled, onChange }: DateRowProps) {
  const [open, setOpen] = useState(false);
  const local = isoDateToLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={rowClass} aria-label={`Дата: ${format(local, 'd MMMM', { locale: ruDateFns })}`}>
        <span className="text-muted-foreground">Дата</span>
        <span className="ml-auto font-medium first-letter:uppercase">{format(local, 'EEEEEE, d MMMM', { locale: ruDateFns })}</span>
        {!disabled && <IconChevronRight className="size-4 text-muted-foreground" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
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

export interface RowOption {
  value: string;
  label: ReactNode;
}

interface SelectRowProps {
  id: string;
  label: string;
  value: string;
  options: readonly RowOption[];
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

/** A row whose value opens a list. Only valid choices are listed. */
export function SelectRow({ id, label, value, options, placeholder = '—', disabled, describedBy, onChange }: SelectRowProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select value={value || null} onValueChange={(next) => next && onChange(next)} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        className={cn(rowClass, 'data-[size=default]:h-12 [&>svg:last-child]:hidden')}
      >
        <span className="text-muted-foreground">{label}</span>
        <SelectValue className="ml-auto flex-none text-right font-medium tabular-nums" placeholder={placeholder}>
          {selected?.label}
        </SelectValue>
        {!disabled && <IconChevronRight className="size-4 text-muted-foreground" aria-hidden />}
      </SelectTrigger>
      <SelectContent align="end" className="max-h-72 min-w-44">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="tabular-nums">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
