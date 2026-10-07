'use client';

import type { Ref } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TimeOption } from '@/domain/schedule';

const STATUS_HINT: Record<TimeOption['status'], string | null> = {
  available: null,
  busy: 'занято',
  past: 'прошло',
};

interface TimeSelectProps {
  id: string;
  value: string;
  options: readonly TimeOption[];
  placeholder: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Unavailable times stay in the list (disabled, with a reason) so users see *why*
 * they cannot pick them instead of wondering where they went.
 */
export function TimeSelect({
  id,
  value,
  options,
  placeholder,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
  ref,
}: TimeSelectProps) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => next && onChange(next)}
      onOpenChange={(open) => !open && onBlur?.()}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        ref={ref}
        className="w-full tabular-nums"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => {
          const hint = STATUS_HINT[option.status];
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.status !== 'available'}
              className="tabular-nums"
            >
              {option.value}
              {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
