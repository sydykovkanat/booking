'use client';

import { IconCalendarPlus, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Booking, RoomNow } from '@/domain/booking';
import { BOOKING_RULES } from '@/domain/config';
import { getBookingPhase } from '@/domain/rules';
import { useMediaQuery } from '@/hooks/use-media-query';

import { BookingForm, type BookingFormProps } from '../form/booking-form';
import type { BookingFormValues } from '../form/booking-form-schema';
import { formatDuration, formatRange } from '../lib/format';
import { BookingDetails } from './booking-details';

export type EditorRequest =
  | { mode: 'create'; initialValues: BookingFormValues }
  | { mode: 'edit'; booking: Booking };

export type PanelRequest = { kind: 'details'; booking: Booking } | { kind: 'form'; editor: EditorRequest };

/** What the right-hand panel shows. `key` remounts its content on every open. */
export type PanelState = PanelRequest & { key: number };

type FormCallbacks = Pick<BookingFormProps, 'onSuccess' | 'onSwitchToCreate' | 'onPreviewChange'>;

interface InspectorProps extends FormCallbacks {
  panel: PanelState | null;
  now: RoomNow;
  canCreate: boolean;
  cannotCreateReason: string;
  onCreate: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
  onClose: () => void;
}

const DESKTOP_QUERY = '(min-width: 1024px)';
const RULES_SUMMARY = `${BOOKING_RULES.workStart}–${BOOKING_RULES.workEnd}, от ${formatDuration(BOOKING_RULES.minDurationMinutes)} до ${formatDuration(BOOKING_RULES.maxDurationMinutes)}`;

function toFormValues(booking: Booking): BookingFormValues {
  return { date: booking.date, start: booking.start, end: booking.end, title: booking.title ?? '' };
}

/**
 * Right-hand column on desktop, bottom drawer on mobile. The presentation is fixed while a panel
 * is open: switching it mid-edit (e.g. rotating a tablet) would remount the form and lose input.
 */
export function Inspector({
  panel,
  now,
  canCreate,
  cannotCreateReason,
  onCreate,
  onEdit,
  onDelete,
  onClose,
  ...formCallbacks
}: InspectorProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [locked, setLocked] = useState<{ key: number; desktop: boolean } | null>(null);
  if (panel && locked?.key !== panel.key) setLocked({ key: panel.key, desktop: isDesktop });
  const desktop = panel && locked?.key === panel.key ? locked.desktop : isDesktop;

  const heading =
    panel?.kind === 'form'
      ? {
          title: panel.editor.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь',
          description:
            panel.editor.mode === 'edit'
              ? `Сейчас: ${formatRange(panel.editor.booking)}`
              : `Рабочий день ${RULES_SUMMARY}`,
        }
      : null;

  const content =
    panel?.kind === 'details' ? (
      <BookingDetails
        key={panel.key}
        booking={panel.booking}
        phase={getBookingPhase(panel.booking, now)}
        onEdit={() => onEdit(panel.booking)}
        onDelete={() => onDelete(panel.booking)}
        onClose={desktop ? onClose : undefined}
      />
    ) : panel?.kind === 'form' ? (
      <BookingForm
        key={panel.key}
        mode={panel.editor.mode}
        initialValues={panel.editor.mode === 'edit' ? toFormValues(panel.editor.booking) : panel.editor.initialValues}
        original={panel.editor.mode === 'edit' ? panel.editor.booking : undefined}
        onCancel={onClose}
        {...formCallbacks}
      />
    ) : null;

  if (desktop) {
    return (
      <aside
        aria-label="Панель брони"
        className="rounded-2xl bg-card p-6 shadow-card lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto"
      >
        {heading && (
          <div className="mb-6 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold">{heading.title}</h2>
              <p className="mt-1 text-ui-sm text-muted-foreground">{heading.description}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Закрыть" onClick={onClose}>
              <IconX aria-hidden />
            </Button>
          </div>
        )}
        {content ?? <IdleHint canCreate={canCreate} reason={cannotCreateReason} onCreate={onCreate} />}
      </aside>
    );
  }

  return (
    <Drawer open={panel !== null} onOpenChange={(open) => !open && onClose()} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader className={heading ? 'text-left!' : 'sr-only'}>
          <DrawerTitle>{heading?.title ?? 'Бронь'}</DrawerTitle>
          {heading && <DrawerDescription>{heading.description}</DrawerDescription>}
        </DrawerHeader>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}

function IdleHint({ canCreate, reason, onCreate }: { canCreate: boolean; reason: string; onCreate: () => void }) {
  return (
    <Empty className="p-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconCalendarPlus />
        </EmptyMedia>
        <EmptyTitle>Забронировать переговорку</EmptyTitle>
        <EmptyDescription>
          {canCreate ? 'Нажмите на свободное время в расписании или создайте бронь вручную.' : reason}
        </EmptyDescription>
      </EmptyHeader>
      {canCreate && (
        <EmptyContent>
          <Button onClick={onCreate}>Новая бронь</Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
