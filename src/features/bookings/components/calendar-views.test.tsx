import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';

import { periodTitle } from './calendar-toolbar';
import { MonthView } from './month-view';
import { type Draft, TimeGrid } from './time-grid';

const NOW = { date: '2026-10-07', minutes: 12 * 60 };
const booking = (id: string, date: string, start: string, end: string, title?: string): Booking => ({
  id,
  date,
  start,
  end,
  ...(title && { title }),
});


describe('periodTitle', () => {
  it.each([
    ['month', '2026-10-08', 'Октябрь 2026'],
    ['day', '2026-10-08', 'Четверг, 8 октября'],
    ['week', '2026-10-08', '5–11 октября 2026'],
    ['week', '2026-10-29', '26 окт. – 1 нояб. 2026'],
  ] as const)('%s %s → %s', (view, date, expected) => {
    expect(periodTitle(view, date)).toBe(expected);
  });
});

describe('MonthView', () => {
  const bookings = [
    booking('a', '2026-10-08', '10:00', '11:00', 'Планирование'),
    booking('b', '2026-10-08', '11:00', '12:00'),
    booking('c', '2026-10-08', '13:00', '14:00'),
    booking('d', '2026-10-08', '15:00', '16:00'),
    booking('p', '2026-10-06', '10:00', '11:00', 'Прошлая'),
  ];
  const monthHandlers = () => ({ onCreate: vi.fn(), onPickDay: vi.fn(), onOpenDay: vi.fn(), onSelectBooking: vi.fn() });
  const renderMonth = (compact: boolean, h = monthHandlers()) => {
    render(<MonthView date="2026-10-08" now={NOW} bookings={bookings} compact={compact} activeCreateDay={null} {...h} />);
    return h;
  };

  it('renders a 6-week grid with chips and an overflow link', () => {
    renderMonth(false);
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    const cell = screen.getByRole('gridcell', { name: /^8 октября.*броней: 4$/ });
    expect(within(cell).getByText('Планирование')).toBeInTheDocument();
    expect(within(cell).getByRole('button', { name: 'Ещё 1' })).toBeInTheDocument();
  });

  it('creates next to the clicked future day, opens a day from its number, never creates in the past', async () => {
    const h = renderMonth(false);

    const create = screen.getByRole('button', { name: 'Новая бронь на 9 октября, пятница' });
    await userEvent.click(create);
    expect(h.onCreate).toHaveBeenCalledWith('2026-10-09', create);

    await userEvent.click(screen.getByRole('button', { name: 'Открыть 8 октября, четверг' }));
    expect(h.onOpenDay).toHaveBeenCalledWith('2026-10-08');
    expect(screen.queryByRole('button', { name: /^Новая бронь на 6 октября/ })).not.toBeInTheDocument();
  });

  it('passes the clicked chip as the anchor for details', async () => {
    const h = renderMonth(false);
    const chip = screen.getByRole('button', { name: /10:00\s*Планирование/ });
    await userEvent.click(chip);
    expect(h.onSelectBooking).toHaveBeenCalledWith(bookings[0], chip);
  });

  it('on phones, a tap selects the day instead of creating', async () => {
    const h = renderMonth(true);
    await userEvent.click(screen.getByRole('gridcell', { name: /^9 октября/ }));
    expect(h.onPickDay).toHaveBeenCalledWith('2026-10-09');
    expect(h.onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('gridcell', { name: /^8 октября/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TimeGrid', () => {
  const gridHandlers = () => ({ onSelectRange: vi.fn(), onSelectBooking: vi.fn(), onOpenDay: vi.fn() });
  const renderGrid = (days: string[], bookings: Booking[], draft: Draft | null = null) => {
    const h = gridHandlers();
    render(
      <TimeGrid days={days} now={NOW} bookings={bookings} draft={draft} draftRef={createRef()} editingId={null} {...h} />,
    );
    return h;
  };

  it('lists bookings and bookable gaps; Enter books an hour from the gap start', async () => {
    const h = renderGrid(['2026-10-08'], [booking('a', '2026-10-08', '10:00', '11:00', 'Планирование')]);

    const day = screen.getByRole('list', { name: '8 октября' });
    expect(within(day).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Забронировать 09:00–10:00',
      '10:00–11:00, Планирование',
      'Забронировать 11:00–18:00',
    ]);

    within(day).getByRole('button', { name: 'Забронировать 11:00–18:00' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onSelectRange).toHaveBeenCalledWith('2026-10-08', { start: '11:00', end: '12:00' }, 'keyboard');

    const block = within(day).getByRole('button', { name: '10:00–11:00, Планирование' });
    await userEvent.click(block);
    expect(h.onSelectBooking).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), block);
  });

  it('clips today to now, shortens to the gap and draws the draft', async () => {
    const h = renderGrid(
      ['2026-10-07', '2026-10-08'],
      [booking('a', '2026-10-08', '09:30', '18:00')],
      { day: '2026-10-08', start: '09:00', end: '09:30', conflict: false },
    );

    expect(screen.getByRole('button', { name: 'Забронировать 12:00–18:00' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Забронировать 09:00–09:30' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onSelectRange).toHaveBeenCalledWith('2026-10-08', { start: '09:00', end: '09:30' }, 'keyboard');
    expect(screen.getByText('Новая бронь')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Открыть 8 октября/ }));
    expect(h.onOpenDay).toHaveBeenCalledWith('2026-10-08');
  });
});

describe('TimeGrid pointer selection', () => {
  // jsdom has no layout: give the column a 540px height, i.e. 1px per minute from 09:00.
  const withColumnRect = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 540, left: 0, right: 200, height: 540, width: 200, x: 0, y: 0, toJSON: () => ({}),
    });
  const y = (time: string) => (Number(time.slice(0, 2)) - 9) * 60 + Number(time.slice(3));

  it('selects the dragged range with the mouse', () => {
    const rect = withColumnRect();
    const onSelectRange = vi.fn();
    render(
      <TimeGrid
        days={['2026-10-08']}
        now={NOW}
        bookings={[]}
        draft={null}
        draftRef={createRef()}
        editingId={null}
        onSelectRange={onSelectRange}
        onSelectBooking={vi.fn()}
      />,
    );
    const gap = screen.getByRole('button', { name: 'Забронировать 09:00–18:00' });
    gap.setPointerCapture = vi.fn();

    fireEvent.pointerDown(gap, { pointerType: 'mouse', button: 0, clientY: y('11:05'), pointerId: 1 });
    fireEvent.pointerMove(gap, { pointerType: 'mouse', clientY: y('12:20'), pointerId: 1 });
    expect(screen.getByText('Новая бронь')).toBeInTheDocument();
    fireEvent.pointerUp(gap, { pointerType: 'mouse', clientY: y('12:20'), pointerId: 1 });

    expect(onSelectRange).toHaveBeenCalledWith('2026-10-08', { start: '11:00', end: '12:30' }, 'pointer');
    rect.mockRestore();
  });

  it('a tap books an hour from the tapped quarter hour', () => {
    const rect = withColumnRect();
    const onSelectRange = vi.fn();
    render(
      <TimeGrid
        days={['2026-10-08']}
        now={NOW}
        bookings={[]}
        draft={null}
        draftRef={createRef()}
        editingId={null}
        onSelectRange={onSelectRange}
        onSelectBooking={vi.fn()}
      />,
    );
    const gap = screen.getByRole('button', { name: 'Забронировать 09:00–18:00' });

    fireEvent.pointerDown(gap, { pointerType: 'touch', clientY: y('13:40') });
    fireEvent.click(gap, { detail: 1, clientY: y('13:40') });
    expect(onSelectRange).toHaveBeenCalledWith('2026-10-08', { start: '13:30', end: '14:30' }, 'touch');
    rect.mockRestore();
  });
});

describe('TimeGrid pointer robustness', () => {
  const withColumnRect = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 540, left: 0, right: 200, height: 540, width: 200, x: 0, y: 0, toJSON: () => ({}),
    });
  const y = (time: string) => (Number(time.slice(0, 2)) - 9) * 60 + Number(time.slice(3));
  const props = (now = NOW) => ({
    days: ['2026-10-08'],
    now,
    bookings: [] as Booking[],
    draft: null,
    draftRef: createRef<HTMLDivElement>(),
    editingId: null,
    onSelectRange: vi.fn(),
    onSelectBooking: vi.fn(),
  });

  it('a cancelled pointer ends the drag without selecting', () => {
    const rect = withColumnRect();
    const p = props();
    render(<TimeGrid {...p} />);
    const gap = screen.getByRole('button', { name: 'Забронировать 09:00–18:00' });
    gap.setPointerCapture = vi.fn();

    fireEvent.pointerDown(gap, { pointerType: 'mouse', button: 0, clientY: y('11:05'), pointerId: 1 });
    fireEvent.pointerMove(gap, { pointerType: 'mouse', clientY: y('12:20'), pointerId: 1 });
    fireEvent.pointerCancel(gap, { pointerType: 'mouse', pointerId: 1 });
    expect(screen.queryByText('Новая бронь')).not.toBeInTheDocument();

    // A later hover is just a hover, not a continuing drag.
    fireEvent.pointerMove(gap, { pointerType: 'mouse', clientY: y('14:00'), pointerId: 1 });
    fireEvent.pointerUp(gap, { pointerType: 'mouse', clientY: y('14:00'), pointerId: 1 });
    expect(p.onSelectRange).not.toHaveBeenCalled();
    rect.mockRestore();
  });

  it('keeps the same free-window button as "now" moves within today', () => {
    const today = { date: '2026-10-08', minutes: 12 * 60 + 5 };
    const { rerender } = render(<TimeGrid {...props(today)} />);
    const before = screen.getByRole('button', { name: /^Забронировать 12:15–18:00/ });

    rerender(<TimeGrid {...props({ ...today, minutes: 12 * 60 + 20 })} />);
    const after = screen.getByRole('button', { name: /^Забронировать 12:30–18:00/ });
    expect(after).toBe(before);
  });
});
