import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { BookingFlow, type BookingFlowProps } from './booking-flow';

vi.mock('../lib/notify', () => ({ notify: vi.fn() }));

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

function renderFlow(api: BookingsApi, props: Partial<BookingFlowProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  const handlers = { onSaved: vi.fn(), onDateChange: vi.fn(), onCancelEdit: vi.fn(), onRecreate: vi.fn() };
  render(
    <BookingFlow mode="create" initialValues={{ date: DATE, start: '', end: '', title: '' }} {...handlers} {...props} />,
    { wrapper },
  );
  return handlers;
}

beforeEach(() => {
  // 2026-10-07 10:00 in Asia/Bishkek: DATE is tomorrow, so nothing is in the past.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T04:00:00Z'));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

const user = () => userEvent.setup();
const slot = (time: string) => screen.findByRole('button', { name: time });
const chip = (label: string) => screen.getByRole('radio', { name: label });

async function pickAndContinue(time = '11:00') {
  // The slot may already be selected (expanded), e.g. after returning from step 2.
  if (!screen.queryByRole('button', { name: /Далее/ })) await user().click(await slot(time));
  await user().click(screen.getByRole('button', { name: /Далее/ }));
  await screen.findByRole('heading', { name: 'Подтверждение' });
}

describe('BookingFlow', () => {
  it('books a slot with the default 1 h duration and a trimmed title', async () => {
    const api = createFakeApi();
    const { onSaved } = renderFlow(api);

    await pickAndContinue('11:00');
    await user().type(screen.getByLabelText(/Название/), '  Ревью  ');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }), 'create'));
    expect(api.create).toHaveBeenCalledWith({ date: DATE, start: '11:00', end: '12:00', title: 'Ревью' });
  });

  it('shows an existing booking as one busy row instead of selectable starts', async () => {
    renderFlow(createFakeApi());
    await slot('09:00');

    expect(screen.getByText('Планирование').closest('li')).toHaveTextContent('10:00–11:00Планированиезанято');
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '09:45' })).not.toBeInTheDocument();
  });

  it('offers only durations that fit before the next booking', async () => {
    renderFlow(createFakeApi());
    await user().click(await slot('09:00'));

    expect(chip('30 мин')).toBeEnabled();
    expect(chip('1 ч')).toBeEnabled();
    expect(chip('1 ч 15 мин')).toBeDisabled();
    expect(chip('1 ч')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the chosen duration when the start changes', async () => {
    renderFlow(createFakeApi());
    await user().click(await slot('11:00'));
    await user().click(chip('1 ч 30 мин'));
    await user().click(screen.getByRole('button', { name: 'Другое время' }));
    await user().click(await slot('13:00'));

    expect(chip('1 ч 30 мин')).toHaveAttribute('aria-checked', 'true');
  });

  it('returns to the time step on 409, keeps the title and suggests a free slot', async () => {
    const colleague: Booking = { id: 'c', date: DATE, start: '11:00', end: '12:00', title: 'Коллега' };
    const schedule = [planning];
    const api = createFakeApi(schedule);
    // Like the real server: the colleague's booking is stored, so the refetch returns it too.
    api.create.mockImplementationOnce(async () => {
      schedule.push(colleague);
      throw new ApiError({ status: 409, code: 'CONFLICT', message: 'overlap', conflicts: [colleague] });
    });
    const { onSaved } = renderFlow(api);

    await pickAndContinue('11:00');
    await user().type(screen.getByLabelText(/Название/), 'Ревью');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Это время только что заняли');
    expect(alert).toHaveTextContent('11:00–12:00 «Коллега»');
    expect(onSaved).not.toHaveBeenCalled();
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    await user().click(screen.getByRole('button', { name: /Взять 12:00–13:00/ }));
    expect(await screen.findByText('12:00–13:00')).toBeInTheDocument();
    expect(screen.getByLabelText(/Название/)).toHaveValue('Ревью');
  });

  it('forgets a 409 conflict once the refetched schedule no longer has it', async () => {
    const ghost: Booking = { id: 'g', date: DATE, start: '11:00', end: '12:00', title: 'Удалённая' };
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'x', conflicts: [ghost] }));
    const { onSaved } = renderFlow(api);

    await pickAndContinue('11:00');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Удалённая');
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    // The ghost is gone from the server, so 11:00 is bookable again.
    await pickAndContinue('11:00');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('treats a 409 on retry after a timeout as success when it is our own booking', async () => {
    const api = createFakeApi();
    const ours: Booking = { id: 'mine', date: DATE, start: '11:00', end: '12:00' };
    api.create
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'TIMEOUT', message: 'slow' }))
      .mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'x', conflicts: [ours] }));
    const { onSaved } = renderFlow(api);

    await pickAndContinue('11:00');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    await user().click(await screen.findByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ours, 'create'));
  });

  it('keeps the data and offers a retry on network failure', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK', message: 'offline' }));
    const { onSaved } = renderFlow(api);

    await pickAndContinue('11:00');
    await user().type(screen.getByLabelText(/Название/), 'Ревью');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером');
    expect(screen.getByLabelText(/Название/)).toHaveValue('Ревью');

    await user().click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('goes back to the time step with the message when the server rejects the time (422)', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(
      new ApiError({ status: 422, code: 'IN_PAST', message: 'past', fields: { start: 'IN_PAST' } }),
    );
    renderFlow(api);

    await pickAndContinue('11:00');
    await user().click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByText('Это время уже прошло')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Выберите дату и время' })).toBeInTheDocument();
  });

  it('offers to recreate a booking that was deleted meanwhile', async () => {
    const api = createFakeApi();
    api.update.mockRejectedValueOnce(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' }));
    const { onRecreate } = renderFlow(api, {
      mode: 'edit',
      original: planning,
      initialValues: { date: DATE, start: '10:00', end: '11:00', title: 'Планирование' },
    });

    await user().click(await screen.findByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Эту бронь уже удалили');
    await user().click(screen.getByRole('button', { name: 'Создать как новую' }));
    expect(onRecreate).toHaveBeenCalledWith({ date: DATE, start: '10:00', end: '11:00', title: 'Планирование' });
  });

  it('shows a skeleton until the day schedule is loaded', () => {
    const api = createFakeApi();
    api.list.mockImplementation(() => new Promise(() => {}));
    renderFlow(api);
    expect(screen.getByLabelText('Загружаем свободное время')).toHaveAttribute('aria-busy', 'true');
  });
});
