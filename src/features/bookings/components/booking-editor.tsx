'use client';

import { IconCalendarPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Booking } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { useMediaQuery } from '@/hooks/use-media-query';

import { BookingForm, type BookingFormProps } from '../form/booking-form';
import type { BookingFormValues } from '../form/booking-form-schema';
import { formatDuration, formatRange } from '../lib/format';

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

const DESKTOP_QUERY = '(min-width: 1024px)';
const RULES_SUMMARY = `${BOOKING_RULES.workStart}–${BOOKING_RULES.workEnd}, от ${formatDuration(BOOKING_RULES.minDurationMinutes)} до ${formatDuration(BOOKING_RULES.maxDurationMinutes)}`;

function toFormValues(booking: Booking): BookingFormValues {
  return { date: booking.date, start: booking.start, end: booking.end, title: booking.title ?? '' };
}

/**
 * Inline side panel on desktop, bottom drawer on mobile. The presentation is fixed when the
 * editor opens: switching it mid-edit (e.g. rotating a tablet) would remount the form and lose input.
 */
export function BookingEditor({ editor, canCreate, cannotCreateReason, onCreate, ...callbacks }: BookingEditorProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [locked, setLocked] = useState<{ key: number; desktop: boolean } | null>(null);
  if (editor && locked?.key !== editor.key) setLocked({ key: editor.key, desktop: isDesktop });
  const desktop = editor && locked?.key === editor.key ? locked.desktop : isDesktop;

  const title = editor?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь';
  const description =
    editor?.mode === 'edit'
      ? `Сейчас: ${formatRange(editor.booking)}${editor.booking.title ? ` · ${editor.booking.title}` : ''}`
      : `Рабочий день ${RULES_SUMMARY}`;

  const form = editor && (
    <BookingForm
      key={editor.key}
      mode={editor.mode}
      initialValues={editor.mode === 'edit' ? toFormValues(editor.booking) : editor.initialValues}
      original={editor.mode === 'edit' ? editor.booking : undefined}
      {...callbacks}
    />
  );

  if (desktop) {
    return (
      <aside aria-labelledby="editor-title" className="rounded-2xl bg-card p-6 shadow-card lg:sticky lg:top-6">
        {editor ? (
          <>
            <h2 id="editor-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 mb-6 text-ui-sm text-muted-foreground">{description}</p>
            {form}
          </>
        ) : (
          <Empty className="p-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconCalendarPlus />
              </EmptyMedia>
              <EmptyTitle id="editor-title">Забронировать переговорку</EmptyTitle>
              <EmptyDescription>
                {canCreate ? 'Выберите свободное окно в расписании или задайте время вручную.' : cannotCreateReason}
              </EmptyDescription>
            </EmptyHeader>
            {canCreate && (
              <EmptyContent>
                <Button onClick={onCreate}>Новая бронь</Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </aside>
    );
  }

  return (
    <Drawer open={editor !== null} onOpenChange={(open) => !open && callbacks.onCancel()} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{form}</div>
      </DrawerContent>
    </Drawer>
  );
}
