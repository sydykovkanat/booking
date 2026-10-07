'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Booking } from '@/domain/booking';

import type { BookingFormValues } from '../form/booking-form-schema';
import { BookingFlow } from './booking-flow';

export type DialogState =
  | { mode: 'create'; key: number; initialValues: BookingFormValues }
  | { mode: 'edit'; key: number; booking: Booking };

interface BookingDialogProps {
  state: DialogState | null;
  onClose: () => void;
  onSaved: (booking: Booking, mode: 'create' | 'edit') => void;
  onRecreate: (values: BookingFormValues) => void;
}

const toValues = (booking: Booking): BookingFormValues => ({
  date: booking.date,
  start: booking.start,
  end: booking.end,
  title: booking.title ?? '',
});

/** Create/edit in a dialog, reusing the two-step flow (time → confirm) with all its error handling. */
export function BookingDialog({ state, onClose, onSaved, onRecreate }: BookingDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-label={state?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь'}
        className="sm:max-w-3xl"
      >
        {state && (
          <BookingFlow
            key={state.key}
            mode={state.mode}
            original={state.mode === 'edit' ? state.booking : undefined}
            initialValues={state.mode === 'edit' ? toValues(state.booking) : state.initialValues}
            onSaved={onSaved}
            onCancelEdit={onClose}
            onRecreate={onRecreate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
