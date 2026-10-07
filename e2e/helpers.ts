import { expect, type Page } from '@playwright/test';

import { addDaysToIsoDate, getRoomNow } from '../src/domain/time';

const ROOM_TIME_ZONE = process.env.NEXT_PUBLIC_ROOM_TIME_ZONE || 'Asia/Bishkek';

/** A date far enough ahead to be free of seed data and never "in the past". */
export function futureDate(daysAhead: number): string {
  return addDaysToIsoDate(getRoomNow(new Date(), ROOM_TIME_ZONE).date, daysAhead);
}

export async function openView(page: Page, view: 'month' | 'week' | 'day', date: string) {
  await page.goto(`/?view=${view}&date=${date}`);
  await expect(page.getByRole('combobox', { name: 'Вид календаря' })).toBeVisible();
  await expect(page.getByLabel('Загружаем бронирования')).toHaveCount(0);
}

/** The create/edit panel: a popover on desktop, a drawer on phones, a dialog from the toolbar. */
export const bookingDialog = (page: Page) => page.getByRole('dialog', { name: /^(Новая бронь|Изменить бронь)$/ });
export const detailsPanel = (page: Page) => page.getByRole('dialog', { name: 'Бронь' });

/** Keyboard activation books an hour from the start of the free gap. */
export async function createFromGap(page: Page, gapLabel: string) {
  await page.getByRole('button', { name: gapLabel }).focus();
  await page.keyboard.press('Enter');
  await expect(bookingDialog(page)).toBeVisible();
}

export const submit = (page: Page, name: 'Забронировать' | 'Сохранить') =>
  bookingDialog(page).getByRole('button', { name, exact: true }).click();
