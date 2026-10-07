'use client';

import { type BaseSyntheticEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import type { Booking, TimeRange } from '@/domain/booking';
import { findConflicts } from '@/domain/overlap';
import { type BookingField, getBookingPhase, normalizeInput, type ValidationContext } from '@/domain/rules';
import { type DayContext, endOptions, findNearestFreeSlot } from '@/domain/schedule';
import { isValidIsoDate, isValidTime, toMinutes } from '@/domain/time';
import { ApiError } from '@/lib/api/api-error';

import { useCreateBooking, useUpdateBooking } from '../api/mutations';
import { useBookings } from '../api/queries';
import { bookingKeys } from '../api/query-keys';
import { useRoomNow } from '../hooks/use-room-now';
import { apiErrorMessage, violationMessage } from '../lib/messages';
import { bookingFormResolver, type BookingFormValues } from './booking-form-schema';
import { durationOf } from './duration';

export type FormAlertState =
  | { kind: 'conflict'; conflicts: Booking[] }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

export interface BookingPreview extends TimeRange {
  date: string;
  conflict: boolean;
  conflictIds: string[];
}

export interface BookingFormControllerOptions {
  mode: 'create' | 'edit';
  initialValues: BookingFormValues;
  original?: Booking;
  onSuccess: (booking: Booking) => void;
  onPreviewChange?: (preview: BookingPreview | null) => void;
}

const FIELD_ORDER: BookingField[] = ['date', 'start', 'end', 'title'];

const sameSlot = (a: Booking, b: Omit<Booking, 'id'>) =>
  a.date === b.date && a.start === b.start && a.end === b.end && (a.title ?? '') === (b.title ?? '');

/**
 * All behaviour of the booking form: validation context, server error handling and
 * derived schedule data. The component only renders what this returns.
 */
export function useBookingFormController({
  mode,
  initialValues,
  original: originalSnapshot,
  onSuccess,
  onPreviewChange,
}: BookingFormControllerOptions) {
  const now = useRoomNow();
  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();
  const [alert, setAlert] = useState<FormAlertState | null>(null);
  // Kept apart from RHF errors: re-validation after a refetch must not wipe what the server said.
  const [serverErrors, setServerErrors] = useState<Partial<Record<BookingField, string>>>({});
  // Bookings from a 409 body, trusted only until the next successful refetch of that day.
  const [serverConflicts, setServerConflicts] = useState<{ at: number; items: Booking[] } | null>(null);
  // A create that timed out may still have been committed; see handleServerError.
  const lastAttemptWasTransient = useRef(false);
  // Remembered across "pick another time", so the chosen duration survives a start change.
  const preferredDuration = useRef<number | null>(durationOf(initialValues));

  // The original may have been changed or deleted by someone else since the editor opened.
  const originalDay = useBookings(originalSnapshot?.date ?? null);
  const freshOriginal = originalSnapshot && originalDay.data?.find((b) => b.id === originalSnapshot.id);
  const original = freshOriginal ?? originalSnapshot;
  const originalGone = Boolean(originalSnapshot && originalDay.isSuccess && !freshOriginal);

  // The date lives in the form, but the form needs the day's bookings for its context:
  // track it in state and adjust during render when the field changes.
  const [contextDate, setContextDate] = useState(initialValues.date);
  const queryClient = useQueryClient();
  const day = useBookings(isValidIsoDate(contextDate) ? contextDate : null);
  // How many times this day's list has been (re)loaded; used to expire 409 payloads.
  const dayUpdateCount = () => queryClient.getQueryState(bookingKeys.byDate(contextDate))?.dataUpdateCount ?? 0;
  const currentUpdateCount = dayUpdateCount();
  const existing = useMemo(() => {
    const cached = day.data ?? [];
    if (!serverConflicts || serverConflicts.at !== currentUpdateCount) return cached;
    return [...new Map([...cached, ...serverConflicts.items].map((b) => [b.id, b])).values()];
  }, [day.data, currentUpdateCount, serverConflicts]);

  const validationContext = useMemo<ValidationContext | null>(
    () => (now ? { now, existing, original } : null),
    [now, existing, original],
  );

  const form = useForm<BookingFormValues, ValidationContext | null>({
    defaultValues: initialValues,
    resolver: bookingFormResolver,
    context: validationContext,
    mode: 'onTouched',
  });
  const { formState, trigger, setValue, getValues, setFocus, control } = form;
  const [date, start, end] = useWatch({ control, name: ['date', 'start', 'end'] });

  const formDate = isValidIsoDate(date) ? date : null;
  if (formDate && formDate !== contextDate) setContextDate(formDate);

  // New bookings or a new minute: re-check the chosen time once the user has tried to submit.
  useEffect(() => {
    if (formState.isSubmitted) void trigger(['start', 'end']);
  }, [validationContext, formState.isSubmitted, trigger]);

  const phase = original && now ? getBookingPhase(original, now) : 'upcoming';
  const dayCtx: DayContext | null =
    now && formDate ? { date: formDate, bookings: existing, now, excludeId: original?.id } : null;

  const validRange = Boolean(formDate && isValidTime(start) && isValidTime(end) && toMinutes(start) < toMinutes(end));
  const preview = useMemo<BookingPreview | null>(() => {
    if (!validRange || !formDate) return null;
    const conflicts = findConflicts({ date: formDate, start, end }, existing, original?.id);
    return { date: formDate, start, end, conflict: conflicts.length > 0, conflictIds: conflicts.map((b) => b.id) };
  }, [validRange, formDate, start, end, existing, original?.id]);

  // An Effect Event: consumers may pass an inline callback without causing a render loop.
  const reportPreview = useEffectEvent((next: BookingPreview | null) => onPreviewChange?.(next));
  useEffect(() => reportPreview(preview), [preview]);
  useEffect(() => () => reportPreview(null), []);

  const handleServerError = (error: unknown, attempted: Omit<Booking, 'id'>, sentAtUpdate: number) => {
    const wasTransient = lastAttemptWasTransient.current;
    lastAttemptWasTransient.current = error instanceof ApiError && error.isTransient;

    if (!(error instanceof ApiError)) {
      setAlert({ kind: 'error', message: apiErrorMessage(error) });
      return;
    }
    if (error.isConflict) {
      // A retry after a timeout can collide with our own, already saved, booking.
      const ours = wasTransient && mode === 'create' ? error.conflicts.find((b) => sameSlot(b, attempted)) : undefined;
      if (ours) {
        onSuccess(ours);
        return;
      }
      // Trusted only if the post-mutation refetch has not landed (e.g. it failed).
      setServerConflicts({ at: sentAtUpdate, items: error.conflicts });
      setAlert({ kind: 'conflict', conflicts: error.conflicts });
      setFocus('start');
      return;
    }
    if (error.isNotFound && mode === 'edit') {
      setAlert({ kind: 'not-found' });
      return;
    }
    const fields = FIELD_ORDER.filter((f) => error.fields[f]);
    if (error.isValidation && fields.length > 0) {
      setServerErrors(Object.fromEntries(fields.map((f) => [f, violationMessage(error.fields[f]!, error.conflicts)])));
      setFocus(fields[0]);
      return;
    }
    setAlert({ kind: 'error', message: apiErrorMessage(error) });
  };

  const onValid = async (values: BookingFormValues) => {
    setAlert(null);
    setServerErrors({});
    const input = normalizeInput(values);
    const sentAtUpdate = dayUpdateCount();
    try {
      const saved =
        mode === 'edit' && original
          ? await updateMutation.mutateAsync({ original, patch: { ...input, title: input.title ?? '' } })
          : await createMutation.mutateAsync(input);
      lastAttemptWasTransient.current = false;
      onSuccess(saved);
    } catch (error: unknown) {
      handleServerError(error, input, sentAtUpdate);
    }
  };
  // handleSubmit is created per event so the callback (which touches a ref) never runs during render.
  const submit = (event?: BaseSyntheticEvent) =>
    form.handleSubmit(onValid)(event);

  /** The user changed the schedule fields: stale server feedback about them no longer applies. */
  const onScheduleEdited = () => {
    setAlert((a) => (a?.kind === 'conflict' ? null : a));
    setServerErrors(({ title }) => (title ? { title } : {}));
  };

  const shouldRevalidate = formState.isSubmitted;

  return {
    form,
    now,
    alert: originalGone && !alert ? ({ kind: 'not-found' } as const) : alert,
    lockedStart: phase === 'ongoing',
    preview,
    dayLoading: formDate !== null && day.isPending,
    dayContext: dayCtx,
    endOptions: dayCtx && isValidTime(start) ? endOptions(start, dayCtx) : [],
    suggestion: alert?.kind === 'conflict' && dayCtx && validRange ? findNearestFreeSlot({ start, end }, dayCtx) : null,
    fieldError: (field: BookingField) => formState.errors[field]?.message ?? serverErrors[field],
    submit,
    isSubmitting: formState.isSubmitting,
    getValues,

    setDate(value: string) {
      setValue('date', value, { shouldDirty: true, shouldValidate: shouldRevalidate });
      onScheduleEdited();
    },
    /** Sets both ends at once (drag selection, stepper, suggestion). */
    setRange(range: TimeRange) {
      preferredDuration.current = durationOf(range) ?? preferredDuration.current;
      setValue('start', range.start, { shouldDirty: true, shouldValidate: shouldRevalidate });
      setValue('end', range.end, { shouldDirty: true, shouldValidate: shouldRevalidate });
      if (shouldRevalidate) void trigger(['start', 'end']);
      onScheduleEdited();
    },
    clearTitleError() {
      setServerErrors(({ title: _, ...rest }) => rest);
    },
    applySuggestion(slot: TimeRange) {
      setValue('start', slot.start, { shouldDirty: true });
      setValue('end', slot.end, { shouldDirty: true });
      void trigger(['start', 'end']);
      setAlert(null);
    },
  };
}
