/** Pastel event colours, picked deterministically per booking so a booking keeps its colour. */
const TONES = [
  { chip: 'bg-sky-100 text-sky-950 hover:bg-sky-200', bar: 'bg-sky-500' },
  { chip: 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200', bar: 'bg-emerald-500' },
  { chip: 'bg-violet-100 text-violet-950 hover:bg-violet-200', bar: 'bg-violet-500' },
  { chip: 'bg-amber-100 text-amber-950 hover:bg-amber-200', bar: 'bg-amber-500' },
  { chip: 'bg-rose-100 text-rose-950 hover:bg-rose-200', bar: 'bg-rose-500' },
  { chip: 'bg-lime-100 text-lime-950 hover:bg-lime-200', bar: 'bg-lime-600' },
] as const;

export type Tone = (typeof TONES)[number];

/** Past bookings are greyed out regardless of their tone. */
export const PAST_TONE = { chip: 'bg-muted text-muted-foreground hover:bg-secondary', bar: 'bg-foreground/20' } as const;

export function toneFor(id: string): Tone {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
