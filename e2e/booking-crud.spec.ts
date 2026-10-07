import { expect, test } from '@playwright/test';

import { dayBookings, futureDate, openDay, pickSlot } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('create, edit and delete a booking', async ({ page }) => {
  await openDay(page, futureDate(10));
  await expect(dayBookings(page).getByText('Пока никто не бронировал.')).toBeVisible();

  // Create: 09:00 with the default 1 h.
  await pickSlot(page, '09:00');
  await expect(page.getByText('09:00–10:00')).toBeVisible();
  await page.getByLabel(/Название/).fill('E2E планирование');
  await page.getByRole('button', { name: 'Забронировать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Готово, переговорка ваша' })).toBeVisible();
  await expect(dayBookings(page).getByText('E2E планирование')).toBeVisible();

  // Edit: extend to 1 h 30 min. Durations over 2 h are never offered.
  await page.getByRole('button', { name: 'Изменить бронь 09:00–10:00' }).click();
  await page.getByRole('button', { name: /Изменить время/ }).click();
  await expect(page.getByRole('radio', { name: '2 ч', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: '2 ч 15 мин' })).toHaveCount(0);
  await pickSlot(page, '09:00', '1 ч 30 мин');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Бронь обновлена' })).toBeVisible();
  await expect(dayBookings(page).getByText('09:00–10:30')).toBeVisible();

  // Delete with confirmation.
  await page.getByRole('button', { name: 'Удалить бронь 09:00–10:30' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(dayBookings(page).getByText('Пока никто не бронировал.')).toBeVisible();
});

test('past dates are read-only', async ({ page }) => {
  await page.goto(`/?date=${futureDate(-1)}`);
  await expect(page.getByText('На этот день свободного времени не осталось.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Изменить|Удалить) бронь/ })).toHaveCount(0);
});
