import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { BOOKING_RULES } from '@/domain/config';
import { validateBooking, type ValidationContext } from '@/domain/rules';

import { violationMessage } from '../lib/messages';

export const bookingFormSchema = z.object({
  date: z.string().min(1, 'Укажите дату'),
  start: z.string().min(1, 'Выберите начало'),
  end: z.string().min(1, 'Выберите окончание'),
  title: z.string().max(BOOKING_RULES.titleMaxLength, violationMessage('TITLE_TOO_LONG')),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/**
 * Field-level shape checks plus the exact same business rules the server enforces.
 * `ctx` carries the freshest bookings and clock; without it only the shape is checked.
 */
export function createBookingFormSchema(ctx: ValidationContext | null) {
  return bookingFormSchema.superRefine((values, issues) => {
    if (!ctx) return;

    for (const v of validateBooking(values, ctx)) {
      issues.addIssue({ code: 'custom', path: [v.field], message: violationMessage(v.code, v.conflicts) });
    }
  });
}

/** Resolver that reads the validation context RHF passes on every validation run. */
export const bookingFormResolver: Resolver<BookingFormValues, ValidationContext | null> = (values, ctx, options) =>
  zodResolver(createBookingFormSchema(ctx ?? null))(values, ctx, options);
