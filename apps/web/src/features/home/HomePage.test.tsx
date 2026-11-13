import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ChallengeDto, Friend } from '@gogz/shared';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { HomePage } from './HomePage';

const BOB: Friend = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Bob',
  firstName: 'Bob',
  lastName: 'Jones',
  avatarUrl: null,
  record: { wins: 3, losses: 1 },
};

const LIVE: ChallengeDto = {
  id: 'c1',
  status: 'accepted',
  prize: 'Loser buys lunch',
  challenger: { id: BOB.id, displayName: 'Bob', avatarUrl: null },
  opponent: { id: ME.id, displayName: 'Rudy', avatarUrl: null },
  turnUserId: null,
  winnerId: null,
  availableActions: ['report'],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function mockApi({ challenges = [LIVE], role = ME.role } = {}) {
  server.use(
    http.get('/api/me', () => HttpResponse.json({ ...ME, role })),
    http.get('/api/golf/friends', () => HttpResponse.json([BOB])),
    http.get('/api/golf/challenges', () => HttpResponse.json(challenges)),
    http.get('/api/gym/sessions', () =>
      HttpResponse.json([
        {
          id: 's1',
          planDayName: 'Upper A',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          setCount: 14,
        },
      ]),
    ),
    http.get('/api/gym/plans', () =>
      HttpResponse.json([{ id: 'p', isActive: true, daysPerWeek: 4, days: [] }]),
    ),
  );
}

describe('HomePage', () => {
  it('greets you and offers the quick actions', async () => {
    mockApi();
    const user = userEvent.setup();
    renderAt(<HomePage />);
    expect(await screen.findByRole('heading', { name: /^Good \w+, Rudy!$/ })).toBeInTheDocument();
    const actions = screen.getByRole('group', { name: 'Quick actions' });
    expect(within(actions).getByRole('link', { name: 'New Challenge' })).toHaveAttribute(
      'href',
      '/golf',
    );
    expect(within(actions).getByRole('link', { name: 'Log Workout' })).toHaveAttribute(
      'href',
      '/gym',
    );
    await user.click(within(actions).getByRole('button', { name: 'Log Golf Round' }));
    expect(screen.getByRole('status')).toHaveTextContent('coming soon');
  });

  it('shows the featured challenge, stats and the crew', async () => {
    mockApi();
    renderAt(<HomePage />);
    const challenge = await screen.findByRole('region', { name: 'Golf challenge' });
    expect(await within(challenge).findByText('Loser buys lunch')).toBeInTheDocument();
    expect(within(challenge).getByRole('link', { name: /View Challenge/ })).toHaveAttribute(
      'href',
      '/golf/challenges/c1',
    );

    const golf = screen.getByRole('region', { name: 'Golf stats' });
    expect(await within(golf).findByText('3–1')).toBeInTheDocument();
    const gym = screen.getByRole('region', { name: 'Gym stats' });
    expect(await within(gym).findByText('1/4')).toBeInTheDocument();
    expect(within(gym).getByText('14')).toBeInTheDocument();

    const crew = screen.getByRole('complementary', { name: 'The crew' });
    expect(within(crew).getByText('2 members')).toBeInTheDocument();
    expect(within(crew).getByRole('list', { name: 'Crew members' })).toHaveTextContent('B');
    expect(within(crew).queryByRole('link', { name: 'Invite a member' })).not.toBeInTheDocument();
    expect(within(crew).getAllByText('Bob').length).toBeGreaterThan(0);
    expect(within(crew).getByRole('link', { name: /View All Activity/ })).toBeInTheDocument();
  });

  it('prompts a new challenge when none are open, and lets admins invite', async () => {
    mockApi({ challenges: [], role: 'admin' });
    renderAt(<HomePage />);
    expect(await screen.findByText('Nothing on the line')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Invite a member' })).toHaveAttribute(
      'href',
      '/admin/members',
    );
  });
});
