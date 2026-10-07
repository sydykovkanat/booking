import type { Booking } from '@/domain/booking';
import type { BookingField } from '@/domain/rules';
import { ApiError } from '@/lib/api/api-error';

import { apiErrorMessage, violationMessage } from '../lib/messages';

export type FormAlertState =
  | { kind: 'conflict'; conflicts: Booking[] }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/** What the form should do with a failed save. */
export type ServerFeedback =
  | { kind: 'saved'; booking: Booking }
  | { kind: 'conflict'; conflicts: Booking[] }
  | { kind: 'alert'; alert: FormAlertState }
  | { kind: 'fields'; errors: Partial<Record<BookingField, string>>; focus: BookingField };

const FIELD_ORDER: BookingField[] = ['date', 'start', 'end', 'title'];

export const sameSlot = (a: Omit<Booking, 'id'>, b: Omit<Booking, 'id'>) =>
  a.date === b.date && a.start === b.start && a.end === b.end && (a.title ?? '') === (b.title ?? '');

interface Context {
  mode: 'create' | 'edit';
  attempted: Omit<Booking, 'id'>;
  /** The previous attempt failed with a timeout or network error (it may have been committed). */
  afterTransientFailure: boolean;
}

/** Maps a save error to form feedback. Pure, so every branch is unit-testable. */
export function classifyServerError(error: unknown, { mode, attempted, afterTransientFailure }: Context): ServerFeedback {
  if (!(error instanceof ApiError)) return { kind: 'alert', alert: { kind: 'error', message: apiErrorMessage(error) } };

  if (error.isConflict && error.conflicts.length > 0) {
    // A retry after a timeout can collide with our own, already saved, booking.
    const ours = afterTransientFailure && mode === 'create' ? error.conflicts.find((b) => sameSlot(b, attempted)) : undefined;
    return ours ? { kind: 'saved', booking: ours } : { kind: 'conflict', conflicts: error.conflicts };
  }
  if (error.isNotFound && mode === 'edit') return { kind: 'alert', alert: { kind: 'not-found' } };

  const fields = FIELD_ORDER.filter((f) => error.fields[f]);
  if (error.isValidation && fields.length > 0) {
    const errors = Object.fromEntries(fields.map((f) => [f, violationMessage(error.fields[f]!, error.conflicts)]));
    return { kind: 'fields', errors, focus: fields[0] };
  }
  return { kind: 'alert', alert: { kind: 'error', message: apiErrorMessage(error) } };
}
