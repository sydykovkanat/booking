import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { toMinutes } from '@/domain/time';
import { cn } from '@/lib/utils';

const START = toMinutes(BOOKING_RULES.workStart);
const END = toMinutes(BOOKING_RULES.workEnd);
const HOURS = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START / 60 + i);

const percent = (minutes: number) => `${((Math.min(Math.max(minutes, START), END) - START) / (END - START)) * 100}%`;

function segmentStyle({ start, end }: TimeRange) {
  return { left: percent(toMinutes(start)), width: `calc(${percent(toMinutes(end))} - ${percent(toMinutes(start))})` };
}

interface OccupancyBarProps {
  date: IsoDate;
  now: RoomNow;
  bookings: readonly Booking[];
  selection?: TimeRange & { conflict: boolean };
}

/**
 * Visual overview of the day. Purely decorative (`aria-hidden`): every piece of information
 * is also present in the agenda list for assistive technology.
 */
export function OccupancyBar({ date, now, bookings, selection }: OccupancyBarProps) {
  const pastUntil = date < now.date ? END : date === now.date ? now.minutes : START;

  return (
    <div aria-hidden className="select-none">
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        {pastUntil > START && (
          <div
            className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_oklch,var(--foreground)_7%,transparent)_4px_6px)]"
            style={{ width: percent(pastUntil) }}
          />
        )}
        {bookings.map((b) => (
          <div key={b.id} className="absolute inset-y-0 rounded-full bg-primary/75" style={segmentStyle(b)} />
        ))}
        {selection && (
          <div
            className={cn(
              'absolute inset-y-0 rounded-full transition-all duration-200',
              selection.conflict
                ? 'bg-destructive [background-image:repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.35)_3px_5px)]'
                : 'bg-success',
            )}
            style={segmentStyle(selection)}
          />
        )}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground tabular-nums">
        {HOURS.map((h, i) => (
          <span
            key={h}
            className={cn(
              'absolute -translate-x-1/2',
              i === 0 && 'translate-x-0',
              i === HOURS.length - 1 && '-translate-x-full',
              i % 3 !== 0 && 'max-sm:hidden',
            )}
            style={{ left: percent(h * 60) }}
          >
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  );
}
