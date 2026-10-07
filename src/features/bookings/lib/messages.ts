import type { Booking } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import type { BookingViolationCode } from '@/domain/rules';
import { ApiError } from '@/lib/api/api-error';

import { formatDuration, formatRange } from './format';

const describeBooking = (b: Booking) => `${formatRange(b)}${b.title ? ` «${b.title}»` : ''}`;

export function describeConflicts(conflicts: readonly Booking[]): string {
  return conflicts.map(describeBooking).join(', ');
}

const VIOLATION_TEXT: Record<BookingViolationCode, string> = {
  INVALID_DATE: 'Укажите корректную дату',
  INVALID_TIME: 'Выберите время',
  INVALID_STEP: `Время должно быть кратно ${BOOKING_RULES.stepMinutes} минутам`,
  OUTSIDE_WORKING_HOURS: `Переговорка доступна с ${BOOKING_RULES.workStart} до ${BOOKING_RULES.workEnd}`,
  START_NOT_BEFORE_END: 'Окончание должно быть позже начала',
  TOO_SHORT: `Минимум ${formatDuration(BOOKING_RULES.minDurationMinutes)}`,
  TOO_LONG: `Максимум ${formatDuration(BOOKING_RULES.maxDurationMinutes)}`,
  IN_PAST: 'Это время уже прошло',
  BOOKING_LOCKED: 'Эту бронь уже нельзя изменить',
  CONFLICT: 'Это время занято',
  TITLE_TOO_LONG: `Не длиннее ${BOOKING_RULES.titleMaxLength} символов`,
};

export function violationMessage(code: BookingViolationCode, conflicts: readonly Booking[] = []): string {
  if (code === 'CONFLICT' && conflicts.length > 0) return `Пересекается с ${describeConflicts(conflicts)}`;
  return VIOLATION_TEXT[code];
}

/** Human-readable text for errors that are not tied to a specific form field. */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Что-то пошло не так. Попробуйте ещё раз.';

  switch (error.code) {
    case 'NETWORK':
      return 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.';
    case 'TIMEOUT':
      return 'Сервер слишком долго не отвечает. Попробуйте ещё раз.';
    case 'NOT_FOUND':
      return 'Бронь не найдена — возможно, её уже удалили.';
    case 'CONFLICT':
      return 'Это время только что занял кто-то другой.';
    case 'BAD_REQUEST':
    case 'INVALID_RESPONSE':
      return 'Сервер не понял запрос. Обновите страницу и попробуйте снова.';
    case 'INTERNAL':
    case 'HTTP_ERROR':
      return 'Ошибка на сервере. Попробуйте ещё раз чуть позже.';
    default:
      return violationMessage(error.code, error.conflicts);
  }
}
