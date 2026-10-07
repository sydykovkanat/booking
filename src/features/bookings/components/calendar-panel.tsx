'use client';

import { useState } from 'react';

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
  // Stands in for the anchor while it is not in the DOM (e.g. the grid is loading another day),
  // so the popover stays where it was instead of jumping to the top-left corner.
  const [proxy, setProxy] = useState<HTMLDivElement | null>(null);
  const rect = panels.lastAnchorRect;
  const label = visible?.kind === 'details' ? 'Бронь' : visible?.mode === 'edit' ? 'Изменить бронь' : 'Новая бронь';

  return (
    <>
      {rect && (
        <div
          ref={setProxy}
          aria-hidden
          className="pointer-events-none fixed"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}
      <Surface
        open={panel !== null}
        presentation={visible?.presentation ?? 'side'}
        anchor={panels.anchorTarget ?? proxy}
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
    </>
  );
}
