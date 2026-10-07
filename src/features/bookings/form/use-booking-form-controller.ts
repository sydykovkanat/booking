'use client';

import { type BaseSyntheticEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import type { Booking, TimeRange } from '@/domain/booking';
import { findConflicts } from '@/domain/overlap';
import { type BookingField, getBookingPhase, normalizeInput, type ValidationContext } from '@/domain/rules';
import { type DayContext, endOptions, findNearestFreeSlot, shortenToFit, startOptions } from '@/domain/schedule';
import { isValidIsoDate, isValidTime, toMinutes } from '@/domain/time';
import { ApiError } from '@/lib/api/api-error';

import { useCreateBooking, useUpdateBooking } from '../api/mutations';
import { useRoomNow } from '../hooks/use-room-now';
import { bookingFormResolver, type BookingFormValues } from './booking-form-schema';
import { classifyServerError, type FormAlertState, sameSlot } from './server-feedback';
import { useDaySchedule } from './use-day-schedule';
import { useFreshOriginal } from './use-fresh-original';

export type { FormAlertState } from './server-feedback';

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

/**
 * All behaviour of the booking form: validation context, server feedback and derived schedule
 * data. The component only renders what this returns.
 */
export function useBookingFormController({
  mode,
  initialValues,
  original: snapshot,
  onSuccess,
  onPreviewChange,
}: BookingFormControllerOptions) {
  const now = useRoomNow();
  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();
  const [alert, setAlert] = useState<FormAlertState | null>(null);
  // Kept apart from RHF errors: re-validation after a refetch must not wipe what the server said.
  const [serverErrors, setServerErrors] = useState<Partial<Record<BookingField, string>>>({});
  // A create that timed out may still have been committed.
  const lastAttemptWasTransient = useRef(false);

  const { original, gone } = useFreshOriginal(snapshot);
  const schedule = useDaySchedule(initialValues.date);
  const validationContext = useMemo<ValidationContext | null>(
    () => (now ? { now, existing: schedule.bookings, original } : null),
    [now, schedule.bookings, original],
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
  schedule.syncDate(formDate);

  // New bookings or a new minute: re-check the chosen time once the user has tried to submit.
  useEffect(() => {
    if (formState.isSubmitted) void trigger(['start', 'end']);
  }, [validationContext, formState.isSubmitted, trigger]);

  const phase = original && now ? getBookingPhase(original, now) : 'upcoming';
  const dayCtx: DayContext | null =
    now && formDate ? { date: formDate, bookings: schedule.bookings, now, excludeId: original?.id } : null;
  const validRange = Boolean(formDate && isValidTime(start) && isValidTime(end) && toMinutes(start) < toMinutes(end));

  const preview = useMemo<BookingPreview | null>(() => {
    if (!validRange || !formDate) return null;
    const conflicts = findConflicts({ date: formDate, start, end }, schedule.bookings, original?.id);
    return { date: formDate, start, end, conflict: conflicts.length > 0, conflictIds: conflicts.map((b) => b.id) };
  }, [validRange, formDate, start, end, schedule.bookings, original?.id]);

  // An Effect Event: consumers may pass an inline callback without causing a render loop.
  const reportPreview = useEffectEvent((next: BookingPreview | null) => onPreviewChange?.(next));
  useEffect(() => reportPreview(preview), [preview]);
  useEffect(() => () => reportPreview(null), []);

  const save = async (values: BookingFormValues) => {
    setAlert(null);
    setServerErrors({});
    const attempted = normalizeInput(values);
    const sentAtCount = schedule.updateCount();
    try {
      const saved =
        mode === 'edit' && original
          ? await updateMutation.mutateAsync({ original, patch: { ...attempted, title: attempted.title ?? '' } })
          : await createMutation.mutateAsync(attempted);
      lastAttemptWasTransient.current = false;
      onSuccess(saved);
    } catch (error: unknown) {
      const feedback = classifyServerError(error, {
        mode,
        attempted,
        afterTransientFailure: lastAttemptWasTransient.current,
      });
      lastAttemptWasTransient.current = error instanceof ApiError && error.isTransient;
      applyFeedback(feedback, sentAtCount);
    }
  };

  const applyFeedback = (feedback: ReturnType<typeof classifyServerError>, sentAtCount: number) => {
    switch (feedback.kind) {
      case 'saved':
        return onSuccess(feedback.booking);
      case 'conflict':
        // Trusted only until the post-mutation refetch lands (it may have failed).
        schedule.reportConflicts(sentAtCount, feedback.conflicts);
        setAlert({ kind: 'conflict', conflicts: feedback.conflicts });
        return setFocus('start');
      case 'fields':
        setServerErrors(feedback.errors);
        return setFocus(feedback.focus);
      case 'alert':
        return setAlert(feedback.alert);
    }
  };

  // handleSubmit is created per event so the callback (which touches a ref) never runs during render.
  const submit = (event?: BaseSyntheticEvent) => {
    // A create that timed out may have been committed; the refetch then shows it as ours.
    // Local validation would call it a conflict, so recognise it before validating.
    if (lastAttemptWasTransient.current && mode === 'create') {
      const attempted = normalizeInput(getValues());
      const ours = schedule.bookings.find((b) => sameSlot(b, attempted));
      if (ours) {
        event?.preventDefault();
        lastAttemptWasTransient.current = false;
        onSuccess(ours);
        return Promise.resolve();
      }
    }
    return form.handleSubmit(save)(event);
  };

  /** The user changed the schedule fields: stale server feedback about them no longer applies. */
  const onScheduleEdited = () => {
    setAlert((a) => (a?.kind === 'conflict' ? null : a));
    setServerErrors(({ title }) => (title ? { title } : {}));
  };

  /** A running booking can only move its end, so only a shorter end is ever suggested. */
  const suggestion =
    alert?.kind === 'conflict' && dayCtx && validRange
      ? phase === 'ongoing'
        ? shortenToFit({ start, end }, dayCtx)
        : findNearestFreeSlot({ start, end }, dayCtx)
      : null;

  const revalidate = formState.isSubmitted;

  return {
    form,
    now,
    alert: gone && !alert ? ({ kind: 'not-found' } as const) : alert,
    lockedStart: phase === 'ongoing',
    preview,
    dayLoading: formDate !== null && schedule.loading,
    dayContext: dayCtx,
    startOptions: dayCtx ? startOptions(dayCtx) : [],
    endOptions: dayCtx && isValidTime(start) ? endOptions(start, dayCtx) : [],
    suggestion,
    fieldError: (field: BookingField) => formState.errors[field]?.message ?? serverErrors[field],
    submit,
    isSubmitting: formState.isSubmitting,
    getValues,

    setDate(value: string) {
      setValue('date', value, { shouldDirty: true, shouldValidate: revalidate });
      onScheduleEdited();
    },
    /** Sets both ends at once (start/end rows, suggestion). */
    setRange(range: TimeRange) {
      setValue('start', range.start, { shouldDirty: true, shouldValidate: revalidate });
      setValue('end', range.end, { shouldDirty: true, shouldValidate: revalidate });
      if (revalidate) void trigger(['start', 'end']);
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
