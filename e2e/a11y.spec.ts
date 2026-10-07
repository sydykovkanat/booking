import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { bookingDialog, createFromGap, futureDate, openView } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

/** Serious and critical WCAG 2.1 A/AA violations only; moderate issues are reported, not failed on. */
async function expectNoSeriousViolations(page: Page) {
  // Measure the settled UI: mid-animation opacity blends colours and gives false contrast failures.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(' ')}`),
  ).toEqual([]);
}

for (const view of ['month', 'week', 'day'] as const) {
  test(`${view} view has no serious accessibility violations`, async ({ page }) => {
    await openView(page, view, futureDate(0));
    await expectNoSeriousViolations(page);
  });
}

test('the open booking form has no serious accessibility violations', async ({ page }) => {
  await openView(page, 'day', futureDate(10));
  await createFromGap(page, 'Забронировать 09:00–18:00');
  await expect(bookingDialog(page)).toBeVisible();
  await expectNoSeriousViolations(page);
});
