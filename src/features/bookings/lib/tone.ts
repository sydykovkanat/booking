/**
 * Pastel event colours, picked deterministically per booking so a booking keeps its colour.
 * No reds: red is the brand accent and the colour of errors and conflicts.
 */
const TONES = [
  { chip: 'bg-sky-100 text-sky-950 hover:bg-sky-200', bar: 'bg-sky-500' },
  { chip: 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200', bar: 'bg-emerald-500' },
  { chip: 'bg-violet-100 text-violet-950 hover:bg-violet-200', bar: 'bg-violet-500' },
  { chip: 'bg-amber-100 text-amber-950 hover:bg-amber-200', bar: 'bg-amber-500' },
  { chip: 'bg-indigo-100 text-indigo-950 hover:bg-indigo-200', bar: 'bg-indigo-500' },
  { chip: 'bg-teal-100 text-teal-950 hover:bg-teal-200', bar: 'bg-teal-500' },
] as const;

export type Tone = (typeof TONES)[number];

/** Past bookings are greyed out regardless of their tone. */
export const PAST_TONE = { chip: 'bg-muted text-muted-foreground hover:bg-secondary', bar: 'bg-foreground/20' } as const;

export function toneFor(id: string): Tone {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
