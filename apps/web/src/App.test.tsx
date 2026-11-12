import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { ME } from './test/render';
import { server } from './test/server';

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const golfApis = [
  http.get('/api/golf/friends', () => HttpResponse.json([])),
  http.get('/api/golf/challenges', () => HttpResponse.json([])),
];

describe('App routing', () => {
  it('sends signed-out visitors to login, remembering where they were going', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json({ error: 'Not signed in' }, { status: 401 })),
      http.get('/api/auth/providers', () => HttpResponse.json({ google: true })),
    );
    renderApp('/golf/challenges/abc');
    const google = await screen.findByRole('link', { name: /Continue with Google/ });
    expect(google.getAttribute('href')).toContain('next=%2Fgolf%2Fchallenges%2Fabc');
  });

  it('shows the menu and keeps members away from admin pages', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json(ME)),
      ...golfApis,
    );
    renderApp('/admin/members');
    expect(await screen.findByRole('heading', { name: 'Golf' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Gym');
    expect(nav).not.toHaveTextContent('Members');
  });

  it('shows admins the Members link and the demo banner for demo users', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json({ ...ME, role: 'admin' })),
      http.get('/api/admin/allowed-emails', () => HttpResponse.json([])),
    );
    renderApp('/admin/members');
    expect(await screen.findByRole('heading', { name: 'Members' })).toBeInTheDocument();
  });

  it('logs out', async () => {
    let signedIn = true;
    server.use(
      http.get('/api/me', () =>
        signedIn
          ? HttpResponse.json({ ...ME, role: 'demo' })
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.post('/api/auth/logout', () => {
        signedIn = false;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('/api/auth/providers', () => HttpResponse.json({ google: false })),
      ...golfApis,
    );
    const user = userEvent.setup();
    renderApp('/nowhere');
    expect(await screen.findByText(/exploring the demo account/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument();
  });
});
