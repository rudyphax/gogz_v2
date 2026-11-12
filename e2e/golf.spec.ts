import { AL, BO, expect, newUserPage, sentTexts, signIn, test } from './fixtures';

test('send → counter → accept → report → confirm, with texts along the way', async ({
  page,
  browser,
}) => {
  // Bo adds a phone number and opts in to texts.
  const bo = await newUserPage(browser, BO, 'Bo');
  await bo.goto('/profile');
  await bo.getByLabel('Mobile number').fill('(555) 010-2000');
  await bo.getByRole('checkbox').check();
  await bo.getByRole('button', { name: 'Save changes' }).click();
  await expect(bo.getByRole('status')).toHaveText('Saved');

  // Al challenges Bo.
  const al = await newUserPage(browser, AL, 'Al');
  await al.goto('/golf');
  await al.getByRole('button', { name: /Bo/ }).click();
  await al.getByLabel("What's on the line?").fill('Loser buys lunch');
  await al.getByRole('button', { name: 'Send challenge' }).click();
  await expect(al.getByRole('status')).toHaveText('Challenge sent to Bo.');

  const [text] = await sentTexts(page);
  expect(text!.to).toBe('+15550102000');
  expect(text!.body).toContain('Al challenged you to a round for "Loser buys lunch"');
  const link = new URL(text!.body.match(/https?:\/\/\S+/)![0]);

  // Bo follows the link from the text and counters.
  await bo.goto(link.pathname);
  await expect(bo.getByTestId('prize')).toHaveText('Loser buys lunch');
  await bo.getByRole('button', { name: 'Counteroffer' }).click();
  await bo.getByLabel('Your counteroffer').fill('Loser buys dinner');
  await bo.getByRole('button', { name: 'Send counteroffer' }).click();
  await expect(bo.getByTestId('prize')).toHaveText('Loser buys dinner');
  await expect(bo.getByRole('button', { name: 'Withdraw challenge' })).toBeVisible();

  // Al sees it's their move, accepts, and reports the win.
  await al.goto('/golf');
  await expect(al.getByText('Your move (1)')).toBeVisible();
  await al.getByRole('link', { name: /Loser buys dinner/ }).click();
  await al.getByRole('button', { name: 'Accept' }).click();
  await al.getByRole('button', { name: 'I won' }).click();
  await expect(al.getByText('Reported winner: You')).toBeVisible();

  // Bo confirms.
  await bo.reload();
  await bo.getByRole('button', { name: 'Confirm result' }).click();
  await expect(bo.getByText('Al won.')).toBeVisible();

  // Records update.
  await al.goto('/golf');
  await expect(
    al.getByRole('list', { name: 'Friends' }).getByLabel('Record 1 wins 0 losses'),
  ).toBeVisible();
  await expect(al.getByText('Won', { exact: true })).toBeVisible();

  // Al has no phone, so only Bo was texted: challenge, accept, report.
  const texts = await sentTexts(page);
  expect(texts.map((t) => t.to)).toEqual(['+15550102000', '+15550102000', '+15550102000']);
});

test('a challenge link opens the challenge after signing in', async ({ page, browser }) => {
  const al = await newUserPage(browser, AL, 'Al');
  const bo = await newUserPage(browser, BO, 'Bo');
  await al.goto('/golf');
  await al.getByRole('button', { name: /Bo/ }).click();
  await al.getByLabel("What's on the line?").fill('$10 closest to the pin');
  await al.getByRole('button', { name: 'Send challenge' }).click();
  await expect(al.getByRole('status')).toBeVisible();

  const [challenge] = (await (await bo.request.get('/api/golf/challenges')).json()) as {
    id: string;
  }[];
  // A logged-out visit (e.g. tapping the link in the text) goes to login with ?next...
  await page.goto(`/golf/challenges/${challenge!.id}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fgolf%2Fchallenges%2F${challenge!.id}`));
  // ...and once signed in, the login page sends them straight to the challenge.
  await signIn(page, BO, 'Bo');
  await page.reload();
  await expect(page.getByTestId('prize')).toHaveText('$10 closest to the pin');
  await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
});
