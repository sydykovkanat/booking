'use client';

import { type MouseEvent, type PointerEvent, type RefObject, useRef, useState } from 'react';

import type { IsoDate, TimeRange, TimeString } from '@/domain/booking';
import type { DayContext } from '@/domain/schedule';
import { rangeAtMinute, rangeFromDrag } from '@/domain/selection';
import { toMinutes } from '@/domain/time';

import { DAY_START, type SelectVia, SPAN, STEP } from './geometry';

interface Options {
  day: IsoDate;
  /** The column element: pointer positions are measured against it. */
  columnRef: RefObject<HTMLDivElement | null>;
  ctx: DayContext;
  /** Suppresses the hover hint in a column that already shows the draft. */
  hasDraft: boolean;
  onSelectRange: (day: IsoDate, range: TimeRange, via: SelectVia) => void;
}

/**
 * Turns pointer input on a day column into a time range. Mouse: drag (or click) to select.
 * Touch: tap. Keyboard: Enter on a free window selects from its start.
 */
export function usePointerSelection({ day, columnRef, ctx, hasDraft, onSelectRange }: Options) {
  const lastPointer = useRef<string>('mouse');
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const minuteAt = (clientY: number) => {
    const rect = columnRef.current?.getBoundingClientRect();
    return rect ? DAY_START + ((clientY - rect.top) / rect.height) * SPAN : DAY_START;
  };

  /** OS gestures, a context menu or a lost window focus end the drag without selecting. */
  const cancelDrag = () => setDrag(null);
  const clearHover = () => setHover(null);

  /** Spread on each free-window button; the button must carry `data-start` (the window start). */
  const freeWindowHandlers = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      lastPointer.current = event.pointerType;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const minute = minuteAt(event.clientY);
      setDrag({ anchor: minute, current: minute });
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'mouse') return;
      const minute = minuteAt(event.clientY);
      if (drag) setDrag({ ...drag, current: minute });
      // Snapped, so moving within the same quarter hour does not re-render the column.
      else setHover(Math.floor(minute / STEP) * STEP);
    },
    onPointerUp: () => {
      if (!drag) return;
      const range = rangeFromDrag(ctx, drag.anchor, drag.current);
      setDrag(null);
      if (range) onSelectRange(day, range, 'pointer');
    },
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
    onPointerLeave: clearHover,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      // Mouse selections are handled on pointer up; this is touch and keyboard.
      const windowStart = event.currentTarget.dataset.start as TimeString;
      const range =
        event.detail === 0
          ? rangeAtMinute(ctx, toMinutes(windowStart))
          : lastPointer.current !== 'mouse'
            ? rangeAtMinute(ctx, minuteAt(event.clientY))
            : null;
      if (range) onSelectRange(day, range, event.detail === 0 ? 'keyboard' : 'touch');
    },
  };

  return {
    freeWindowHandlers,
    clearHover,
    dragRange: drag ? rangeFromDrag(ctx, drag.anchor, drag.current) : null,
    hoverRange: !drag && hover !== null && !hasDraft ? rangeAtMinute(ctx, hover) : null,
  };
}
