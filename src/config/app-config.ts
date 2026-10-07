import { z } from 'zod';

/**
 * Public runtime configuration. `NEXT_PUBLIC_*` values are inlined at build time,
 * so the client and the server always agree on the room's time zone.
 */
const schema = z.object({
  roomTimeZone: z.string().min(1).refine(isKnownTimeZone, 'Unknown IANA time zone'),
  demoTools: z.boolean(),
});

function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const appConfig = schema.parse({
  roomTimeZone: process.env.NEXT_PUBLIC_ROOM_TIME_ZONE || 'Asia/Bishkek',
  demoTools: process.env.NEXT_PUBLIC_DEMO_TOOLS === 'true',
});
