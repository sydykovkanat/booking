'use client';

import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import { Controller, useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { appConfig } from '@/config/app-config';
import { BOOKING_RULES } from '@/domain/config';
import { toMinutes } from '@/domain/time';
import { demoApi } from '@/lib/api/demo-api';

import { formatDuration, formatRange } from '../lib/format';
import { describeConflicts } from '../lib/messages';
import { notify } from '../lib/notify';
import type { BookingFormValues } from './booking-form-schema';
import { DatePicker } from './date-picker';
import { TimeSelect } from './time-select';
import {
  type BookingFormControllerOptions,
  type FormAlertState,
  useBookingFormController,
} from './use-booking-form-controller';

export type { BookingPreview } from './use-booking-form-controller';

export interface BookingFormProps extends BookingFormControllerOptions {
  onCancel: () => void;
  onSwitchToCreate: (values: BookingFormValues) => void;
}

const errorId = (id: string) => `${id}-error`;
const RULES_HINT = `От ${formatDuration(BOOKING_RULES.minDurationMinutes)} до ${formatDuration(BOOKING_RULES.maxDurationMinutes)}, шаг ${BOOKING_RULES.stepMinutes} мин`;

export function BookingForm({ onCancel, onSwitchToCreate, ...options }: BookingFormProps) {
  const ctl = useBookingFormController(options);
  const { form, now, formDate, validRange, preview } = ctl;
  const [start, end, title] = useWatch({ control: form.control, name: ['start', 'end', 'title'] });
  const submitLabel = options.mode === 'create' ? 'Забронировать' : 'Сохранить';

  const startError = ctl.fieldError('start');
  const endError = ctl.fieldError('end');
  const dateError = ctl.fieldError('date');
  const titleError = ctl.fieldError('title');
  // One row under both selects; an identical message is shown once.
  const timeError = startError ?? endError;
  const timeErrorExtra = startError && endError && endError !== startError ? endError : undefined;

  const occupyAsColleague = async () => {
    if (!formDate || !validRange) return;
    const ok = await demoApi.occupy({ date: formDate, start, end });
    if (ok) notify('info', `Коллега занял ${formatRange({ start, end })}`, `Нажмите «${submitLabel}» — сервер вернёт 409.`);
    else notify('error', 'Не удалось занять слот', 'Проверьте, что время свободно и не в прошлом.');
  };

  return (
    <form onSubmit={ctl.submit} noValidate aria-busy={ctl.isSubmitting} className="flex flex-col gap-6">
      <FormAlert
        alert={ctl.alert}
        suggestion={ctl.suggestion}
        onApplySuggestion={ctl.applySuggestion}
        onRecreate={() => onSwitchToCreate(ctl.getValues())}
      />

      {ctl.dayError && (
        <Alert variant="warning">
          <IconAlertTriangle aria-hidden />
          <AlertTitle>Не удалось загрузить расписание на эту дату</AlertTitle>
          <AlertDescription>
            Пересечения проверит сервер при сохранении.{' '}
            <button type="button" className="underline underline-offset-4" onClick={ctl.retryDay}>
              Повторить загрузку
            </button>
          </AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={Boolean(dateError) || undefined}>
          <FieldLabel htmlFor="booking-date">Дата</FieldLabel>
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DatePicker
                id="booking-date"
                value={field.value}
                min={now?.date}
                disabled={ctl.lockedStart}
                onChange={ctl.setDate}
                invalid={Boolean(dateError)}
                describedBy={dateError ? errorId('booking-date') : undefined}
              />
            )}
          />
          {ctl.lockedStart && (
            <FieldDescription>Встреча уже идёт — можно изменить только окончание и название.</FieldDescription>
          )}
          <FieldError id={errorId('booking-date')}>{dateError}</FieldError>
        </Field>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={Boolean(startError) || undefined}>
              <FieldLabel htmlFor="booking-start">Начало</FieldLabel>
              <Controller
                control={form.control}
                name="start"
                render={({ field }) => (
                  <TimeSelect
                    id="booking-start"
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={ctl.setStart}
                    options={ctl.startOptions}
                    placeholder={ctl.dayLoading ? 'Загрузка…' : 'Выберите'}
                    disabled={ctl.lockedStart || !now || ctl.dayLoading}
                    invalid={Boolean(startError)}
                    describedBy={timeError ? errorId('booking-time') : undefined}
                  />
                )}
              />
            </Field>
            <Field data-invalid={Boolean(endError) || undefined}>
              <FieldLabel htmlFor="booking-end">Окончание</FieldLabel>
              <Controller
                control={form.control}
                name="end"
                render={({ field }) => (
                  <TimeSelect
                    id="booking-end"
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={ctl.setEnd}
                    options={ctl.endOptions}
                    placeholder="Выберите"
                    disabled={!now || ctl.dayLoading || !start}
                    invalid={Boolean(endError)}
                    describedBy={timeError ? errorId('booking-time') : undefined}
                  />
                )}
              />
            </Field>
          </div>
          {timeError ? (
            <FieldError id={errorId('booking-time')}>
              {timeError}
              {timeErrorExtra && <div>{timeErrorExtra}</div>}
            </FieldError>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {validRange ? `Длительность: ${formatDuration(toMinutes(end) - toMinutes(start))}` : RULES_HINT}
            </p>
          )}
        </div>

        <Field data-invalid={Boolean(titleError) || undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="booking-title">
              Название <span className="font-normal text-muted-foreground">(необязательно)</span>
            </FieldLabel>
            <span className="text-sm text-muted-foreground tabular-nums" aria-hidden>
              {title.length}/{BOOKING_RULES.titleMaxLength}
            </span>
          </div>
          <Input
            id="booking-title"
            placeholder="Например, планирование спринта"
            autoComplete="off"
            aria-invalid={Boolean(titleError) || undefined}
            aria-describedby={titleError ? errorId('booking-title') : undefined}
            {...form.register('title', { onChange: ctl.clearTitleError })}
          />
          <FieldError id={errorId('booking-title')}>{titleError}</FieldError>
        </Field>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={ctl.isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" disabled={ctl.isSubmitting || !now || ctl.dayLoading} className="sm:min-w-40">
          {ctl.isSubmitting && <Spinner data-icon="inline-start" label="Сохраняем" />}
          {ctl.isSubmitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>

      {appConfig.demoTools && preview && !preview.conflict && (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto self-center text-center whitespace-normal text-muted-foreground"
          onClick={occupyAsColleague}
        >
          Демо: занять это время за коллегу, чтобы получить 409
        </Button>
      )}
    </form>
  );
}

interface FormAlertProps {
  alert: FormAlertState | null;
  suggestion: { start: string; end: string } | null;
  onApplySuggestion: (slot: { start: string; end: string }) => void;
  onRecreate: () => void;
}

function FormAlert({ alert, suggestion, onApplySuggestion, onRecreate }: FormAlertProps) {
  if (!alert) return null;

  if (alert.kind === 'conflict') {
    return (
      <Alert variant="destructive" role="alert">
        <IconAlertTriangle aria-hidden />
        <AlertTitle>Это время только что заняли</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            {alert.conflicts.length > 0 && <>Пересекается с {describeConflicts(alert.conflicts)}. </>}
            Расписание обновлено, введённые данные сохранены.
            {!suggestion && ' Свободных окон такой длительности на этот день не осталось.'}
          </p>
          {suggestion && (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onApplySuggestion(suggestion)}>
              <IconSparkles data-icon="inline-start" aria-hidden />
              Подставить {formatRange(suggestion)}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (alert.kind === 'not-found') {
    return (
      <Alert variant="warning" role="alert">
        <IconAlertTriangle aria-hidden />
        <AlertTitle>Эту бронь уже удалили</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>Похоже, её удалил кто-то другой. Можно создать новую бронь с теми же данными.</p>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={onRecreate}>
            Создать как новую
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" role="alert">
      <IconAlertTriangle aria-hidden />
      <AlertTitle>Не удалось сохранить</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{alert.message}</p>
        <Button type="submit" variant="outline" size="sm" className="self-start">
          Повторить
        </Button>
      </AlertDescription>
    </Alert>
  );
}
