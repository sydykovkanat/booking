import type { z } from 'zod';

import type { ApiErrorBody, ApiErrorCode } from '@/contracts/bookings';
import type { BookingViolation } from '@/domain/rules';

/** An error that already knows how it should look on the wire. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
  }
}

const VIOLATION_MESSAGES: Record<BookingViolation['code'], string> = {
  INVALID_DATE: 'Date must be a valid YYYY-MM-DD',
  INVALID_TIME: 'Time must be HH:mm',
  INVALID_STEP: 'Time must be on a 15-minute grid',
  OUTSIDE_WORKING_HOURS: 'Booking must be within working hours',
  START_NOT_BEFORE_END: 'Start must be before end',
  TOO_SHORT: 'Booking is shorter than the minimum duration',
  TOO_LONG: 'Booking is longer than the maximum duration',
  IN_PAST: 'Booking cannot be in the past',
  BOOKING_LOCKED: 'This booking can no longer be changed',
  CONFLICT: 'The slot overlaps an existing booking',
  TITLE_TOO_LONG: 'Title is too long',
};

export function badRequest(message: string): HttpError {
  return new HttpError(400, { error: { code: 'BAD_REQUEST', message } });
}

export function notFound(): HttpError {
  return new HttpError(404, { error: { code: 'NOT_FOUND', message: 'Booking not found' } });
}

export function fromViolations(violations: readonly BookingViolation[]): HttpError {
  const [first] = violations;
  const conflicts = violations.flatMap((v) => v.conflicts ?? []);
  const fields = Object.fromEntries(violations.map((v) => [v.field, v.code]));

  return new HttpError(first.code === 'CONFLICT' ? 409 : 422, {
    error: {
      code: first.code,
      message: VIOLATION_MESSAGES[first.code],
      fields,
      ...(conflicts.length > 0 && { conflicts }),
    },
  });
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('Request body must be valid JSON');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

/** Turns thrown errors into JSON responses; unexpected errors are logged and hidden from the client. */
export async function handleErrors(run: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await run();
  } catch (error: unknown) {
    if (error instanceof HttpError) return Response.json(error.body, { status: error.status });

    console.error('[api] unexpected error', error);
    const code: ApiErrorCode = 'INTERNAL';
    return Response.json({ error: { code, message: 'Internal server error' } } satisfies ApiErrorBody, {
      status: 500,
    });
  }
}
