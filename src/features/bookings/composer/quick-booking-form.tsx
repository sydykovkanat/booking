'use client';

import { useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { appConfig } from '@/config/app-config';
import type { Booking } from '@/domain/booking';
import { isValidTime } from '@/domain/time';
import { demoApi } from '@/lib/api/demo-api';

import type { BookingFormValues } from '../form/booking-form-schema';
import { type BookingPreview, useBookingFormController } from '../form/use-booking-form-controller';
import { formatRange } from '../lib/format';
import { notify } from '../lib/notify';
import { FormAlert } from './form-alert';
import { ScheduleFields } from './schedule-fields';
import { TitleField } from './title-field';

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
  // While the conflict banner is up it already explains the problem.
  const timeError =
    ctl.alert?.kind === 'conflict' ? undefined : (ctl.fieldError('start') ?? ctl.fieldError('end') ?? ctl.fieldError('date'));
  const submitLabel = mode === 'edit' ? 'Сохранить' : 'Забронировать';
  const canSubmit = !ctl.isSubmitting && ctl.now !== null && !ctl.dayLoading && isValidTime(start) && isValidTime(end);

  return (
    <form onSubmit={ctl.submit} noValidate aria-busy={ctl.isSubmitting} className="flex flex-col gap-5">
      <TitleField
        field={ctl.form.register('title', { onChange: ctl.clearTitleError })}
        length={title.length}
        error={ctl.fieldError('title')}
        autoFocus={autoFocusTitle}
      />

      <ScheduleFields
        date={date}
        start={start}
        end={end}
        minDate={ctl.now?.date}
        starts={ctl.startOptions}
        ends={ctl.endOptions}
        dayContext={ctl.dayContext}
        lockedStart={ctl.lockedStart}
        loading={ctl.dayLoading}
        error={timeError}
        onDateChange={ctl.setDate}
        onRangeChange={ctl.setRange}
      />

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
        <Button type="submit" className="font-semibold max-sm:h-12 sm:min-w-36" disabled={!canSubmit}>
          {ctl.isSubmitting && <Spinner data-icon="inline-start" label="Сохраняем" />}
          {ctl.isSubmitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>

      {appConfig.demoTools && mode === 'create' && ctl.preview && !ctl.preview.conflict && (
        <DemoOccupyButton date={date} start={start} end={end} submitLabel={submitLabel} />
      )}
    </form>
  );
}

/** Demo only: another "user" takes the selected time, so the next save gets a real 409. */
function DemoOccupyButton({ date, start, end, submitLabel }: { date: string; start: string; end: string; submitLabel: string }) {
  const occupy = async () => {
    const ok = await demoApi.occupy({ date, start, end });
    if (ok) notify('info', `Коллега занял ${formatRange({ start, end })}`, `Нажмите «${submitLabel}» — сервер вернёт 409.`);
    else notify('error', 'Не удалось занять слот', 'Проверьте, что время свободно и не в прошлом.');
  };

  return (
    <button
      type="button"
      onClick={occupy}
      className="focus-ring self-center rounded-md px-2 py-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
    >
      Демо: занять это время за коллегу → 409
    </button>
  );
}
