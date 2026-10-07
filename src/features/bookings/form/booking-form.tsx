'use client';

import { Loader2Icon, SparklesIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appConfig } from '@/config/app-config';
import type { Booking, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { findConflicts } from '@/domain/overlap';
import { getBookingPhase, normalizeInput, type BookingField, type ValidationContext } from '@/domain/rules';
import { type DayContext, endOptions, findNearestFreeSlot, startOptions } from '@/domain/schedule';
import { isValidIsoDate, isValidTime, toMinutes } from '@/domain/time';
import { ApiError } from '@/lib/api/api-error';
import { demoApi } from '@/lib/api/demo-api';

import { useCreateBooking, useUpdateBooking } from '../api/mutations';
import { useBookings } from '../api/queries';
import { useRoomNow } from '../hooks/use-room-now';
import { formatDuration, formatRange } from '../lib/format';
import { apiErrorMessage, describeConflicts, violationMessage } from '../lib/messages';
import { bookingFormResolver, type BookingFormValues } from './booking-form-schema';
import { describedBy, Field, fieldErrorId } from './field';
import { FormAlert } from './form-alert';
import { pickEnd } from './pick-end';
import { TimeSelect } from './time-select';

type FormAlertState =
  | { kind: 'conflict'; conflicts: Booking[] }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

export interface BookingPreview extends TimeRange {
  date: string;
  conflict: boolean;
  conflictIds: string[];
}

export interface BookingFormProps {
  mode: 'create' | 'edit';
  initialValues: BookingFormValues;
  original?: Booking;
  onSuccess: (booking: Booking) => void;
  onCancel: () => void;
  onSwitchToCreate: (values: BookingFormValues) => void;
  onPreviewChange?: (preview: BookingPreview | null) => void;
}

const FIELD_ORDER: BookingField[] = ['date', 'start', 'end', 'title'];

/** Merge bookings the server told us about (409) with the cached list, newest wins. */
function mergeById(base: readonly Booking[], extra: readonly Booking[]): Booking[] {
  return [...new Map([...base, ...extra].map((b) => [b.id, b])).values()];
}

export function BookingForm({
  mode,
  initialValues,
  original,
  onSuccess,
  onCancel,
  onSwitchToCreate,
  onPreviewChange,
}: BookingFormProps) {
  const now = useRoomNow();
  const [alert, setAlert] = useState<FormAlertState | null>(null);
  const [serverConflicts, setServerConflicts] = useState<Booking[]>([]);
  // Kept apart from RHF errors: re-validation after a refetch must not wipe what the server said.
  const [serverErrors, setServerErrors] = useState<Partial<Record<BookingField, string>>>({});
  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();

  // The form date is only known after the form exists, so the context lags one render behind
  // the date field; the effect below re-validates once fresh bookings arrive.
  const [contextDate, setContextDate] = useState(initialValues.date);
  const { data: cached = [], isPending: bookingsLoading } = useBookings(isValidIsoDate(contextDate) ? contextDate : null);
  const existing = useMemo(() => mergeById(cached, serverConflicts), [cached, serverConflicts]);
  const validationContext = useMemo<ValidationContext | null>(
    () => (now ? { now, existing, original } : null),
    [now, existing, original],
  );

  const { control, register, handleSubmit, getValues, setValue, setFocus, trigger, formState } =
    useForm<BookingFormValues, ValidationContext | null>({
      defaultValues: initialValues,
      resolver: bookingFormResolver,
      context: validationContext,
      mode: 'onTouched',
    });
  const { errors, isSubmitting, isSubmitted } = formState;
  const [date, start, end, title] = useWatch({ control, name: ['date', 'start', 'end', 'title'] });

  const formDate = isValidIsoDate(date) ? date : null;
  if (formDate && formDate !== contextDate) setContextDate(formDate);

  const phase = original && now ? getBookingPhase(original, now) : 'upcoming';
  const lockedStart = phase === 'ongoing';

  const dayCtx: DayContext | null =
    now && formDate ? { date: formDate, bookings: existing, now, excludeId: original?.id } : null;

  // Fresh bookings arrived (refetch or 409): re-check the time against them.
  useEffect(() => {
    if (isSubmitted) void trigger(['start', 'end']);
  }, [existing, isSubmitted, trigger]);

  const validRange = Boolean(formDate && isValidTime(start) && isValidTime(end) && toMinutes(start) < toMinutes(end));

  const preview = useMemo<BookingPreview | null>(() => {
    if (!validRange || !formDate) return null;
    const conflicts = findConflicts({ date: formDate, start, end }, existing, original?.id);
    return { date: formDate, start, end, conflict: conflicts.length > 0, conflictIds: conflicts.map((b) => b.id) };
  }, [validRange, formDate, start, end, existing, original?.id]);

  useEffect(() => onPreviewChange?.(preview), [preview, onPreviewChange]);
  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);

  // Cheap (a few dozen candidates), so no memo needed.
  const suggestion =
    alert?.kind === 'conflict' && dayCtx && validRange ? findNearestFreeSlot({ start, end }, dayCtx) : null;

  const fieldError = (field: BookingField) => errors[field]?.message ?? serverErrors[field];

  /** The user touched the schedule fields: stale server feedback about them no longer applies. */
  const onScheduleEdited = () => {
    setAlert((a) => (a?.kind === 'conflict' ? null : a));
    setServerErrors(({ title }) => (title ? { title } : {}));
  };

  const handleServerError = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setAlert({ kind: 'error', message: apiErrorMessage(error) });
      return;
    }
    if (error.isConflict) {
      setServerConflicts(error.conflicts);
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
      setServerErrors(
        Object.fromEntries(fields.map((f) => [f, violationMessage(error.fields[f]!, error.conflicts)])),
      );
      setFocus(fields[0]);
      return;
    }
    setAlert({ kind: 'error', message: apiErrorMessage(error) });
  };

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    setServerErrors({});
    const input = normalizeInput(values);
    try {
      const saved =
        mode === 'edit' && original
          ? await updateMutation.mutateAsync({ original, patch: { ...input, title: input.title ?? '' } })
          : await createMutation.mutateAsync(input);
      onSuccess(saved);
    } catch (error: unknown) {
      handleServerError(error);
    }
  });

  const applySuggestion = (slot: TimeRange) => {
    setValue('start', slot.start, { shouldDirty: true });
    setValue('end', slot.end, { shouldDirty: true, shouldValidate: true });
    void trigger('start');
    setAlert(null);
  };

  const occupyAsColleague = async () => {
    if (!formDate || !validRange) return;
    const ok = await demoApi.occupy({ date: formDate, start, end });
    if (ok) toast.info(`Коллега занял ${formatRange({ start, end })}. Нажмите «${submitLabel}» — сервер вернёт 409.`);
    else toast.error('Не удалось занять слот: проверьте, что время свободно и не в прошлом.');
  };

  const startOpts = dayCtx ? startOptions(dayCtx) : [];
  const endOpts = dayCtx && isValidTime(start) ? endOptions(start, dayCtx) : [];
  const duration = validRange ? formatDuration(toMinutes(end) - toMinutes(start)) : null;
  const submitLabel = mode === 'create' ? 'Забронировать' : 'Сохранить';
  // Start/end errors share one row under both selects; identical messages are shown once.
  const timeErrors = [
    { id: 'booking-start', message: fieldError('start') },
    { id: 'booking-end', message: fieldError('end') !== fieldError('start') ? fieldError('end') : undefined },
  ].filter((e): e is { id: string; message: string } => Boolean(e.message));

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting} className="flex flex-col gap-5">
      {alert?.kind === 'conflict' && (
        <FormAlert
          title="Это время только что заняли"
          action={
            suggestion && (
              <Button type="button" variant="outline" size="sm" onClick={() => applySuggestion(suggestion)}>
                <SparklesIcon /> Подставить {formatRange(suggestion)}
              </Button>
            )
          }
        >
          {alert.conflicts.length > 0 && <>Пересекается с {describeConflicts(alert.conflicts)}. </>}
          Расписание обновлено — выберите другое время, введённые данные сохранены.
          {!suggestion && ' Свободных окон такой длительности на этот день не осталось.'}
        </FormAlert>
      )}
      {alert?.kind === 'not-found' && (
        <FormAlert
          title="Эту бронь уже удалили"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => onSwitchToCreate(getValues())}>
              Создать как новую
            </Button>
          }
        >
          Похоже, её удалил кто-то другой. Можно создать новую бронь с теми же данными.
        </FormAlert>
      )}
      {alert?.kind === 'error' && (
        <FormAlert
          title="Не удалось сохранить"
          action={
            <Button type="submit" variant="outline" size="sm">
              Повторить
            </Button>
          }
        >
          {alert.message}
        </FormAlert>
      )}

      <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
        <legend className="sr-only">Параметры брони</legend>

        <Field
          id="booking-date"
          label="Дата"
          error={fieldError('date')}
          hint={lockedStart ? 'Встреча уже идёт — можно изменить только окончание и название' : undefined}
        >
          <Input
            id="booking-date"
            type="date"
            min={now?.date}
            disabled={lockedStart}
            aria-invalid={Boolean(fieldError('date'))}
            aria-describedby={describedBy('booking-date', fieldError('date'), lockedStart)}
            {...register('date', { onChange: onScheduleEdited })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="booking-start" label="Начало">
            <Controller
              control={control}
              name="start"
              render={({ field }) => (
                <TimeSelect
                  id="booking-start"
                  placeholder={bookingsLoading ? 'Загрузка…' : 'Выберите'}
                  options={startOpts}
                  disabled={lockedStart || !dayCtx}
                  aria-invalid={Boolean(fieldError('start'))}
                  aria-describedby={describedBy('booking-start', fieldError('start'))}
                  {...field}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (dayCtx) setValue('end', pickEnd(next, getValues(), dayCtx), { shouldDirty: true });
                    field.onChange(next);
                    onScheduleEdited();
                  }}
                />
              )}
            />
          </Field>
          <Field id="booking-end" label="Окончание">
            <Controller
              control={control}
              name="end"
              render={({ field }) => (
                <TimeSelect
                  id="booking-end"
                  placeholder="Выберите"
                  options={endOpts}
                  disabled={!dayCtx || !isValidTime(start)}
                  aria-invalid={Boolean(fieldError('end'))}
                  aria-describedby={describedBy('booking-end', fieldError('end'))}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    onScheduleEdited();
                  }}
                />
              )}
            />
          </Field>
        </div>

        {timeErrors.length > 0 && (
          <div className="-mt-2 flex flex-col gap-0.5">
            {timeErrors.map(({ id, message }) => (
              <p key={id} id={fieldErrorId(id)} className="text-[13px] text-destructive">
                {message}
              </p>
            ))}
          </div>
        )}

        <p className="-mt-1 text-[13px] text-muted-foreground" aria-live="polite">
          {duration
            ? `Длительность: ${duration}`
            : `От ${formatDuration(BOOKING_RULES.minDurationMinutes)} до ${formatDuration(BOOKING_RULES.maxDurationMinutes)}, шаг ${BOOKING_RULES.stepMinutes} мин`}
        </p>

        <Field
          id="booking-title"
          label="Название (необязательно)"
          error={fieldError('title')}
          hint={`${title.length}/${BOOKING_RULES.titleMaxLength}`}
        >
          <Input
            id="booking-title"
            placeholder="Например, планирование спринта"
            autoComplete="off"
            maxLength={BOOKING_RULES.titleMaxLength + 20}
            aria-invalid={Boolean(fieldError('title'))}
            aria-describedby={describedBy('booking-title', fieldError('title'), true)}
            {...register('title', { onChange: () => setServerErrors(({ title: _, ...rest }) => rest) })}
          />
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" disabled={isSubmitting || !now} className="sm:min-w-40">
          {isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          {isSubmitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>

      {appConfig.demoTools && preview && !preview.conflict && (
        <button
          type="button"
          onClick={occupyAsColleague}
          className="self-center rounded-lg px-2 py-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Демо: занять это время за коллегу, чтобы получить 409
        </button>
      )}
    </form>
  );
}
