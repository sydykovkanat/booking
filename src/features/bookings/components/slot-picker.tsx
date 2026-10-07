'use client';

import { IconArrowRight } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SlotRow, TimeOption } from '@/domain/schedule';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

import { formatDuration, formatRange } from '../lib/format';

interface SlotPickerProps {
  rows: readonly SlotRow[];
  ends: readonly TimeOption[];
  start: string;
  end: string;
  loading: boolean;
  /** Start can't be changed (an ongoing booking): only the duration is editable. */
  lockedStart?: boolean;
  onStartChange: (start: string) => void;
  onEndChange: (end: string) => void;
  onNext: () => void;
}

/**
 * Calendly-style start list: pick a start, it expands into duration chips and "Next".
 * Existing bookings appear as one row each, so the day stays readable at a glance.
 */
export function SlotPicker({
  rows,
  ends,
  start,
  end,
  loading,
  lockedStart,
  onStartChange,
  onEndChange,
  onNext,
}: SlotPickerProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the expanded slot (with its "Next" button) fully visible in the scroll area.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [start]);

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Загружаем свободное время" className="flex flex-col gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // An ongoing booking keeps its (already past) start: show just that one, expanded.
  const shown: readonly SlotRow[] = lockedStart && start ? [{ kind: 'start', value: start }] : rows;
  if (!shown.some((r) => r.kind === 'start')) {
    return <p className="rounded-xl bg-muted/60 p-4 text-ui-sm text-muted-foreground">На этот день свободного времени не осталось.</p>;
  }

  return (
    <ul ref={listRef} aria-label="Время начала" className="flex flex-col gap-2">
      {shown.map((row) => {
        if (row.kind === 'busy') {
          return (
            <li
              key={`busy-${row.booking.id}`}
              className="flex h-11 items-center gap-3 rounded-lg bg-muted/50 px-4 text-ui-sm text-muted-foreground"
            >
              <span className="font-medium tabular-nums">{formatRange(row.booking)}</span>
              <span className="min-w-0 flex-1 truncate">{row.booking.title ?? 'Без названия'}</span>
              <span className="shrink-0">занято</span>
            </li>
          );
        }

        if (row.value === start) {
          return (
            <li key={row.value} data-selected className="flex flex-col gap-3 rounded-xl bg-primary/12 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ui font-semibold tabular-nums">{row.value}</span>
                {!lockedStart && (
                  <Button variant="ghost" size="xs" onClick={() => onStartChange('')}>
                    Другое время
                  </Button>
                )}
              </div>
              <DurationChips start={start} end={end} ends={ends} onChange={onEndChange} />
              <Button onClick={onNext} disabled={!end}>
                Далее <IconArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </li>
          );
        }

        return (
          <li key={row.value}>
            <button
              type="button"
              onClick={() => onStartChange(row.value)}
              className="focus-ring flex h-11 w-full items-center rounded-lg bg-secondary px-4 text-ui font-medium tabular-nums transition-colors duration-fast hover:bg-primary/15 hover:text-primary-strong"
            >
              {row.value}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface DurationChipsProps {
  start: string;
  end: string;
  ends: readonly TimeOption[];
  onChange: (end: string) => void;
}

function DurationChips({ start, end, ends, onChange }: DurationChipsProps) {
  const from = toMinutes(start);
  return (
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
            title={disabled ? `До ${option.value} — ${option.status === 'busy' ? 'занято' : 'уже прошло'}` : `До ${option.value}`}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring h-8 rounded-full px-3 text-ui-sm font-medium tabular-nums transition-colors duration-fast',
              checked
                ? 'bg-foreground text-background'
                : disabled
                  ? 'cursor-not-allowed bg-card/60 text-muted-foreground/50 line-through'
                  : 'bg-card text-foreground hover:bg-background',
            )}
          >
            {formatDuration(toMinutes(option.value) - from)}
          </button>
        );
      })}
    </div>
  );
}
