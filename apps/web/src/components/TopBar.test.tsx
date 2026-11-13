import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ChallengeDto } from '@gogz/shared';
import { server } from '../test/server';
import { ME, renderAt } from '../test/render';
import { TopBar } from './TopBar';

const YOUR_MOVE: ChallengeDto = {
  id: 'c1',
  status: 'pending',
  prize: 'Loser buys lunch',
  challenger: { id: 'bob', displayName: 'Bob', avatarUrl: null },
  opponent: { id: ME.id, displayName: 'Rudy', avatarUrl: null },
  turnUserId: ME.id,
  winnerId: null,
  availableActions: ['accept'],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function setup(challenges: ChallengeDto[]) {
  server.use(http.get('/api/golf/challenges', () => HttpResponse.json(challenges)));
  renderAt(<TopBar me={ME} />, { extra: { '/profile': <p>Profile page</p> } });
  return userEvent.setup();
}

describe('TopBar', () => {
  it('lists challenges waiting on you under notifications', async () => {
    const user = setup([YOUR_MOVE]);
    await user.click(await screen.findByRole('button', { name: 'Notifications (1 need you)' }));
    expect(screen.getByRole('link', { name: /Bob: Respond/ })).toHaveAttribute(
      'href',
      '/golf/challenges/c1',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: /Bob/ })).not.toBeInTheDocument();
  });

  it('says when you are caught up, and shows the search placeholder', async () => {
    const user = setup([]);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByPlaceholderText(/coming soon/)).toBeDisabled();
    expect(screen.queryByText("You're all caught up.")).not.toBeInTheDocument();
  });

  it('opens the account menu and goes to profile settings', async () => {
    const user = setup([]);
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toHaveTextContent(ME.email);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Profile settings' }));
    expect(await screen.findByText('Profile page')).toBeInTheDocument();
  });
});
