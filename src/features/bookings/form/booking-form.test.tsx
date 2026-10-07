import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { BookingForm, type BookingFormProps } from './booking-form';

const DATE = '2026-10-08';
const planning: Booking = { id: 'p', date: DATE, start: '10:00', end: '11:00', title: 'Планирование' };

function createFakeApi(bookings: Booking[] = [planning]) {
  return {
    list: vi.fn<BookingsApi['list']>(async (date) => bookings.filter((b) => b.date === date)),
    create: vi.fn<BookingsApi['create']>(async (input) => ({ ...input, id: 'new' })),
    update: vi.fn<BookingsApi['update']>(async (id, patch) => ({ ...planning, ...patch, id })),
    remove: vi.fn<BookingsApi['remove']>(async () => undefined),
  };
}

function renderForm(api: BookingsApi, props: Partial<BookingFormProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  const handlers = { onSuccess: vi.fn(), onCancel: vi.fn(), onSwitchToCreate: vi.fn() };
  render(
    <BookingForm
      mode="create"
      initialValues={{ date: DATE, start: '11:00', end: '12:00', title: '' }}
      {...handlers}
      {...props}
    />,
    { wrapper },
  );
  return handlers;
}

beforeEach(() => {
  // 2026-10-07 10:00 in Asia/Bishkek: DATE is tomorrow, so nothing is in the past.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T04:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const user = () => userEvent.setup();

async function waitForOptions() {
  await waitFor(() => expect(screen.getByRole('option', { name: /10:00 · занято/ })).toBeInTheDocument());
}

describe('BookingForm', () => {
  it('submits a normalized booking', async () => {
    const api = createFakeApi();
    const { onSuccess } = renderForm(api);
    await waitForOptions();

    await user().type(screen.getByLabelText(/Название/), '  Ревью  ');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' })));
    expect(api.create).toHaveBeenCalledWith({ date: DATE, start: '11:00', end: '12:00', title: 'Ревью' });
  });

  it('blocks an overlapping booking on the client without calling the API', async () => {
    const api = createFakeApi();
    renderForm(api, { initialValues: { date: DATE, start: '10:30', end: '11:30', title: '' } });
    await waitForOptions();

    await user().click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(await screen.findByText(/Пересекается с 10:00–11:00 «Планирование»/)).toBeInTheDocument();
    expect(screen.getByLabelText('Начало')).toHaveAttribute('aria-invalid', 'true');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps the input and suggests a free slot when the server returns 409', async () => {
    const colleague: Booking = { id: 'c', date: DATE, start: '11:00', end: '12:00', title: 'Коллега' };
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'overlap', conflicts: [colleague] }),
    );
    const { onSuccess } = renderForm(api);
    await waitForOptions();

    await user().type(screen.getByLabelText(/Название/), 'Ревью');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Это время только что заняли');
    expect(alert).toHaveTextContent('11:00–12:00 «Коллега»');
    expect(screen.getByLabelText(/Название/)).toHaveValue('Ревью');
    expect(screen.getByLabelText('Начало')).toHaveValue('11:00');
    expect(onSuccess).not.toHaveBeenCalled();

    // The schedule is refreshed after a conflict.
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    await user().click(screen.getByRole('button', { name: /Подставить 12:00–13:00/ }));
    expect(screen.getByLabelText('Начало')).toHaveValue('12:00');
    expect(screen.getByLabelText('Окончание')).toHaveValue('13:00');
    expect(screen.getByLabelText(/Название/)).toHaveValue('Ревью');
  });

  it('keeps the duration when the start changes', async () => {
    renderForm(createFakeApi(), { initialValues: { date: DATE, start: '11:00', end: '12:30', title: '' } });
    await waitForOptions();

    await user().selectOptions(screen.getByLabelText('Начало'), '13:00');
    expect(screen.getByLabelText('Окончание')).toHaveValue('14:30');
  });

  it('offers to recreate a booking that was deleted meanwhile', async () => {
    const api = createFakeApi();
    api.update.mockRejectedValueOnce(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' }));
    const { onSwitchToCreate } = renderForm(api, {
      mode: 'edit',
      original: planning,
      initialValues: { date: DATE, start: '10:00', end: '11:00', title: 'Планирование' },
    });
    await waitFor(() => expect(api.list).toHaveBeenCalled());

    await user().click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Эту бронь уже удалили');

    await user().click(screen.getByRole('button', { name: 'Создать как новую' }));
    expect(onSwitchToCreate).toHaveBeenCalledWith({ date: DATE, start: '10:00', end: '11:00', title: 'Планирование' });
  });

  it('shows server field errors from 422 under the fields', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(
      new ApiError({ status: 422, code: 'IN_PAST', message: 'past', fields: { start: 'IN_PAST' } }),
    );
    renderForm(api);
    await waitForOptions();

    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByText('Это время уже прошло')).toBeInTheDocument();
  });

  it('shows a retryable error on network failure and keeps the data', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK', message: 'offline' }));
    const { onSuccess } = renderForm(api);
    await waitForOptions();

    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером');

    await user().click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
