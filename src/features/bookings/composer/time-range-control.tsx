'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import type { TimeRange } from '@/domain/booking';
import type { DayContext, TimeOption } from '@/domain/schedule';
import { shiftStart } from '@/domain/selection';
import { isValidTime, toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange } from '../lib/format';

interface TimeRangeControlProps {
  start: string;
  end: string;
  ends: readonly TimeOption[];
  dayContext: DayContext | null;
  lockedStart?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (range: TimeRange) => void;
}

/**
 * Time picker built for both mouse and thumbs: arrows move the start by 15 minutes (jumping over
 * bookings and keeping the duration), chips set the duration. No long dropdowns.
 */
export function TimeRangeControl({
  start,
  end,
  ends,
  dayContext,
  lockedStart,
  invalid,
  describedBy,
  onChange,
}: TimeRangeControlProps) {
  const complete = isValidTime(start) && isValidTime(end);
  const range = { start, end };
  const prev = complete && dayContext && !lockedStart ? shiftStart(dayContext, range, -1) : null;
  const next = complete && dayContext && !lockedStart ? shiftStart(dayContext, range, 1) : null;
  const from = isValidTime(start) ? toMinutes(start) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'flex items-center gap-1 rounded-xl bg-muted/70 p-1 transition-shadow duration-fast',
          invalid && 'ring-2 ring-destructive/40',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Начать на 15 минут раньше"
          disabled={!prev}
          onClick={() => prev && onChange(prev)}
        >
          <IconChevronLeft aria-hidden />
        </Button>
        <p
          aria-live="polite"
          aria-describedby={describedBy}
          className="flex-1 text-center text-lg font-semibold tracking-tight tabular-nums"
        >
          {complete ? formatRange(range) : 'Выберите время'}
          {complete && (
            <span className="ml-2 text-ui-sm font-normal text-muted-foreground">
              {formatDuration(toMinutes(end) - toMinutes(start))}
            </span>
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Начать на 15 минут позже"
          disabled={!next}
          onClick={() => next && onChange(next)}
        >
          <IconChevronRight aria-hidden />
        </Button>
      </div>

      {ends.length > 0 && (
        <div role="radiogroup" aria-label="Длительность" className="flex flex-wrap gap-1.5">
          {ends.map((option) => {
            const checked = option.value === end;
            const disabled = option.status !== 'available';
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange({ start, end: option.value })}
                className={cn(
                  'focus-ring h-8 rounded-full px-3 text-ui-sm font-medium tabular-nums transition-colors duration-fast',
                  checked
                    ? 'bg-foreground text-background'
                    : disabled
                      ? 'cursor-not-allowed text-muted-foreground/40'
                      : 'bg-muted/70 text-foreground hover:bg-secondary',
                )}
              >
                {formatDuration(toMinutes(option.value) - from)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
