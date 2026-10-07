import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Booking } from '@/domain/booking';
import { ApiError } from '@/lib/api/api-error';
import type { BookingsApi } from '@/lib/api/bookings-api';

import { BookingsApiProvider } from '../api/bookings-api-context';
import { QuickBookingForm, type QuickBookingFormProps } from './quick-booking-form';

vi.mock('../lib/notify', () => ({ notify: vi.fn() }));

const DATE = '2026-10-08';
const planning: Booking = { id: 'p', date: DATE, start: '10:00', end: '11:00', title: 'Планирование' };

function createFakeApi(bookings: Booking[] = [planning]) {
  return {
    list: vi.fn<BookingsApi['list']>(async (date) => bookings.filter((b) => b.date === date)),
    listRange: vi.fn<BookingsApi['listRange']>(async (from, to) => bookings.filter((b) => b.date >= from && b.date <= to)),
    create: vi.fn<BookingsApi['create']>(async (input) => ({ ...input, id: 'new' })),
    update: vi.fn<BookingsApi['update']>(async (id, patch) => ({ ...planning, ...patch, id })),
    remove: vi.fn<BookingsApi['remove']>(async () => undefined),
  };
}

function renderForm(api: BookingsApi, props: Partial<QuickBookingFormProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookingsApiProvider api={api}>{children}</BookingsApiProvider>
    </QueryClientProvider>
  );
  const handlers = { onSaved: vi.fn(), onCancel: vi.fn(), onRecreate: vi.fn() };
  render(
    <QuickBookingForm
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
const submitButton = () => screen.getByRole('button', { name: 'Забронировать' });
const ready = () => waitFor(() => expect(submitButton()).toBeEnabled());
const row = (label: 'Начало' | 'Конец') => screen.getByRole('combobox', { name: label });
const pick = async (label: 'Начало' | 'Конец', value: RegExp) => {
  await user().click(row(label));
  await user().click(await screen.findByRole('option', { name: value }));
};

describe('QuickBookingForm', () => {
  it('books with a trimmed title in one step', async () => {
    const api = createFakeApi();
    const { onSaved } = renderForm(api);
    await ready();

    await user().type(screen.getByLabelText('Название'), '  Ревью  ');
    await user().click(submitButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }), 'create'));
    expect(api.create).toHaveBeenCalledWith({ date: DATE, start: '11:00', end: '12:00', title: 'Ревью' });
  });

  it('keeps the duration when the start changes', async () => {
    renderForm(createFakeApi(), { initialValues: { date: DATE, start: '11:00', end: '12:30', title: '' } });
    await ready();

    await pick('Начало', /^13:00$/);
    expect(row('Начало')).toHaveTextContent('13:00');
    expect(row('Конец')).toHaveTextContent('14:30');
  });

  it('only offers starts and ends that do not overlap another booking', async () => {
    renderForm(createFakeApi(), { initialValues: { date: DATE, start: '09:00', end: '09:30', title: '' } });
    await ready();

    await user().click(row('Конец'));
    expect(await screen.findByRole('option', { name: /^10:00/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^10:15/ })).not.toBeInTheDocument();
    await user().keyboard('{Escape}');

    await user().click(row('Начало'));
    expect(await screen.findByRole('option', { name: /^11:00$/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^10:00$/ })).not.toBeInTheDocument();
  });

  it('keeps the title and suggests a free slot on 409', async () => {
    const colleague: Booking = { id: 'c', date: DATE, start: '11:00', end: '12:00', title: 'Коллега' };
    const schedule = [planning];
    const api = createFakeApi(schedule);
    // Like the real server: the colleague's booking is stored, so the refetch returns it too.
    api.create.mockImplementationOnce(async () => {
      schedule.push(colleague);
      throw new ApiError({ status: 409, code: 'CONFLICT', message: 'overlap', conflicts: [colleague] });
    });
    const { onSaved } = renderForm(api);
    await ready();

    await user().type(screen.getByLabelText('Название'), 'Ревью');
    await user().click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Это время только что заняли');
    expect(alert).toHaveTextContent('11:00–12:00 «Коллега»');
    expect(screen.getByLabelText('Название')).toHaveValue('Ревью');
    expect(onSaved).not.toHaveBeenCalled();

    await user().click(await screen.findByRole('button', { name: /Взять 12:00–13:00/ }));
    expect(row('Начало')).toHaveTextContent('12:00');
    expect(row('Конец')).toHaveTextContent('13:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forgets a 409 conflict once the refetched schedule no longer has it', async () => {
    const ghost: Booking = { id: 'g', date: DATE, start: '11:00', end: '12:00', title: 'Удалённая' };
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'x', conflicts: [ghost] }));
    const { onSaved } = renderForm(api);
    await ready();

    await user().click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Удалённая');
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    await user().click(submitButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('treats a 409 on retry after a timeout as success when it is our own booking', async () => {
    const api = createFakeApi();
    const ours: Booking = { id: 'mine', date: DATE, start: '11:00', end: '12:00' };
    api.create
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'TIMEOUT', message: 'slow' }))
      .mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'x', conflicts: [ours] }));
    const { onSaved } = renderForm(api);
    await ready();

    await user().click(submitButton());
    await user().click(await screen.findByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ours, 'create'));
  });

  it('keeps the data and offers a retry on network failure', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK', message: 'offline' }));
    const { onSaved } = renderForm(api);
    await ready();

    await user().type(screen.getByLabelText('Название'), 'Ревью');
    await user().click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером');
    expect(screen.getByLabelText('Название')).toHaveValue('Ревью');

    await user().click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows a server-side time error (422) next to the time', async () => {
    const api = createFakeApi();
    api.create.mockRejectedValueOnce(
      new ApiError({ status: 422, code: 'IN_PAST', message: 'past', fields: { start: 'IN_PAST' } }),
    );
    renderForm(api);
    await ready();

    await user().click(submitButton());
    expect(await screen.findByText('Это время уже прошло')).toBeInTheDocument();
  });

  it('offers to recreate a booking that was deleted meanwhile', async () => {
    const api = createFakeApi();
    api.update.mockRejectedValueOnce(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' }));
    const { onRecreate } = renderForm(api, {
      mode: 'edit',
      original: planning,
      initialValues: { date: DATE, start: '10:00', end: '11:00', title: 'Планирование' },
    });

    const save = await screen.findByRole('button', { name: 'Сохранить' });
    await waitFor(() => expect(save).toBeEnabled());
    await user().click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('Эту бронь уже удалили');
    await user().click(screen.getByRole('button', { name: 'Создать как новую' }));
    expect(onRecreate).toHaveBeenCalledWith({ date: DATE, start: '10:00', end: '11:00', title: 'Планирование' });
  });

  it('cannot be submitted until the day schedule is loaded', () => {
    const api = createFakeApi();
    api.list.mockImplementation(() => new Promise(() => {}));
    renderForm(api);
    expect(submitButton()).toBeDisabled();
  });
});
