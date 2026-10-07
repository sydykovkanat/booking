import { ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import type { TimeOption } from '@/domain/schedule';
import { cn } from '@/lib/utils';

const STATUS_SUFFIX: Record<TimeOption['status'], string> = {
  available: '',
  busy: ' · занято',
  past: ' · прошло',
};

interface TimeSelectProps extends Omit<ComponentProps<'select'>, 'children'> {
  options: readonly TimeOption[];
  placeholder: string;
}

/**
 * Native select on purpose: the OS picker on mobile, full keyboard and screen reader support.
 * Unavailable times stay visible (and disabled) so users understand *why* they cannot pick them.
 */
export function TimeSelect({ options, placeholder, className, value, ...props }: TimeSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        className={cn(
          'h-11 w-full appearance-none rounded-xl bg-muted px-3.5 pr-10 text-base tabular-nums outline-none transition-colors focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:bg-destructive/8 aria-invalid:ring-3 aria-invalid:ring-destructive/25 sm:text-sm',
          !value && 'text-muted-foreground',
          className,
        )}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.status !== 'available' && o.value !== value}>
            {o.value}
            {STATUS_SUFFIX[o.status]}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
