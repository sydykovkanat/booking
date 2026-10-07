import { expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { bookingDialog, createFromGap, detailsPanel, futureDate, openView, submit } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('create, edit and delete a booking', async ({ page }) => {
  const date = futureDate(10);
  await openView(page, 'day', date);

  // Create in one step: an hour from 09:00, a title, Enter-equivalent submit.
  await createFromGap(page, 'Забронировать 09:00–18:00');
  await bookingDialog(page).getByLabel('Название').fill('E2E планирование');
  await submit(page, 'Забронировать');
  await expect(bookingDialog(page)).toHaveCount(0);
  const block = page.getByRole('button', { name: '09:00–10:00, E2E планирование' });
  await expect(block).toBeVisible();

  // Edit: 1 h 30 min. Durations over 2 h are never offered.
  await block.click();
  await detailsPanel(page).getByRole('button', { name: 'Изменить' }).click();
  await bookingDialog(page).getByRole('combobox', { name: 'Конец' }).click();
  await expect(page.getByRole('option', { name: '11:00 · 2 ч' })).toBeVisible();
  await expect(page.getByRole('option', { name: /2 ч 15 мин/ })).toHaveCount(0);
  await page.getByRole('option', { name: '10:30 · 1 ч 30 мин' }).click();
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
  await detailsPanel(page).getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(longer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Забронировать 09:00–18:00' })).toBeVisible();
});

test('past dates are read-only', async ({ page }) => {
  await openView(page, 'day', futureDate(-1));
  await expect(page.getByRole('button', { name: /^Забронировать/ })).toHaveCount(0);

  // The seed has a booking yesterday: details open, but there is nothing to change.
  await page.getByRole('button', { name: /Демо спринта, завершена/ }).click();
  await expect(detailsPanel(page).getByText('Завершена', { exact: true })).toBeVisible();
  await expect(detailsPanel(page).getByRole('button', { name: 'Изменить' })).toHaveCount(0);
});

test('drag in the week grid selects a range and opens the quick form next to it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Dragging is a mouse interaction; phones tap instead.');
  const date = futureDate(12);
  await openView(page, 'week', date);

  const [y, m, d] = date.split('-').map(Number);
  const column = page.getByRole('list', { name: format(new Date(y, m - 1, d), 'd MMMM', { locale: ru }) });
  const box = (await column.boundingBox())!;
  const at = (minutes: number) => box.y + ((minutes - 9 * 60) / (9 * 60)) * box.height;

  await page.mouse.move(box.x + box.width / 2, at(11 * 60 + 5));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, at(12 * 60 + 20), { steps: 8 });
  await page.mouse.up();

  await expect(bookingDialog(page)).toBeVisible();
  await expect(bookingDialog(page).getByRole('combobox', { name: 'Начало' })).toHaveText(/11:00/);
  await expect(bookingDialog(page).getByRole('combobox', { name: 'Конец' })).toHaveText(/12:30 · 1 ч 30 мин/);
  await expect(bookingDialog(page).getByLabel('Название')).toBeFocused();
});

test('changing the date in the month popover moves the highlight and the popover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Phones use a drawer, not a popover anchored to a cell.');
  const first = futureDate(30);
  const [y, m] = first.split('-').map(Number);
  await openView(page, 'month', first);

  const cell = (day: number) =>
    page.getByRole('gridcell', { name: new RegExp(`^${format(new Date(y, m - 1, day), 'd MMMM', { locale: ru })},`) });
  const fromDay = Number(first.slice(8)) <= 20 ? 20 : 10;
  const toDay = fromDay + 2;

  await cell(fromDay).getByRole('button', { name: /^Новая бронь на/ }).click();
  await expect(cell(fromDay)).toHaveAttribute('data-active', 'true');

  await bookingDialog(page).getByRole('button', { name: /^Дата:/ }).click();
  // The date picker's month calendar (react-day-picker), not the month grid behind it.
  await page
    .locator('.rdp-root')
    .getByRole('button', { name: new RegExp(`(^|\\D)${toDay} ${format(new Date(y, m - 1, toDay), 'MMMM', { locale: ru })}`) })
    .click();

  await expect(cell(toDay)).toHaveAttribute('data-active', 'true');
  await expect(cell(fromDay)).not.toHaveAttribute('data-active');

  // The popover sits next to the new cell, not the old one.
  const popover = (await bookingDialog(page).boundingBox())!;
  const target = (await cell(toDay).boundingBox())!;
  // Placed on the right of the cell, or flipped to its left near the viewport edge.
  const besideRight = Math.abs(popover.x - (target.x + target.width)) < 40;
  const besideLeft = Math.abs(popover.x + popover.width - target.x) < 40;
  expect(besideRight || besideLeft).toBe(true);
  expect(popover.y).toBeLessThan(target.y + target.height);
  expect(popover.y + popover.height).toBeGreaterThan(target.y);
});
