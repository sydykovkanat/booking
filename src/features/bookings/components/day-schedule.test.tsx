import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { DaySchedule } from './day-schedule';

const DATE = '2026-10-08';
const TOMORROW_NOW = { date: '2026-10-07', minutes: 600 };
const booking: Booking = { id: 'a', date: DATE, start: '10:00', end: '11:00', title: 'Планирование' };

function setup(list: BookingsApi['list'], now = TOMORROW_NOW) {
  const api: BookingsApi = { list: vi.fn(list), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  const handlers = { onBook: vi.fn(), onSelectBooking: vi.fn() };
  render(
    <DaySchedule
      date={DATE}
      now={now}
      readOnly={now.date > DATE}
      selectedBookingId={null}
      highlightedIds={new Set()}
      {...handlers}
    />,
    { wrapper },
  );
  return { api, ...handlers };
}

describe('DaySchedule', () => {
  it('shows a skeleton while loading', () => {
    setup(() => new Promise(() => {}));
    expect(screen.getByLabelText('Загружаем расписание')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders bookings and bookable gaps in chronological order', async () => {
    const { onBook, onSelectBooking } = setup(async () => [booking]);
    const list = await screen.findByRole('list', { name: 'Расписание на день' });
    const items = within(list).getAllByRole('button');

    expect(items.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Забронировать 09:00–10:00',
      '10:00–11:00, Планирование',
      'Забронировать 11:00–18:00',
    ]);

    await userEvent.click(items[2]);
    expect(onBook).toHaveBeenCalledWith({ start: '11:00', end: '12:00' });
    await userEvent.click(items[1]);
    expect(onSelectBooking).toHaveBeenCalledWith(booking);
  });

  it('caps the suggested end at the end of a short gap', async () => {
    const { onBook } = setup(async () => [booking, { id: 'b', date: DATE, start: '11:30', end: '18:00' }]);
    await userEvent.click(await screen.findByRole('button', { name: 'Забронировать 11:00–11:30' }));
    expect(onBook).toHaveBeenCalledWith({ start: '11:00', end: '11:30' });
  });

  it('hints that a free day is bookable', async () => {
    setup(async () => []);
    expect(await screen.findByText(/Весь день свободен/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Забронировать 09:00–18:00' })).toBeInTheDocument();
  });

  it('is read-only on a past date', async () => {
    setup(async () => [booking], { date: '2026-10-09', minutes: 0 });
    expect(await screen.findByRole('button', { name: /Планирование, завершена/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Забронировать/ })).not.toBeInTheDocument();
  });

  it('explains an empty past day', async () => {
    setup(async () => [], { date: '2026-10-09', minutes: 0 });
    expect(await screen.findByText('В этот день переговорку не бронировали')).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    let fail = true;
    const { api } = setup(async () => {
      if (fail) throw new ApiError({ status: 0, code: 'NETWORK', message: 'offline' });
      return [booking];
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не удалось загрузить бронирования');
    expect(alert).toHaveTextContent('Нет соединения с сервером');

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Планирование')).toBeInTheDocument();
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });
});
