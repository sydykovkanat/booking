'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { BOOKING_RULES } from '@/domain/config';
import { cn } from '@/lib/utils';

/** The counter appears only near the limit, so it does not clutter the form. */
const COUNTER_FROM = BOOKING_RULES.titleMaxLength - 20;

interface TitleFieldProps {
  field: UseFormRegisterReturn<'title'>;
  length: number;
  error?: string;
  autoFocus: boolean;
}

export function TitleField({ field, length, error, autoFocus }: TitleFieldProps) {
  const showCounter = length > COUNTER_FROM;
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        aria-label="Название"
        placeholder="Название встречи"
        autoComplete="off"
        autoFocus={autoFocus}
        size="lg"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? 'quick-title-error' : undefined}
        className="rounded-lg bg-muted/70 px-4 text-lg font-semibold placeholder:font-normal focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-transparent"
        {...field}
      />
      {(error || showCounter) && (
        <div className="flex justify-between gap-3 px-1 text-ui-sm">
          <span id="quick-title-error" className="text-destructive">
            {error}
          </span>
          {showCounter && (
            <span className={cn('tabular-nums', error ? 'text-destructive' : 'text-muted-foreground')}>
              {length}/{BOOKING_RULES.titleMaxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
