'use client';

import { CalendarPlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Booking } from '@/domain/booking';
import { useMediaQuery } from '@/hooks/use-media-query';

import { BookingForm, type BookingFormProps } from '../form/booking-form';
import type { BookingFormValues } from '../form/booking-form-schema';
import { formatRange } from '../lib/format';

export type EditorRequest =
  | { mode: 'create'; initialValues: BookingFormValues }
  | { mode: 'edit'; booking: Booking };

/** `key` remounts the form, so reopening always starts from fresh values. */
export type EditorState = EditorRequest & { key: number };

type FormCallbacks = Pick<BookingFormProps, 'onSuccess' | 'onCancel' | 'onSwitchToCreate' | 'onPreviewChange'>;

interface BookingEditorProps extends FormCallbacks {
  editor: EditorState | null;
  canCreate: boolean;
  cannotCreateReason: string;
  onCreate: () => void;
}

function toFormValues(booking: Booking): BookingFormValues {
  return { date: booking.date, start: booking.start, end: booking.end, title: booking.title ?? '' };
}

const DESKTOP_QUERY = '(min-width: 1024px)';

/** Inline side panel on desktop, bottom sheet on mobile. The form itself is identical. */
export function BookingEditor({ editor, canCreate, cannotCreateReason, onCreate, ...callbacks }: BookingEditorProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const title = editor?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь';
  const description =
    editor?.mode === 'edit'
      ? `Сейчас: ${formatRange(editor.booking)}${editor.booking.title ? ` · ${editor.booking.title}` : ''}`
      : 'Рабочий день 09:00–18:00, от 30 минут до 2 часов';

  const form = editor && (
    <BookingForm
      key={editor.key}
      mode={editor.mode}
      initialValues={editor.mode === 'edit' ? toFormValues(editor.booking) : editor.initialValues}
      original={editor.mode === 'edit' ? editor.booking : undefined}
      {...callbacks}
    />
  );

  if (isDesktop) {
    return (
      <aside aria-labelledby="editor-title" className="sticky top-6 rounded-3xl bg-card p-6 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
        {editor ? (
          <>
            <h2 id="editor-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
            {form}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground" aria-hidden>
              <CalendarPlusIcon className="size-5" />
            </div>
            <h2 id="editor-title" className="font-semibold">
              Забронировать переговорку
            </h2>
            <p className="max-w-60 text-sm text-muted-foreground">
              {canCreate ? 'Выберите свободное окно в расписании или задайте время вручную.' : cannotCreateReason}
            </p>
            {canCreate && (
              <Button className="mt-2" onClick={onCreate}>
                Новая бронь
              </Button>
            )}
          </div>
        )}
      </aside>
    );
  }

  return (
    <Sheet open={editor !== null} onOpenChange={(open) => !open && callbacks.onCancel()}>
      <SheetContent side="bottom" className="overflow-y-auto px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="p-0 pr-10 text-left">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  );
}
