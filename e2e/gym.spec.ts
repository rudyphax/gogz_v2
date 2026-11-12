import { AL, expect, signIn, test } from './fixtures';

test('build a plan, log a workout, and see it next time @mobile', async ({ page }) => {
  await signIn(page, AL, 'Al');
  await page.goto('/gym');
  await page.getByRole('link', { name: 'Build one from your goals' }).click();

  await page.getByText('Muscle growth').click();
  await page.getByText('4', { exact: true }).click();
  await page.getByLabel('Cable machine').check();
  await page.getByRole('button', { name: 'Generate plan' }).click();

  await expect(page.getByRole('heading', { name: /Muscle growth · Upper\/Lower/ })).toBeVisible();
  await page.getByRole('button', { name: 'Start Upper A' }).click();

  await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
  await expect(page.getByText(/Last time: first time/).first()).toBeVisible();
  for (const set of [1, 2, 3, 4]) {
    await page.getByLabel(`Bench Press set ${set} weight`).fill('135');
    await page.getByLabel(`Bench Press set ${set} reps`).fill('12');
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('heading', { name: 'Gym' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent workouts' })).toContainText('4 sets');

  // Next Upper A: last time's numbers and a progression suggestion.
  await page.getByRole('button', { name: 'Start Upper A' }).click();
  await expect(page.getByText('Last time: 135×12, 135×12, 135×12, 135×12')).toBeVisible();
  await expect(page.getByText(/Today: 140 lb × 8/)).toBeVisible();
  await expect(page.getByLabel('Bench Press set 1 weight')).toHaveValue('140');

  await page.goto('/gym/progress');
  await expect(page.getByLabel('Exercise')).toHaveValue('bench-press');
  await expect(page.getByRole('img', { name: 'Bench Press progress chart' })).toBeVisible();
});
