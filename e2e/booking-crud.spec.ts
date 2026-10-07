import { expect, test } from '@playwright/test';

import { futureDate, openDay, pickTime, submitButton, timeField } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('create, edit and delete a booking', async ({ page }) => {
  await openDay(page, futureDate(10));
  await expect(page.getByText('Весь день свободен')).toBeVisible();

  // Create from the free window: the form is prefilled with 09:00–10:00.
  await page.getByRole('button', { name: 'Забронировать 09:00–18:00' }).click();
  await expect(timeField(page, 'Начало')).toContainText('09:00');
  await expect(timeField(page, 'Окончание')).toContainText('10:00');
  await page.getByLabel(/Название/).fill('E2E планирование');
  await submitButton(page, 'Забронировать').click();

  const schedule = page.getByRole('list', { name: 'Расписание на день' });
  await expect(schedule.getByText('E2E планирование')).toBeVisible();
  await expect(page.getByText('Забронировано: 09:00–10:00')).toBeVisible();

  // Edit: extend to 10:30.
  await page.getByRole('button', { name: 'Изменить бронь 09:00–10:00' }).click();
  await pickTime(page, 'Окончание', '10:30');
  await submitButton(page, 'Сохранить').click();
  await expect(schedule.getByText('09:00–10:30')).toBeVisible();

  // Business rule in the UI: 2h max, so 11:15 is not offered as an end for 09:00.
  await page.getByRole('button', { name: 'Изменить бронь 09:00–10:30' }).click();
  await timeField(page, 'Окончание').click();
  await expect(page.getByRole('option', { name: /^11:00/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /^11:15/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Отмена' }).click();

  // Delete with confirmation.
  await page.getByRole('button', { name: 'Удалить бронь 09:00–10:30' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(schedule.getByText('E2E планирование')).toHaveCount(0);
  await expect(page.getByText('Весь день свободен')).toBeVisible();
});

test('past dates are read-only', async ({ page }) => {
  await openDay(page, futureDate(-1));
  await expect(page.getByText('Прошедшая дата — только просмотр')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Забронировать/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Изменить|Удалить) бронь/ })).toHaveCount(0);
});
