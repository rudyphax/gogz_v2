import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import type { AllowedEmailDto } from '@gogz/shared';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { MembersPage } from './MembersPage';

it('invites and removes members', async () => {
  let list: AllowedEmailDto[] = [
    { email: ME.email, role: 'admin', createdAt: '2026-11-01T00:00:00Z', registered: true },
    {
      email: 'bud@example.com',
      role: 'member',
      createdAt: '2026-11-01T00:00:00Z',
      registered: false,
    },
  ];
  server.use(
    http.get('/api/me', () => HttpResponse.json({ ...ME, role: 'admin' })),
    http.get('/api/admin/allowed-emails', () => HttpResponse.json(list)),
    http.post('/api/admin/allowed-emails', async ({ request }) => {
      const { email } = (await request.json()) as { email: string };
      list = [
        ...list,
        { email, role: 'member', createdAt: '2026-11-02T00:00:00Z', registered: false },
      ];
      return HttpResponse.json({}, { status: 201 });
    }),
    http.delete('/api/admin/allowed-emails/:email', ({ params }) => {
      list = list.filter((m) => m.email !== params.email);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  renderAt(<MembersPage />);

  const members = await screen.findByRole('list', { name: 'Invited emails' });
  expect(within(members).getByText('Admin')).toBeInTheDocument();
  expect(within(members).getByText('Joined')).toBeInTheDocument();
  // You can't remove yourself.
  await waitFor(() =>
    expect(within(members).getAllByRole('button', { name: 'Remove' })).toHaveLength(1),
  );

  await user.type(screen.getByLabelText('Invite by Gmail address'), 'new@example.com');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(await within(members).findByText('new@example.com')).toBeInTheDocument();
  expect(screen.getByLabelText('Invite by Gmail address')).toHaveValue('');

  await user.click(within(members).getAllByRole('button', { name: 'Remove' })[0]!);
  await waitFor(() =>
    expect(within(members).queryByText('bud@example.com')).not.toBeInTheDocument(),
  );
});
