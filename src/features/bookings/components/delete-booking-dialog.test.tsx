import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { DeleteBookingDialog } from './delete-booking-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const booking: Booking = { id: 'a', date: '2026-10-08', start: '10:00', end: '11:00', title: 'Sync' };

function setup(remove: BookingsApi['remove']) {
  const api: BookingsApi = { list: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), remove: vi.fn(remove) };
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  const handlers = { onClose: vi.fn(), onDeleted: vi.fn() };
  render(<DeleteBookingDialog booking={booking} {...handlers} />, { wrapper });
  return { api, ...handlers };
}

describe('DeleteBookingDialog', () => {
  it('asks for confirmation and deletes', async () => {
    const { api, onDeleted } = setup(async () => undefined);
    expect(await screen.findByText(/10:00–11:00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(booking));
    expect(api.remove).toHaveBeenCalledWith('a');
  });

  it('treats 404 as already deleted', async () => {
    const { onDeleted } = setup(async () => {
      throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' });
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(booking));
  });

  it('keeps the dialog open with an error on failure', async () => {
    const { onDeleted } = setup(async () => {
      throw new ApiError({ status: 500, code: 'INTERNAL', message: 'boom' });
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ошибка на сервере');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
