import { expect, type Page } from '@playwright/test';

import { addDaysToIsoDate, getRoomNow } from '../src/domain/time';

const ROOM_TIME_ZONE = process.env.NEXT_PUBLIC_ROOM_TIME_ZONE || 'Asia/Bishkek';

/** A date far enough ahead to be free of seed data and never "in the past". */
export function futureDate(daysAhead: number): string {
  return addDaysToIsoDate(getRoomNow(new Date(), ROOM_TIME_ZONE).date, daysAhead);
}

export async function openDay(page: Page, date: string) {
  await page.goto(`/?date=${date}`);
  await expect(page.getByRole('heading', { name: 'Выберите дату и время' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Брони на/ })).toBeVisible();
}

/** Step 1: pick a start (and optionally a duration), then "Next". */
export async function pickSlot(page: Page, start: string, duration?: string) {
  if (!(await page.getByRole('button', { name: /Далее/ }).isVisible())) {
    await page.getByRole('list', { name: 'Время начала' }).getByRole('button', { name: start, exact: true }).click();
  }
  if (duration) await page.getByRole('radio', { name: duration, exact: true }).click();
  await page.getByRole('button', { name: /Далее/ }).click();
}

export const dayBookings = (page: Page) => page.getByRole('region', { name: /^Брони на/ });
