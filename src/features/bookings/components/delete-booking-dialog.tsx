'use client';

import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';

import { useDeleteBooking } from '../api/mutations';
import { formatRange } from '../lib/format';
import { apiErrorMessage } from '../lib/messages';

interface DeleteBookingDialogProps {
  booking: Booking | null;
  onClose: () => void;
  onDeleted: (booking: Booking) => void;
}

export function DeleteBookingDialog({ booking, onClose, onDeleted }: DeleteBookingDialogProps) {
  const mutation = useDeleteBooking();
  const [error, setError] = useState<string | null>(null);

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
      toast.success(`Бронь ${formatRange(booking)} удалена`);
      onDeleted(booking);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.isNotFound) {
        // Someone else deleted it first: the outcome the user wanted already happened.
        toast.info('Эту бронь уже удалили');
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
          <AlertDialogTitle>Удалить бронь?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking && (
              <>
                <span className="font-medium text-foreground tabular-nums">{formatRange(booking)}</span>
                {booking.title && <> · «{booking.title}»</>}. Это действие нельзя отменить.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/8 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
          <Button
            className="bg-destructive text-white shadow-destructive/20 hover:bg-destructive/90"
            onClick={confirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
            {mutation.isPending ? 'Удаляем…' : 'Удалить'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
