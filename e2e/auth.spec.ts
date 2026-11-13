import { AL, expect, signIn, test } from './fixtures';

test('people not on the invite list cannot get in', async ({ page }) => {
  const res = await page.request.post('/api/test/google-login', {
    data: { email: 'stranger@e2e.test' },
  });
  expect(res.status()).toBe(403);

  await page.goto('/golf');
  await expect(page).toHaveURL(/\/login\?next=%2Fgolf/);

  await page.goto('/login?error=not_invited');
  await expect(page.getByRole('alert')).toContainText("isn't on the invite list");
});

test('invited friends land on Home and can log out', async ({ page }) => {
  await signIn(page, AL, 'Al');
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Al!$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Gym' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/gym');
  await expect(page).toHaveURL(/\/login/);
});

test('employers can try the demo with sample data @mobile', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText("You're exploring the demo account")).toBeVisible();
  await expect(page.getByRole('list', { name: 'Crew members' }).getByRole('listitem')).toHaveCount(
    4,
  );
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Golf' }).click();
  const friends = page.getByRole('list', { name: 'Friends' });
  await expect(friends.getByRole('listitem')).toHaveCount(4);
  await expect(friends).toContainText('Jordan');

  await page.getByRole('link', { name: 'Gym' }).click();
  await expect(page.getByText('Golf performance', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profile settings' }).click();
  await expect(page.getByText('turned off for the demo account')).toBeVisible();
});

test('a password can be set and used to sign in', async ({ page }) => {
  await signIn(page, AL, 'Al');
  await page.goto('/profile');
  await page.getByLabel('New password').fill('al-likes-birdies');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByText('Password saved')).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.getByLabel('Email').fill(AL);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
  await page.getByLabel('Password').fill('al-likes-birdies');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Al!$/ })).toBeVisible();
});

test('the admin can invite a new friend', async ({ page }) => {
  await signIn(page, 'admin@e2e.test', 'Admin');
  await page.goto('/golf');
  await page.getByRole('link', { name: 'Members' }).click();
  await page.getByLabel('Invite by Gmail address').fill('newguy@e2e.test');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list', { name: 'Invited emails' })).toContainText('newguy@e2e.test');

  const res = await page.request.post('/api/test/google-login', {
    data: { email: 'newguy@e2e.test' },
  });
  expect(res.ok()).toBeTruthy();
});
