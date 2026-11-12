import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';
import type { Me } from '@gogz/shared';

export const ME: Me = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'me@example.com',
  firstName: 'Rudy',
  lastName: 'P',
  displayName: 'Rudy',
  phone: null,
  smsOptIn: false,
  avatarUrl: null,
  role: 'member',
  hasPassword: false,
};

/** Renders `ui` at `path`, with optional extra routes to observe navigation. */
export function renderAt(
  ui: ReactNode,
  {
    path = '/',
    route = '/',
    extra = {},
  }: { path?: string; route?: string; extra?: Record<string, ReactNode> } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          {Object.entries(extra).map(([p, el]) => (
            <Route key={p} path={p} element={el} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
