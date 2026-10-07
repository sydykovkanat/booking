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
  const handlers = { onBook: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(
    <DaySchedule date={DATE} now={now} readOnly={now.date > DATE} highlightedIds={new Set()} {...handlers} />,
    { wrapper },
  );
  return { api, ...handlers };
}

describe('DaySchedule', () => {
  it('shows a skeleton while loading', () => {
    setup(() => new Promise(() => {}));
    expect(screen.getByLabelText('Загружаем расписание')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders bookings and free windows with actions', async () => {
    const { onBook, onEdit, onDelete } = setup(async () => [booking]);
    const list = await screen.findByRole('list', { name: 'Расписание на день' });
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Свободно 09:00–10:00');
    expect(items[1]).toHaveTextContent('10:00–11:00');
    expect(items[1]).toHaveTextContent('Планирование');
    expect(items[2]).toHaveTextContent('Свободно 11:00–18:00');

    await userEvent.click(screen.getByRole('button', { name: 'Забронировать 09:00–10:00' }));
    expect(onBook).toHaveBeenCalledWith({ kind: 'free', start: '09:00', end: '10:00' });
    await userEvent.click(screen.getByRole('button', { name: 'Изменить бронь 10:00–11:00' }));
    expect(onEdit).toHaveBeenCalledWith(booking);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить бронь 10:00–11:00' }));
    expect(onDelete).toHaveBeenCalledWith(booking);
  });

  it('shows the empty state for a free day', async () => {
    setup(async () => []);
    expect(await screen.findByText('Весь день свободен')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Забронировать 09:00–18:00' })).toBeInTheDocument();
  });

  it('is read-only on a past date', async () => {
    setup(async () => [booking], { date: '2026-10-09', minutes: 0 });
    expect(await screen.findByText('Завершена')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Забронировать|Изменить|Удалить/ })).not.toBeInTheDocument();
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
