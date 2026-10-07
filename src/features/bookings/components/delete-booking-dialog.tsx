'use client';

import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';

import { useDeleteBooking } from '../api/mutations';
import { formatRange } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';
import { notify } from '../lib/notify';

interface DeleteBookingDialogProps {
  booking: Booking | null;
  onClose: () => void;
  onDeleted: (booking: Booking) => void;
}

export function DeleteBookingDialog({ booking, onClose, onDeleted }: DeleteBookingDialogProps) {
  const mutation = useDeleteBooking();
  const [error, setError] = useState<string | null>(null);
  // Keep showing the last booking while the dialog animates out.
  const [shown, setShown] = useState(booking);
  if (booking && booking !== shown) setShown(booking);

  const close = () => {
    if (mutation.isPending) return;
    setError(null);
    mutation.reset();
    onClose();
  };

  const confirm = async () => {
    if (!booking) return;
    setError(null);
    try {
      await mutation.mutateAsync(booking);
      notify('success', `Бронь ${formatRange(booking)} удалена`);
      onDeleted(booking);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.isNotFound) {
        // Someone else deleted it first: the outcome the user wanted already happened.
        notify('info', 'Эту бронь уже удалили');
        onDeleted(booking);
        return;
      }
      setError(apiErrorMessage(e));
    }
  };

  return (
    <AlertDialog open={booking !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <IconTrash />
          </AlertDialogMedia>
          <AlertDialogTitle>Удалить бронь?</AlertDialogTitle>
          <AlertDialogDescription>
            {shown && (
              <>
                <span className="font-medium text-foreground tabular-nums">{formatRange(shown)}</span>
                {shown.title && <> · «{shown.title}»</>}. Это действие нельзя отменить.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-ui-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" label="Удаляем" />}
            {mutation.isPending ? 'Удаляем…' : 'Удалить'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
