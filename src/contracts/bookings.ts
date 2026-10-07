import { z } from 'zod';

import type { BookingField, BookingViolationCode } from '@/domain/rules';

/**
 * Wire contract shared by the API route handlers and the HTTP client.
 * These schemas only check the shape; business rules live in `@/domain/rules`.
 */

export const bookingSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  title: z.string().optional(),
});

export const bookingListSchema = z.array(bookingSchema);

export const bookingInputSchema = z.object({
  date: z.string(),
  start: z.string(),
  end: z.string(),
  title: z.string().optional(),
});

export const bookingPatchSchema = bookingInputSchema.partial();

export type BookingPatch = z.infer<typeof bookingPatchSchema>;

export type ApiErrorCode = BookingViolationCode | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL';

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.partialRecord(z.enum(['date', 'start', 'end', 'title']), z.string()).optional(),
    conflicts: bookingListSchema.optional(),
  }),
});

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Partial<Record<BookingField, BookingViolationCode>>;
    conflicts?: z.infer<typeof bookingListSchema>;
  };
}
