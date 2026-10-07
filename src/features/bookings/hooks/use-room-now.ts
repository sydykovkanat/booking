'use client';

import { useSyncExternalStore } from 'react';

import { appConfig } from '@/config/app-config';
import type { RoomNow } from '@/domain/booking';
import { getRoomNow } from '@/domain/time';

const TICK_MS = 15_000;

let cached: RoomNow | null = null;

function snapshot(): RoomNow {
  const next = getRoomNow(new Date(), appConfig.roomTimeZone);
  // Keep the same reference within a minute so subscribers do not re-render needlessly.
  if (!cached || cached.date !== next.date || cached.minutes !== next.minutes) cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/**
 * Current time in the room's time zone, refreshed every few seconds.
 * Returns `null` during SSR: "now" only makes sense on the client.
 */
export function useRoomNow(): RoomNow | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
