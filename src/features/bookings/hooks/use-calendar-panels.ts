'use client';

import { type RefObject, useRef, useState } from 'react';

import type { Booking, IsoDate, RoomNow, TimeRange } from '@/domain/booking';
import { buildAgenda } from '@/domain/schedule';
import { rangeAtMinute } from '@/domain/selection';
import { toMinutes } from '@/domain/time';

import type { Draft, SelectVia } from '../components/time-grid';
import type { Presentation } from '../composer/surface';
import type { BookingFormValues } from '../form/booking-form-schema';
import type { BookingPreview } from '../form/use-booking-form-controller';
import { formatRange } from '../lib/format';
import { notify } from '../lib/notify';

/** `'draft-cell'`: the month cell of the draft's current day, which moves with the draft. */
type Anchor = Element | null | RefObject<Element | null> | 'draft-cell';

export type Panel =
  | {
      kind: 'compose';
      key: number;
      mode: 'create' | 'edit';
      initialValues: BookingFormValues;
      original?: Booking;
      presentation: Presentation;
      anchor: Anchor;
    }
  | { kind: 'details'; key: number; booking: Booking; presentation: Presentation; anchor: Anchor };

interface Options {
  now: RoomNow;
  date: IsoDate;
  range: { from: IsoDate; to: IsoDate };
  bookings: readonly Booking[];
  compact: boolean;
  navigate: (next: { date: IsoDate }) => void;
}

const valuesOf = (b: Booking): BookingFormValues => ({ date: b.date, start: b.start, end: b.end, title: b.title ?? '' });

/**
 * Which panel is open (create/edit form or booking details), where it is shown, and the draft
 * drawn in the grid. Views report user intent; this hook turns it into panel state.
 */
export function useCalendarPanels({ now, date, range, bookings, compact, navigate }: Options) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftCell, setDraftCell] = useState<HTMLElement | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const floating: Presentation = compact ? 'drawer' : 'popover';
  const outOfView = (day: IsoDate) => day < range.from || day > range.to;

  const close = () => {
    setPanel(null);
    setDraft(null);
  };

  const compose = (day: IsoDate, slot: TimeRange, presentation: Presentation, anchor: Anchor) => {
    setDraft({ day, ...slot, conflict: false });
    const initialValues = { date: day, start: slot.start, end: slot.end, title: '' };
    setPanel({ kind: 'compose', key: Date.now(), mode: 'create', initialValues, presentation, anchor });
  };

  /** Create on a day, starting with its first free hour. */
  const composeOnDay = (day: IsoDate, presentation: Presentation, anchor: Anchor = null) => {
    const ctx = { date: day, bookings, now };
    const free = buildAgenda(ctx).find((i) => i.kind === 'free');
    const slot = free ? rangeAtMinute(ctx, toMinutes(free.start)) : null;
    if (!slot) {
      notify('info', 'Свободного времени нет', 'На этот день всё занято или рабочий день уже закончился.');
      return;
    }
    compose(day, slot, presentation, anchor);
  };

  const edit = (booking: Booking, anchor: Anchor) =>
    setPanel({
      kind: 'compose',
      key: Date.now(),
      mode: 'edit',
      original: booking,
      initialValues: valuesOf(booking),
      presentation: floating,
      anchor,
    });

  const resolve = (anchor: Anchor | undefined) => (anchor === 'draft-cell' ? draftCell : anchor);
  const editingId = panel?.kind === 'compose' && panel.mode === 'edit' ? (panel.original?.id ?? null) : null;
  const details =
    panel?.kind === 'details' ? (bookings.find((b) => b.id === panel.booking.id) ?? panel.booking) : null;

  return {
    panel,
    draft,
    draftRef,
    editingId,
    details,
    anchor: resolve(panel?.anchor),
    activeCreateDay: panel?.kind === 'compose' && draft ? draft.day : null,
    setDraftCell,
    close,

    createFromToolbar: () => composeOnDay(date < now.date ? now.date : date, compact ? 'drawer' : 'side'),
    createOnMonthDay: (day: IsoDate) => composeOnDay(day, floating, 'draft-cell'),
    selectRange: (day: IsoDate, slot: TimeRange, via: SelectVia) =>
      compose(day, slot, via === 'touch' || compact ? 'drawer' : 'popover', draftRef),

    showDetails: (booking: Booking, element: HTMLElement) => {
      setDraft(null);
      setPanel({ kind: 'details', key: Date.now(), booking, presentation: floating, anchor: element });
    },
    editDetails: () => {
      if (panel?.kind === 'details' && details) edit(details, resolve(panel.anchor) ?? null);
    },
    recreate: (values: BookingFormValues) => {
      if (panel?.kind !== 'compose') return;
      setPanel({ ...panel, key: Date.now(), mode: 'create', original: undefined, initialValues: values });
    },

    onPreviewChange: (preview: BookingPreview | null) => {
      // Keep the last draft while the form is incomplete: the popover is anchored to it.
      if (!preview) return;
      setDraft({ day: preview.date, start: preview.start, end: preview.end, conflict: preview.conflict });
      // The date was changed in the form: bring that day into view so the draft and popover follow.
      if (outOfView(preview.date)) navigate({ date: preview.date });
    },
    onSaved: (booking: Booking, mode: 'create' | 'edit') => {
      close();
      notify('success', mode === 'edit' ? 'Бронь обновлена' : 'Переговорка забронирована', formatRange(booking));
      if (outOfView(booking.date)) navigate({ date: booking.date });
    },
  };
}

export type CalendarPanels = ReturnType<typeof useCalendarPanels>;
