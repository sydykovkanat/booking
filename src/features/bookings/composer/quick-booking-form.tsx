'use client';

import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import { useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { appConfig } from '@/config/app-config';
import type { Booking, TimeRange } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { isValidTime } from '@/domain/time';
import { demoApi } from '@/lib/api/demo-api';
import { cn } from '@/lib/utils';

import type { BookingFormValues } from '../form/booking-form-schema';
import {
  type BookingPreview,
  type FormAlertState,
  useBookingFormController,
} from '../form/use-booking-form-controller';
import { formatRange } from '../lib/format';
import { describeConflicts } from '../lib/messages';
import { notify } from '../lib/notify';
import { DateField } from './date-field';
import { TimeRangeControl } from './time-range-control';

export interface QuickBookingFormProps {
  mode: 'create' | 'edit';
  initialValues: BookingFormValues;
  original?: Booking;
  /** Focus the title on open. Off on touch devices, where the keyboard would cover the form. */
  autoFocusTitle?: boolean;
  onSaved: (booking: Booking, mode: 'create' | 'edit') => void;
  onCancel: () => void;
  onRecreate: (values: BookingFormValues) => void;
  onPreviewChange?: (preview: BookingPreview | null) => void;
}

/**
 * One-step create/edit: title, date, time. Used in the grid popover, the dialog and the
 * mobile drawer. All validation and server error handling comes from the shared controller.
 */
export function QuickBookingForm({
  mode,
  initialValues,
  original,
  autoFocusTitle = true,
  onSaved,
  onCancel,
  onRecreate,
  onPreviewChange,
}: QuickBookingFormProps) {
  const ctl = useBookingFormController({
    mode,
    initialValues,
    original,
    onPreviewChange,
    onSuccess: (booking) => onSaved(booking, mode),
  });
  const [date, start, end, title] = useWatch({ control: ctl.form.control, name: ['date', 'start', 'end', 'title'] });
  const showTimeError = ctl.alert?.kind !== 'conflict';
  const timeError = showTimeError ? (ctl.fieldError('start') ?? ctl.fieldError('end') ?? ctl.fieldError('date')) : undefined;
  const titleError = ctl.fieldError('title');
  const submitLabel = mode === 'edit' ? 'Сохранить' : 'Забронировать';

  const occupyAsColleague = async () => {
    const ok = await demoApi.occupy({ date, start, end });
    if (ok) notify('info', `Коллега занял ${formatRange({ start, end })}`, `Нажмите «${submitLabel}» — сервер вернёт 409.`);
    else notify('error', 'Не удалось занять слот', 'Проверьте, что время свободно и не в прошлом.');
  };

  return (
    <form onSubmit={ctl.submit} noValidate aria-busy={ctl.isSubmitting} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Input
          aria-label="Название"
          placeholder="Название встречи"
          autoComplete="off"
          autoFocus={autoFocusTitle}
          size="lg"
          aria-invalid={Boolean(titleError) || undefined}
          aria-describedby={titleError ? 'quick-title-error' : undefined}
          className="text-lg font-semibold placeholder:font-normal"
          {...ctl.form.register('title', { onChange: ctl.clearTitleError })}
        />
        <div className="flex items-center justify-between gap-3">
          <DateField value={date} min={ctl.now?.date} disabled={ctl.lockedStart} onChange={ctl.setDate} />
          {title.length > BOOKING_RULES.titleMaxLength - 20 && (
            <span className={cn('text-ui-sm tabular-nums', titleError ? 'text-destructive' : 'text-muted-foreground')}>
              {title.length}/{BOOKING_RULES.titleMaxLength}
            </span>
          )}
        </div>
        {titleError && (
          <p id="quick-title-error" className="text-ui-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <TimeRangeControl
          start={start}
          end={end}
          ends={ctl.endOptions}
          dayContext={ctl.dayContext}
          lockedStart={ctl.lockedStart}
          invalid={Boolean(timeError)}
          describedBy={timeError ? 'quick-time-error' : undefined}
          onChange={ctl.setRange}
        />
        {ctl.lockedStart && (
          <p className="text-ui-sm text-muted-foreground">Встреча уже идёт — можно изменить окончание и название.</p>
        )}
        {timeError && (
          <p id="quick-time-error" className="text-ui-sm text-destructive">
            {timeError}
          </p>
        )}
      </div>

      <FormAlert
        alert={ctl.alert}
        suggestion={ctl.suggestion}
        onApply={ctl.applySuggestion}
        onRecreate={() => onRecreate(ctl.getValues())}
      />

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={ctl.isSubmitting}>
          Отмена
        </Button>
        <Button
          type="submit"
          className="max-sm:h-12 sm:min-w-36"
          disabled={ctl.isSubmitting || !ctl.now || ctl.dayLoading || !isValidTime(start) || !isValidTime(end)}
        >
          {ctl.isSubmitting && <Spinner data-icon="inline-start" label="Сохраняем" />}
          {ctl.isSubmitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>

      {appConfig.demoTools && mode === 'create' && ctl.preview && !ctl.preview.conflict && (
        <button
          type="button"
          onClick={occupyAsColleague}
          className="focus-ring self-center rounded-md px-2 py-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          Демо: занять это время за коллегу → 409
        </button>
      )}
    </form>
  );
}

interface FormAlertProps {
  alert: FormAlertState | null;
  suggestion: TimeRange | null;
  onApply: (range: TimeRange) => void;
  onRecreate: () => void;
}

function FormAlert({ alert, suggestion, onApply, onRecreate }: FormAlertProps) {
  if (!alert) return null;

  if (alert.kind === 'conflict') {
    return (
      <Alert variant="destructive" role="alert">
        <IconAlertTriangle aria-hidden />
        <AlertTitle>Это время только что заняли</AlertTitle>
        <AlertDescription className="flex flex-col gap-2.5">
          <p>
            {alert.conflicts.length > 0 && <>{describeConflicts(alert.conflicts)}. </>}
            Расписание обновлено, название сохранено.
          </p>
          {suggestion ? (
            <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => onApply(suggestion)}>
              <IconSparkles data-icon="inline-start" aria-hidden /> Взять {formatRange(suggestion)}
            </Button>
          ) : (
            <p>Свободных окон такой длительности в этот день нет.</p>
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
        <AlertDescription className="flex flex-col gap-2.5">
          <p>Можно создать новую с теми же данными.</p>
          <Button type="button" size="sm" variant="secondary" className="self-start" onClick={onRecreate}>
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
      <AlertDescription className="flex flex-col gap-2.5">
        <p>{alert.message}</p>
        <Button type="submit" size="sm" variant="secondary" className="self-start">
          Повторить
        </Button>
      </AlertDescription>
    </Alert>
  );
}
