import { z } from 'zod';

import { BOOKING_FIELDS, BOOKING_VIOLATION_CODES } from '@/domain/rules';

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

export const apiErrorCodeSchema = z.enum([...BOOKING_VIOLATION_CODES, 'NOT_FOUND', 'BAD_REQUEST', 'INTERNAL']);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    fields: z.partialRecord(z.enum(BOOKING_FIELDS), z.enum(BOOKING_VIOLATION_CODES)).optional(),
    conflicts: bookingListSchema.optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
