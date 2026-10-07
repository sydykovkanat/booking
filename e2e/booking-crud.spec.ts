import { expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { bookingDialog, confirmTime, createFromGap, futureDate, openView, submit } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('create, edit and delete a booking', async ({ page }) => {
  const date = futureDate(10);
  await openView(page, 'day', date);

  // Create from the free day: starts at 09:00 with the default 1 h.
  await createFromGap(page, 'Забронировать 09:00–18:00');
  await confirmTime(page);
  await bookingDialog(page).getByLabel(/Название/).fill('E2E планирование');
  await submit(page, 'Забронировать');
  await expect(bookingDialog(page)).toHaveCount(0);
  const block = page.getByRole('button', { name: '09:00–10:00, E2E планирование' });
  await expect(block).toBeVisible();

  // Edit: extend to 1 h 30 min. Durations over 2 h are never offered.
  await block.click();
  await page.getByRole('button', { name: 'Изменить' }).click();
  await bookingDialog(page).getByRole('button', { name: /Изменить время/ }).click();
  await expect(page.getByRole('radio', { name: '2 ч', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: '2 ч 15 мин' })).toHaveCount(0);
  await confirmTime(page, '1 ч 30 мин');
  await submit(page, 'Сохранить');
  const longer = page.getByRole('button', { name: '09:00–10:30, E2E планирование' });
  await expect(longer).toBeVisible();

  // The month view counts it on that day (a chip on desktop, a dot on phones).
  await openView(page, 'month', date);
  const [y, m, d] = date.split('-').map(Number);
  const dayLabel = format(new Date(y, m - 1, d), 'd MMMM', { locale: ru });
  await expect(page.getByRole('gridcell', { name: new RegExp(`^${dayLabel},.*броней: 1$`) })).toBeVisible();

  // Delete with confirmation.
  await openView(page, 'day', date);
  await longer.click();
  await page.getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(longer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Забронировать 09:00–18:00' })).toBeVisible();
});

test('past dates are read-only', async ({ page }) => {
  await openView(page, 'day', futureDate(-1));
  await expect(page.getByRole('button', { name: /^Забронировать/ })).toHaveCount(0);

  // The seed has a booking yesterday: details open, but there is nothing to change.
  await page.getByRole('button', { name: /Демо спринта, завершена/ }).click();
  await expect(page.getByText('Завершена')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменить' })).toHaveCount(0);
});
