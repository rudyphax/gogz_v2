import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { LoginPage, safeNext } from './LoginPage';

function mockApi({ google = true } = {}) {
  let me: typeof ME | null = null;
  server.use(
    http.get('/api/me', () =>
      me ? HttpResponse.json(me) : HttpResponse.json({ error: 'Not signed in' }, { status: 401 }),
    ),
    http.get('/api/auth/providers', () => HttpResponse.json({ google })),
    http.post('/api/auth/demo', () => {
      me = { ...ME, role: 'demo' };
      return HttpResponse.json(me);
    }),
    http.post('/api/auth/login', async ({ request }) => {
      const body = (await request.json()) as { password: string };
      if (body.password !== 'right-password')
        return HttpResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
      me = ME;
      return HttpResponse.json(me);
    }),
  );
}

const renderLogin = (path = '/login') =>
  renderAt(<LoginPage />, {
    path,
    route: '/login',
    extra: { '/golf': <p>Golf home</p>, '/golf/challenges/:id': <p>Challenge page</p> },
  });

describe('safeNext', () => {
  it.each([
    [null, '/golf'],
    ['/gym', '/gym'],
    ['//evil.com', '/golf'],
    ['https://evil.com', '/golf'],
    ['/\\evil.com', '/golf'],
  ])('%s → %s', (input, expected) => expect(safeNext(input)).toBe(expected));
});

describe('LoginPage', () => {
  it('links Google sign-in with the return path', async () => {
    mockApi();
    renderLogin('/login?next=%2Fgolf%2Fchallenges%2Fc1');
    const link = await screen.findByRole('link', { name: /Continue with Google/ });
    await waitFor(() =>
      expect(link).toHaveAttribute('href', '/api/auth/google?next=%2Fgolf%2Fchallenges%2Fc1'),
    );
  });

  it('explains when Google is not configured', async () => {
    mockApi({ google: false });
    renderLogin();
    expect(await screen.findByText(/isn't configured/)).toBeInTheDocument();
  });

  it('explains a not-invited rejection', async () => {
    mockApi();
    renderLogin('/login?error=not_invited');
    expect(await screen.findByRole('alert')).toHaveTextContent("isn't on the invite list");
  });

  it('signs in with a password and returns to the requested page', async () => {
    mockApi();
    const user = userEvent.setup();
    renderLogin('/login?next=%2Fgolf%2Fchallenges%2Fc1');
    await user.type(await screen.findByLabelText('Email'), 'me@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'right-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Challenge page')).toBeInTheDocument();
  });

  it('logs into the demo account', async () => {
    mockApi();
    const user = userEvent.setup();
    renderLogin();
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    expect(await screen.findByText('Golf home')).toBeInTheDocument();
  });
});
