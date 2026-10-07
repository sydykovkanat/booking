'use client';

import { IconAlertTriangle, IconArrowLeft, IconCalendarEvent, IconClock, IconSparkles } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ru as ruDateFns } from 'date-fns/locale';
import { useState } from 'react';
import { ru } from 'react-day-picker/locale';
import { useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { appConfig } from '@/config/app-config';
import type { Booking, IsoDate } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { buildSlotRows } from '@/domain/schedule';
import { toMinutes } from '@/domain/time';
import { demoApi } from '@/lib/api/demo-api';

import type { BookingFormValues } from '../form/booking-form-schema';
import { type FormAlertState, useBookingFormController } from '../form/use-booking-form-controller';
import { formatDuration, formatRange, isoDateToLocalDate, localDateToIsoDate } from '../lib/format';
import { describeConflicts } from '../lib/messages';
import { notify } from '../lib/notify';
import { SlotPicker } from './slot-picker';

type Step = 'pick' | 'confirm';

export interface BookingFlowProps {
  mode: 'create' | 'edit';
  initialValues: BookingFormValues;
  original?: Booking;
  onDateChange?: (date: IsoDate) => void;
  onSaved: (booking: Booking, mode: 'create' | 'edit') => void;
  onCancelEdit: () => void;
  onRecreate: (values: BookingFormValues) => void;
}

/** Step 1: date and time. Step 2: title and confirm. Server rejections of the time bring step 1 back. */
export function BookingFlow({ mode, initialValues, original, onDateChange, onSaved, onCancelEdit, onRecreate }: BookingFlowProps) {
  const [step, setStep] = useState<Step>(mode === 'edit' ? 'confirm' : 'pick');
  const ctl = useBookingFormController({
    mode,
    initialValues,
    original,
    onSuccess: (booking) => onSaved(booking, mode),
    onRejected: (kind) => kind === 'time' && setStep('pick'),
  });
  const [date, start, end, title] = useWatch({ control: ctl.form.control, name: ['date', 'start', 'end', 'title'] });
  // While the conflict banner is up it already explains the problem; don't repeat it.
  const timeError =
    ctl.alert?.kind === 'conflict' ? undefined : (ctl.fieldError('start') ?? ctl.fieldError('end') ?? ctl.fieldError('date'));

  const pickDate = (day: Date) => {
    const next = localDateToIsoDate(day);
    ctl.setDate(next);
    ctl.setStart('');
    onDateChange?.(next);
  };

  const goNext = async () => {
    if (await ctl.validateTime()) setStep('confirm');
  };

  const occupyAsColleague = async () => {
    const ok = await demoApi.occupy({ date, start, end });
    if (ok) notify('info', `Коллега занял ${formatRange({ start, end })}`, 'Нажмите «Забронировать» — сервер вернёт 409.');
    else notify('error', 'Не удалось занять слот', 'Проверьте, что время свободно и не в прошлом.');
  };

  if (step === 'confirm') {
    return (
      <form onSubmit={ctl.submit} noValidate aria-busy={ctl.isSubmitting} className="flex flex-col gap-6">
        <div>
          <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={() => setStep('pick')}>
            <IconArrowLeft data-icon="inline-start" aria-hidden /> {mode === 'edit' ? 'Изменить время' : 'Назад'}
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{mode === 'edit' ? 'Изменение брони' : 'Подтверждение'}</h2>
        </div>

        <FlowAlert alert={ctl.alert} onRecreate={() => onRecreate(ctl.getValues())} />

        <dl className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
          <SummaryRow icon={<IconCalendarEvent />} label="Дата">
            {format(isoDateToLocalDate(date), 'EEEE, d MMMM', { locale: ruDateFns })}
          </SummaryRow>
          <SummaryRow icon={<IconClock />} label="Время">
            <span className="tabular-nums">{formatRange({ start, end })}</span>
            <span className="text-muted-foreground"> · {formatDuration(toMinutes(end) - toMinutes(start))}</span>
          </SummaryRow>
        </dl>

        <Field data-invalid={Boolean(ctl.fieldError('title')) || undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="booking-title">
              Название <span className="font-normal text-muted-foreground">(необязательно)</span>
            </FieldLabel>
            <span className="text-ui-sm text-muted-foreground tabular-nums" aria-hidden>
              {title.length}/{BOOKING_RULES.titleMaxLength}
            </span>
          </div>
          <Input
            id="booking-title"
            size="lg"
            autoFocus
            placeholder="Например, планирование спринта"
            autoComplete="off"
            aria-invalid={Boolean(ctl.fieldError('title')) || undefined}
            aria-describedby={ctl.fieldError('title') ? 'booking-title-error' : undefined}
            {...ctl.form.register('title', { onChange: ctl.clearTitleError })}
          />
          <FieldError id="booking-title-error">{ctl.fieldError('title')}</FieldError>
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" className="sm:flex-1" disabled={ctl.isSubmitting || !ctl.now}>
            {ctl.isSubmitting && <Spinner data-icon="inline-start" label="Сохраняем" />}
            {ctl.isSubmitting ? 'Сохраняем…' : mode === 'edit' ? 'Сохранить' : 'Забронировать'}
          </Button>
          {mode === 'edit' && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancelEdit} disabled={ctl.isSubmitting}>
              Отмена
            </Button>
          )}
        </div>

        {appConfig.demoTools && mode === 'create' && (
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

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold">{mode === 'edit' ? 'Выберите новое время' : 'Выберите дату и время'}</h2>

      <FlowAlert
        alert={ctl.alert}
        suggestion={ctl.suggestion}
        onApplySuggestion={(slot) => {
          ctl.applySuggestion(slot);
          setStep('confirm');
        }}
        onRecreate={() => onRecreate(ctl.getValues())}
      />

      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <Calendar
          mode="single"
          locale={ru}
          weekStartsOn={1}
          required
          selected={isoDateToLocalDate(date)}
          defaultMonth={isoDateToLocalDate(date)}
          today={ctl.now ? isoDateToLocalDate(ctl.now.date) : undefined}
          disabled={ctl.now ? { before: isoDateToLocalDate(ctl.now.date) } : undefined}
          onSelect={pickDate}
          className="mx-auto bg-transparent p-0"
        />

        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-ui font-semibold">{format(isoDateToLocalDate(date), 'EEEE, d MMMM', { locale: ruDateFns })}</p>
          {timeError && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-ui-sm text-destructive">
              {timeError}
            </p>
          )}
          <div className="md:max-h-[22rem] md:overflow-y-auto md:pr-1 md:[scrollbar-gutter:stable]">
            <SlotPicker
              rows={ctl.dayContext ? buildSlotRows(ctl.dayContext) : []}
              ends={ctl.endOptions}
              start={start}
              end={end}
              loading={ctl.dayLoading || !ctl.now}
              lockedStart={ctl.lockedStart}
              onStartChange={ctl.setStart}
              onEndChange={ctl.setEnd}
              onNext={goNext}
            />
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <Button variant="ghost" className="self-start" onClick={onCancelEdit}>
          Отменить изменение
        </Button>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="text-ui font-medium first-letter:uppercase">{children}</dd>
    </div>
  );
}

interface FlowAlertProps {
  alert: FormAlertState | null;
  suggestion?: { start: string; end: string } | null;
  onApplySuggestion?: (slot: { start: string; end: string }) => void;
  onRecreate: () => void;
}

function FlowAlert({ alert, suggestion, onApplySuggestion, onRecreate }: FlowAlertProps) {
  if (!alert) return null;

  if (alert.kind === 'conflict') {
    return (
      <Alert variant="destructive" role="alert">
        <IconAlertTriangle aria-hidden />
        <AlertTitle>Это время только что заняли</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            {alert.conflicts.length > 0 && <>Пересекается с {describeConflicts(alert.conflicts)}. </>}
            Свободное время обновлено, название сохранено.
            {!suggestion && ' Свободных окон такой длительности на этот день не осталось.'}
          </p>
          {suggestion && onApplySuggestion && (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => onApplySuggestion(suggestion)}>
              <IconSparkles data-icon="inline-start" aria-hidden />
              Взять {formatRange(suggestion)}
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
          <p>Похоже, её удалил кто-то другой. Можно создать новую с теми же данными.</p>
          <Button size="sm" variant="secondary" className="self-start" onClick={onRecreate}>
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
        <Button type="submit" size="sm" variant="secondary" className="self-start">
          Повторить
        </Button>
      </AlertDescription>
    </Alert>
  );
}
