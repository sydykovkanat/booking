import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';

import { periodTitle } from './calendar-toolbar';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';

const NOW = { date: '2026-10-07', minutes: 12 * 60 };
const booking = (id: string, date: string, start: string, end: string, title?: string): Booking => ({
  id,
  date,
  start,
  end,
  ...(title && { title }),
});

const handlers = () => ({ onCreate: vi.fn(), onOpenDay: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });

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

  it('renders a 6-week grid with chips and an overflow link', () => {
    const h = handlers();
    render(<MonthView date="2026-10-08" now={NOW} bookings={bookings} {...h} />);

    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    const cell = screen.getByRole('gridcell', { name: /^8 октября.*броней: 4$/ });
    expect(within(cell).getByText('Планирование')).toBeInTheDocument();
    expect(within(cell).getByRole('button', { name: '+ ещё 1' })).toBeInTheDocument();
  });

  it('creates on an empty future day, opens the day from its number, never creates in the past', async () => {
    const h = handlers();
    render(<MonthView date="2026-10-08" now={NOW} bookings={bookings} {...h} />);

    await userEvent.click(screen.getByRole('button', { name: 'Новая бронь на 9 октября, пятница' }));
    expect(h.onCreate).toHaveBeenCalledWith('2026-10-09');

    await userEvent.click(screen.getByRole('button', { name: 'Открыть 8 октября, четверг' }));
    expect(h.onOpenDay).toHaveBeenCalledWith('2026-10-08');

    expect(screen.queryByRole('button', { name: /^Новая бронь на 6 октября/ })).not.toBeInTheDocument();
  });

  it('opens booking details with edit and delete', async () => {
    const h = handlers();
    render(<MonthView date="2026-10-08" now={NOW} bookings={bookings} {...h} />);

    await userEvent.click(screen.getByRole('button', { name: /10:00\s*Планирование/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    expect(h.onEdit).toHaveBeenCalledWith(bookings[0]);
  });

  it('shows past bookings without edit actions', async () => {
    render(<MonthView date="2026-10-08" now={NOW} bookings={bookings} {...handlers()} />);
    await userEvent.click(screen.getByRole('button', { name: /10:00\s*Прошлая/ }));
    expect(await screen.findByText('Завершена')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
  });
});

describe('TimeGrid', () => {
  it('lists bookings and bookable gaps per day; keyboard booking starts at the gap start', async () => {
    const h = handlers();
    render(
      <TimeGrid
        days={['2026-10-08']}
        now={NOW}
        bookings={[booking('a', '2026-10-08', '10:00', '11:00', 'Планирование')]}
        pxPerMinute={1}
        {...h}
      />,
    );

    const day = screen.getByRole('list', { name: '8 октября' });
    expect(within(day).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Забронировать 09:00–10:00',
      '10:00–11:00, Планирование',
      'Забронировать 11:00–18:00',
    ]);

    within(day).getByRole('button', { name: 'Забронировать 11:00–18:00' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onCreate).toHaveBeenCalledWith('2026-10-08', { start: '11:00', end: '12:00' });
  });

  it('caps the suggested end at the end of a short gap and clips today to now', async () => {
    const h = handlers();
    render(
      <TimeGrid
        days={['2026-10-07', '2026-10-08']}
        now={NOW}
        bookings={[booking('a', '2026-10-08', '09:30', '18:00')]}
        pxPerMinute={1}
        {...h}
      />,
    );

    expect(screen.getByRole('button', { name: 'Забронировать 12:00–18:00' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Забронировать 09:00–09:30' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onCreate).toHaveBeenCalledWith('2026-10-08', { start: '09:00', end: '09:30' });

    await userEvent.click(screen.getByRole('button', { name: /^Открыть 8 октября/ }));
    expect(h.onOpenDay).toHaveBeenCalledWith('2026-10-08');
  });
});
