import { bookingInputSchema, bookingPatchSchema } from '@/contracts/bookings';
import type { Booking, BookingInput } from '@/domain/booking';
import { getBookingPhase, normalizeInput, validateBooking } from '@/domain/rules';
import { getRoomNow, isValidIsoDate } from '@/domain/time';

import { badRequest, fromViolations, handleErrors, notFound, parseJsonBody } from './http';
import type { BookingsRepository } from './repository';

/** Enough for a 6-week month grid with some slack; keeps responses bounded. */
const MAX_RANGE_DAYS = 62;

function parseRange(from: string, to: string): { from: string; to: string } {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Query parameters "from" and "to" must be YYYY-MM-DD');
  if (from > to) throw badRequest('"from" must not be after "to"');
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_RANGE_DAYS) throw badRequest(`Range must not exceed ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

export interface BookingDeps {
  repository: BookingsRepository;
  clock: () => Date;
  timeZone: string;
}

export interface BookingHandlers {
  list(request: Request): Promise<Response>;
  create(request: Request): Promise<Response>;
  update(request: Request, id: string): Promise<Response>;
  remove(id: string): Promise<Response>;
}

/**
 * HTTP handlers for the bookings resource, independent of Next.js routing so they can be
 * tested with plain `Request` objects. The server never trusts the client's clock.
 */
export function createBookingHandlers({ repository, clock, timeZone }: BookingDeps): BookingHandlers {
  const now = () => getRoomNow(clock(), timeZone);

  const findOrThrow = (id: string): Booking => {
    const booking = repository.findById(id);
    if (!booking) throw notFound();
    return booking;
  };

  // No `await` between validation and the write: keeps check-and-insert atomic.
  const validateOrThrow = (input: BookingInput, original?: Booking) => {
    const violations = validateBooking(input, {
      now: now(),
      existing: repository.listByDate(input.date),
      original,
    });
    if (violations.length > 0) throw fromViolations(violations);
  };

  return {
    list: (request) =>
      handleErrors(() => {
        const params = new URL(request.url).searchParams;
        if (params.has('from') || params.has('to')) {
          const { from, to } = parseRange(params.get('from') ?? '', params.get('to') ?? '');
          return Response.json(repository.listByRange(from, to));
        }
        const date = params.get('date') ?? '';
        if (!isValidIsoDate(date)) throw badRequest('Query parameter "date" must be YYYY-MM-DD');
        return Response.json(repository.listByDate(date));
      }),

    create: (request) =>
      handleErrors(async () => {
        const input = normalizeInput(await parseJsonBody(request, bookingInputSchema));
        validateOrThrow(input);
        return Response.json(repository.create(input), { status: 201 });
      }),

    update: (request, id) =>
      handleErrors(async () => {
        const patch = await parseJsonBody(request, bookingPatchSchema);
        const original = findOrThrow(id);
        const { id: _, ...current } = original;
        const input = normalizeInput({ ...current, ...patch });
        validateOrThrow(input, original);
        return Response.json(repository.replace({ ...input, id }));
      }),

    remove: (id) =>
      handleErrors(() => {
        const booking = findOrThrow(id);
        if (getBookingPhase(booking, now()) === 'past') {
          throw fromViolations([{ field: 'start', code: 'BOOKING_LOCKED' }]);
        }
        repository.delete(id);
        return new Response(null, { status: 204 });
      }),
  };
}
