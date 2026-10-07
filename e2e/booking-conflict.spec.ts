import { expect, test } from '@playwright/test';

import { bookingDialog, confirmTime, createFromGap, futureDate, openView, submit } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('a real race: the second user gets 409 and keeps their input', async ({ browser, contextOptions }, testInfo) => {
  const date = futureDate(11);
  // Two isolated users with the current project's device settings (desktop or mobile).
  const options = { ...contextOptions, ...testInfo.project.use, baseURL: testInfo.project.use.baseURL };
  const alice = await (await browser.newContext(options)).newPage();
  const bob = await (await browser.newContext(options)).newPage();

  // Both see 09:00 as free and reach the confirmation step.
  for (const page of [alice, bob]) {
    await openView(page, 'day', date);
    await createFromGap(page, 'Забронировать 09:00–18:00');
    await confirmTime(page);
  }
  await bookingDialog(bob).getByLabel(/Название/).fill('Встреча Боба');

  await submit(alice, 'Забронировать');
  await expect(bookingDialog(alice)).toHaveCount(0);

  // Bob's UI still believes the slot is free; the server says otherwise.
  await submit(bob, 'Забронировать');
  const alert = bookingDialog(bob).getByRole('alert').filter({ hasText: 'Это время только что заняли' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('09:00–10:00');

  // One click to the nearest free slot; the title Bob typed is still there.
  await alert.getByRole('button', { name: /Взять 10:00–11:00/ }).click();
  await expect(bookingDialog(bob).getByLabel(/Название/)).toHaveValue('Встреча Боба');
  await submit(bob, 'Забронировать');
  await expect(bookingDialog(bob)).toHaveCount(0);
  await expect(bob.getByRole('button', { name: '10:00–11:00, Встреча Боба' })).toBeVisible();
  // …and the schedule behind it now shows Alice's booking too.
  await expect(bob.getByRole('button', { name: /^09:00–10:00, Без названия/ })).toBeVisible();
});
