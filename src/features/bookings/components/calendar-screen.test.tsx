import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { CalendarScreen } from './calendar-screen';

// next/navigation's useSearchParams, driven by the real URL and our pushState calls.
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (cb: () => void) => {
    window.addEventListener('test:navigate', cb);
    return () => window.removeEventListener('test:navigate', cb);
  };
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});
vi.mock('../lib/notify', () => ({ notify: vi.fn() }));

const originalPushState = window.history.pushState.bind(window.history);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T04:00:00Z')); // 10:00 in Bishkek
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  window.history.pushState = (...args: Parameters<History['pushState']>) => {
    originalPushState(...args);
    window.dispatchEvent(new Event('test:navigate'));
  };
  originalPushState(null, '', '/?view=week&date=2026-10-08');
});

afterEach(() => {
  vi.useRealTimers();
  window.history.pushState = originalPushState;
});

function renderScreen(api: Partial<BookingsApi>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const full: BookingsApi = {
    list: vi.fn(async () => []),
    listRange: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...api,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={full}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  render(<CalendarScreen />, { wrapper });
  return full;
}

const booking: Booking = { id: 'a', date: '2026-10-08', start: '10:00', end: '11:00', title: 'Планирование' };

describe('CalendarScreen', () => {
  it('does not offer a seemingly free grid when the first load fails', async () => {
    renderScreen({
      listRange: vi.fn(async () => {
        throw new ApiError({ status: 0, code: 'NETWORK', message: 'offline' });
      }),
    });

    expect(await screen.findByText('Не удалось загрузить бронирования')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Забронировать/ })).not.toBeInTheDocument();
  });

  it('never shows the previous period while the next one loads', async () => {
    const listRange = vi.fn<BookingsApi['listRange']>(async (from) =>
      from === '2026-10-05' ? [booking] : new Promise<Booking[]>(() => {}),
    );
    renderScreen({ listRange });
    expect(await screen.findByRole('button', { name: '10:00–11:00, Планирование' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Вперёд' }));

    await waitFor(() => expect(listRange).toHaveBeenCalledWith('2026-10-12', '2026-10-18', expect.anything()));
    expect(screen.queryByRole('button', { name: /^Забронировать/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Загружаем бронирования')).toBeInTheDocument();
  });
});

describe('CalendarScreen — day view', () => {
  it('says so explicitly when a day has no bookings', async () => {
    originalPushState(null, '', '/?view=day&date=2026-10-09');
    renderScreen({ listRange: vi.fn(async () => []) });
    expect(await screen.findByText(/Броней нет — выделите время в сетке/)).toBeInTheDocument();
  });

  it('shows no hint when the day has bookings', async () => {
    originalPushState(null, '', '/?view=day&date=2026-10-08');
    renderScreen({ listRange: vi.fn(async () => [booking]) });
    expect(await screen.findByRole('button', { name: '10:00–11:00, Планирование' })).toBeInTheDocument();
    expect(screen.queryByText(/Броней нет/)).not.toBeInTheDocument();
  });
});
