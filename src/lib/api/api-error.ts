import type { ApiErrorCode } from '@/contracts/bookings';
import type { Booking } from '@/domain/booking';
import type { BookingField, BookingViolationCode } from '@/domain/rules';

/** Codes produced by the client itself, without a meaningful server body. */
export type ClientErrorCode = 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'HTTP_ERROR';

export type ApiErrorKind = ApiErrorCode | ClientErrorCode;

interface ApiErrorInit {
  status: number;
  code: ApiErrorKind;
  message: string;
  fields?: Partial<Record<BookingField, BookingViolationCode>>;
  conflicts?: Booking[];
}

/** The only error type the UI ever sees from the network layer. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorKind;
  readonly fields: Partial<Record<BookingField, BookingViolationCode>>;
  readonly conflicts: Booking[];

  constructor({ status, code, message, fields = {}, conflicts = [] }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.conflicts = conflicts;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  /** Worth retrying automatically: the request may succeed if sent again. */
  get isTransient(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500;
  }
}
