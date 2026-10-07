'use client';

import { type TouchEvent, useRef } from 'react';

const MIN_DISTANCE_PX = 60;
/** The horizontal move must clearly dominate, so vertical scrolling never turns the page. */
const HORIZONTAL_RATIO = 1.5;

/** Horizontal single-finger swipe; pinches and vertical scrolls are ignored. */
export function useSwipe(onSwipe: (direction: 1 | -1) => void, enabled = true) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (event: TouchEvent) => {
      start.current =
        event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!enabled || !from || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - from.x;
      const dy = event.changedTouches[0].clientY - from.y;
      if (Math.abs(dx) > MIN_DISTANCE_PX && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO) {
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
  };
}
