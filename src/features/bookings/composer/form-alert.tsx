'use client';

import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { TimeRange } from '@/domain/booking';

import type { FormAlertState } from '../form/server-feedback';
import { formatRange } from '../lib/format';
import { describeConflicts } from '../lib/messages';

interface FormAlertProps {
  alert: FormAlertState | null;
  suggestion: TimeRange | null;
  onApply: (range: TimeRange) => void;
  onRecreate: () => void;
}

export function FormAlert({ alert, suggestion, onApply, onRecreate }: FormAlertProps) {
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
