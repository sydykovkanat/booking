import { expect, test } from '@playwright/test';

import { futureDate, openDay, submitButton, timeField } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('a real race: the second user gets 409 and keeps their input', async ({ browser, contextOptions }, testInfo) => {
  const date = futureDate(11);
  // Two isolated users with the current project's device settings (desktop or mobile).
  const options = { ...contextOptions, ...testInfo.project.use, baseURL: testInfo.project.use.baseURL };
  const alice = await (await browser.newContext(options)).newPage();
  const bob = await (await browser.newContext(options)).newPage();

  // Both users see the same free slot and open the form for it.
  for (const page of [alice, bob]) {
    await openDay(page, date);
    await page.getByRole('button', { name: 'Забронировать 09:00–18:00' }).click();
  }
  await bob.getByLabel(/Название/).fill('Встреча Боба');

  await submitButton(alice, 'Забронировать').click();
  await expect(alice.getByText('Забронировано: 09:00–10:00')).toBeVisible();

  // Bob's UI still believes the slot is free; the server says otherwise.
  await submitButton(bob, 'Забронировать').click();
  const alert = bob.getByRole('alert').filter({ hasText: 'Это время только что заняли' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('09:00–10:00');

  // Nothing typed is lost, and the schedule behind the form is refreshed.
  await expect(bob.getByLabel(/Название/)).toHaveValue('Встреча Боба');
  await expect(timeField(bob, 'Начало')).toContainText('09:00');

  // One click to the nearest free slot, then it saves.
  await alert.getByRole('button', { name: /Подставить 10:00–11:00/ }).click();
  await submitButton(bob, 'Забронировать').click();
  await expect(bob.getByText('Забронировано: 10:00–11:00')).toBeVisible();
  await expect(bob.getByRole('list', { name: 'Расписание на день' }).getByText('Встреча Боба')).toBeVisible();
});
