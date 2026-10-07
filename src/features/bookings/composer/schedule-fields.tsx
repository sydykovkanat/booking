'use client';

import type { IsoDate, TimeRange } from '@/domain/booking';
import { type DayContext, endForStart, type TimeOption } from '@/domain/schedule';
import { toMinutes } from '@/domain/time';

import { durationOf } from '../form/duration';
import { formatDuration } from '../lib/format';
import { DateRow, RowGroup, type RowOption, SelectRow } from './form-rows';

const DEFAULT_DURATION_MINUTES = 60;
const ERROR_ID = 'quick-time-error';

interface ScheduleFieldsProps {
  date: IsoDate;
  start: string;
  end: string;
  minDate?: IsoDate;
  starts: readonly TimeOption[];
  ends: readonly TimeOption[];
  dayContext: DayContext | null;
  /** The booking is running: only its end can change. */
  lockedStart: boolean;
  loading: boolean;
  error?: string;
  onDateChange: (date: IsoDate) => void;
  onRangeChange: (range: TimeRange) => void;
}

/** Date / Start / End rows. Lists contain only valid choices; ends show the resulting duration. */
export function ScheduleFields({
  date,
  start,
  end,
  minDate,
  starts,
  ends,
  dayContext,
  lockedStart,
  loading,
  error,
  onDateChange,
  onRangeChange,
}: ScheduleFieldsProps) {
  const startChoices: RowOption[] = starts
    .filter((o) => o.status === 'available' || o.value === start)
    .map((o) => ({ value: o.value, label: o.value }));
  const endChoices: RowOption[] = ends
    .filter((o) => o.status === 'available' || o.value === end)
    .map((o) => ({
      value: o.value,
      label: (
        <>
          {o.value}
          <span className="font-normal text-muted-foreground"> · {formatDuration(toMinutes(o.value) - toMinutes(start))}</span>
        </>
      ),
    }));

  // A new start keeps the current duration when it still fits.
  const changeStart = (next: string) => {
    if (!dayContext) return;
    const duration = durationOf({ start, end }) ?? DEFAULT_DURATION_MINUTES;
    onRangeChange({ start: next, end: endForStart(next, duration, dayContext) });
  };

  return (
    <div className="flex flex-col gap-2">
      <RowGroup invalid={Boolean(error)}>
        <DateRow value={date} min={minDate} disabled={lockedStart} onChange={onDateChange} />
        <SelectRow
          id="quick-start"
          label="Начало"
          value={start}
          options={startChoices}
          disabled={lockedStart || loading}
          describedBy={error ? ERROR_ID : undefined}
          onChange={changeStart}
        />
        <SelectRow
          id="quick-end"
          label="Конец"
          value={end}
          options={endChoices}
          disabled={loading || !start}
          describedBy={error ? ERROR_ID : undefined}
          onChange={(next) => onRangeChange({ start, end: next })}
        />
      </RowGroup>
      {lockedStart && <p className="px-1 text-ui-sm text-muted-foreground">Встреча уже идёт — можно изменить конец и название.</p>}
      {error && (
        <p id={ERROR_ID} className="px-1 text-ui-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
