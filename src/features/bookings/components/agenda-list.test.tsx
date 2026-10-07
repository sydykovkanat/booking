import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';

import { AgendaList } from './agenda-list';

const NOW = { date: '2026-10-07', minutes: 12 * 60 };
const past: Booking = { id: 'p', date: '2026-10-06', start: '10:00', end: '11:00', title: 'Демо' };
const next: Booking = { id: 'n', date: '2026-10-08', start: '14:00', end: '14:30' };

describe('AgendaList', () => {
  it('groups bookings by day with an empty note and a today badge', async () => {
    const onSelectBooking = vi.fn();
    const onOpenDay = vi.fn();
    render(
      <AgendaList
        days={['2026-10-06', '2026-10-07', '2026-10-08']}
        now={NOW}
        bookings={[past, next]}
        onSelectBooking={onSelectBooking}
        onOpenDay={onOpenDay}
      />,
    );

    const today = screen.getByRole('region', { name: 'среда, 7 октября' });
    expect(within(today).getByText('сегодня')).toBeInTheDocument();
    expect(within(today).getByText('Броней нет')).toBeInTheDocument();

    const row = screen.getByRole('button', { name: /14:00–14:30\s*Без названия/ });
    await userEvent.click(row);
    expect(onSelectBooking).toHaveBeenCalledWith(next, row);

    await userEvent.click(screen.getByRole('button', { name: /^вт, 6 октября/i }));
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-06');
    expect(screen.getByText('Демо')).toHaveClass('line-through');
  });

  it('can hide day headers for a single, already titled day', () => {
    render(<AgendaList days={['2026-10-08']} hideHeaders now={NOW} bookings={[next]} onSelectBooking={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /октября/ })).not.toBeInTheDocument();
  });
});
