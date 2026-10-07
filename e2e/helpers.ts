import { expect, type Page } from '@playwright/test';

import { addDaysToIsoDate, getRoomNow } from '../src/domain/time';

const ROOM_TIME_ZONE = process.env.NEXT_PUBLIC_ROOM_TIME_ZONE || 'Asia/Bishkek';

/** A date far enough ahead to be free of seed data and never "in the past". */
export function futureDate(daysAhead: number): string {
  return addDaysToIsoDate(getRoomNow(new Date(), ROOM_TIME_ZONE).date, daysAhead);
}

export async function openDay(page: Page, date: string) {
  await page.goto(`/?date=${date}`);
  await expect(page.getByRole('list', { name: 'Расписание на день' })).toBeVisible();
}

export const submitButton = (page: Page, name: 'Забронировать' | 'Сохранить') =>
  page.getByRole('button', { name, exact: true });

/** Picks a time in the kit's Select (a button + listbox, not a native <select>). */
export async function pickTime(page: Page, label: 'Начало' | 'Окончание', value: string) {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: new RegExp(`^${value}`) }).click();
}

export const timeField = (page: Page, label: 'Начало' | 'Окончание') => page.getByLabel(label);
