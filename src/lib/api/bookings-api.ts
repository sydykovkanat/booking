import type { z } from 'zod';

import { apiErrorBodySchema, type BookingPatch, bookingListSchema, bookingSchema } from '@/contracts/bookings';
import type { Booking, BookingInput, IsoDate } from '@/domain/booking';

import { ApiError } from './api-error';

export interface RequestOptions {
  signal?: AbortSignal;
}

/** Port the UI depends on. Swap the implementation to talk to a real backend. */
export interface BookingsApi {
  list(date: IsoDate, options?: RequestOptions): Promise<Booking[]>;
  create(input: BookingInput): Promise<Booking>;
  update(id: string, patch: BookingPatch): Promise<Booking>;
  remove(id: string): Promise<void>;
}

export interface HttpBookingsApiOptions {
  /** Empty string means same origin. */
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createHttpBookingsApi({
  baseUrl = '',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: HttpBookingsApiOptions = {}): BookingsApi {
  async function request(path: string, init: RequestInit & RequestOptions = {}): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal,
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch (error: unknown) {
      // Caller cancelled (e.g. React Query on unmount): let it propagate untouched.
      if (init.signal?.aborted) throw error;
      if (timeout.aborted) throw new ApiError({ status: 0, code: 'TIMEOUT', message: 'Request timed out' });
      throw new ApiError({ status: 0, code: 'NETWORK', message: 'Network request failed' });
    }

    if (!response.ok) throw await toApiError(response);
    return response;
  }

  async function json<T>(path: string, schema: z.ZodType<T>, init?: RequestInit & RequestOptions): Promise<T> {
    const response = await request(path, init);
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: 'Unexpected response shape' });
    }
    return parsed.data;
  }

  const itemPath = (id: string) => `/api/bookings/${encodeURIComponent(id)}`;

  return {
    list: (date, options) =>
      json(`/api/bookings?${new URLSearchParams({ date })}`, bookingListSchema, { signal: options?.signal }),

    create: (input) => json('/api/bookings', bookingSchema, { method: 'POST', body: JSON.stringify(input) }),

    update: (id, patch) => json(itemPath(id), bookingSchema, { method: 'PATCH', body: JSON.stringify(patch) }),

    remove: async (id) => {
      await request(itemPath(id), { method: 'DELETE' });
    },
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = apiErrorBodySchema.safeParse(await response.json().catch(() => undefined));

  if (!body.success) {
    return new ApiError({ status: response.status, code: 'HTTP_ERROR', message: response.statusText || 'HTTP error' });
  }

  return new ApiError({ status: response.status, ...body.data.error });
}
