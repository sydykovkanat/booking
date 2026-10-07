'use client';

import type { Booking, RoomNow } from '@/domain/booking';
import { getBookingPhase } from '@/domain/rules';

import { QuickBookingForm } from '../composer/quick-booking-form';
import { Surface } from '../composer/surface';
import type { CalendarPanels } from '../hooks/use-calendar-panels';
import { BookingDetails } from './booking-details';

interface CalendarPanelProps {
  panels: CalendarPanels;
  now: RoomNow;
  compact: boolean;
  onDelete: (booking: Booking) => void;
}

/** The open panel's content (form or details) inside its surface (popover, dialog or drawer). */
export function CalendarPanel({ panels, now, compact, onDelete }: CalendarPanelProps) {
  // Render what is visible (open, or animating out), not just what is open.
  const { panel, visible, details } = panels;
  const label = visible?.kind === 'details' ? 'Бронь' : visible?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь';

  return (
    <Surface
      open={panel !== null}
      presentation={visible?.presentation ?? 'side'}
      anchor={panels.anchor}
      label={label}
      onClose={panels.close}
      onExited={panels.onExited}
    >
      {visible?.kind === 'compose' && (
        <QuickBookingForm
          key={visible.key}
          mode={visible.mode}
          original={visible.original}
          initialValues={visible.initialValues}
          autoFocusTitle={!compact}
          onSaved={panels.onSaved}
          onCancel={panels.close}
          onRecreate={panels.recreate}
          onPreviewChange={panels.onPreviewChange}
        />
      )}
      {visible?.kind === 'details' && details && (
        <BookingDetails
          booking={details}
          phase={getBookingPhase(details, now)}
          onEdit={panels.editDetails}
          onDelete={() => {
            panels.close();
            onDelete(details);
          }}
        />
      )}
    </Surface>
  );
}
