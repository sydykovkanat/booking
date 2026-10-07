import { expect, test } from '@playwright/test';

import { futureDate, openDay, pickSlot } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('a real race: the second user gets 409 and keeps their input', async ({ browser, contextOptions }, testInfo) => {
  const date = futureDate(11);
  // Two isolated users with the current project's device settings (desktop or mobile).
  const options = { ...contextOptions, ...testInfo.project.use, baseURL: testInfo.project.use.baseURL };
  const alice = await (await browser.newContext(options)).newPage();
  const bob = await (await browser.newContext(options)).newPage();

  // Both see 09:00 as free and get to the confirmation step.
  for (const page of [alice, bob]) {
    await openDay(page, date);
    await pickSlot(page, '09:00');
  }
  await bob.getByLabel(/Название/).fill('Встреча Боба');

  await alice.getByRole('button', { name: 'Забронировать', exact: true }).click();
  await expect(alice.getByRole('heading', { name: 'Готово, переговорка ваша' })).toBeVisible();

  // Bob's UI still believes the slot is free; the server says otherwise.
  await bob.getByRole('button', { name: 'Забронировать', exact: true }).click();
  const alert = bob.getByRole('alert').filter({ hasText: 'Это время только что заняли' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('09:00–10:00');
  // The refreshed schedule shows Alice's booking.
  await expect(bob.getByRole('list', { name: 'Время начала' }).getByText('09:00–10:00')).toBeVisible();

  // One click to the nearest free slot; the title Bob typed is still there.
  await alert.getByRole('button', { name: /Взять 10:00–11:00/ }).click();
  await expect(bob.getByLabel(/Название/)).toHaveValue('Встреча Боба');
  await bob.getByRole('button', { name: 'Забронировать', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Готово, переговорка ваша' })).toBeVisible();
});
