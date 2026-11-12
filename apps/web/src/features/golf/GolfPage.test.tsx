import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ChallengeDto, Friend } from '@gogz/shared';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { GolfPage } from './GolfPage';

const BOB: Friend = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Bob',
  firstName: 'Bob',
  lastName: 'Jones',
  avatarUrl: null,
  record: { wins: 3, losses: 1 },
};

const challenge = (over: Partial<ChallengeDto>): ChallengeDto => ({
  id: 'c1',
  status: 'pending',
  prize: 'Loser buys lunch',
  challenger: { id: BOB.id, displayName: 'Bob', avatarUrl: null },
  opponent: { id: ME.id, displayName: 'Rudy', avatarUrl: null },
  turnUserId: ME.id,
  winnerId: null,
  availableActions: ['accept', 'counter', 'decline'],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

function mockApi(challenges: ChallengeDto[] = []) {
  const posted: unknown[] = [];
  server.use(
    http.get('/api/me', () => HttpResponse.json(ME)),
    http.get('/api/golf/friends', () => HttpResponse.json([BOB])),
    http.get('/api/golf/challenges', () => HttpResponse.json(challenges)),
    http.post('/api/golf/challenges', async ({ request }) => {
      const body = (await request.json()) as { prize: string };
      posted.push(body);
      if (body.prize === 'fail') return HttpResponse.json({ error: 'Nope' }, { status: 400 });
      return HttpResponse.json(challenge({ prize: body.prize }), { status: 201 });
    }),
  );
  return posted;
}

describe('GolfPage', () => {
  it('lists friends with their record', async () => {
    mockApi();
    renderAt(<GolfPage />);
    const friends = await screen.findByRole('list', { name: 'Friends' });
    expect(within(friends).getByText('Bob')).toBeInTheDocument();
    expect(within(friends).getByLabelText('Record 3 wins 1 losses')).toHaveTextContent('3–1');
    expect(screen.getByText(/No challenges yet/)).toBeInTheDocument();
  });

  it('opens a prize box when a friend is clicked and sends the challenge', async () => {
    const posted = mockApi();
    const user = userEvent.setup();
    renderAt(<GolfPage />);
    await user.click(await screen.findByRole('button', { name: /Bob/ }));
    const send = screen.getByRole('button', { name: 'Send challenge' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("What's on the line?"), '$20 skins');
    await user.click(send);
    await waitFor(() => expect(posted).toEqual([{ opponentId: BOB.id, prize: '$20 skins' }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Challenge sent to Bob.');
    expect(screen.queryByLabelText("What's on the line?")).not.toBeInTheDocument();
  });

  it('shows API errors and lets you cancel', async () => {
    mockApi();
    const user = userEvent.setup();
    renderAt(<GolfPage />);
    await user.click(await screen.findByRole('button', { name: /Bob/ }));
    await user.type(screen.getByLabelText("What's on the line?"), 'fail');
    await user.click(screen.getByRole('button', { name: 'Send challenge' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText("What's on the line?")).not.toBeInTheDocument();
  });

  it('groups challenges by whose move it is', async () => {
    mockApi([
      challenge({ id: 'a' }),
      challenge({ id: 'b', status: 'accepted', turnUserId: null, prize: 'Closest to pin' }),
      challenge({
        id: 'c',
        status: 'completed',
        turnUserId: null,
        winnerId: ME.id,
        prize: 'Breakfast',
      }),
      challenge({
        id: 'd',
        challenger: { id: ME.id, displayName: 'Rudy', avatarUrl: null },
        opponent: { id: BOB.id, displayName: 'Bob', avatarUrl: null },
        turnUserId: BOB.id,
        prize: 'Drinks',
      }),
    ]);
    renderAt(<GolfPage />);
    expect(await screen.findByText('Your move (1)')).toBeInTheDocument();
    expect(screen.getByText('Matches on (1)')).toBeInTheDocument();
    expect(screen.getByText('Waiting on them (1)')).toBeInTheDocument();
    expect(screen.getByText('History (1)')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(screen.getByText('You → Bob')).toBeInTheDocument();
  });
});
