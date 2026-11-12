import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ChallengeDto } from '@gogz/shared';
import { server } from '../../test/server';
import { ME, renderAt } from '../../test/render';
import { ChallengeDetailPage } from './ChallengeDetailPage';

const BOB = { id: '22222222-2222-4222-8222-222222222222', displayName: 'Bob', avatarUrl: null };

function setup(state: Partial<ChallengeDto>) {
  let current: ChallengeDto = {
    id: 'c1',
    status: 'pending',
    prize: 'Loser buys lunch',
    challenger: BOB,
    opponent: { id: ME.id, displayName: 'Rudy', avatarUrl: null },
    turnUserId: ME.id,
    winnerId: null,
    availableActions: ['accept', 'counter', 'decline'],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    events: [
      {
        id: 'e1',
        actorId: BOB.id,
        actorName: 'Bob',
        type: 'create',
        prize: 'Loser buys lunch',
        createdAt: '2026-11-01T00:00:00Z',
      },
    ],
    ...state,
  };
  const actions: unknown[] = [];
  server.use(
    http.get('/api/me', () => HttpResponse.json(ME)),
    http.get('/api/golf/challenges/c1', () => HttpResponse.json(current)),
    http.post('/api/golf/challenges/c1/actions', async ({ request }) => {
      const body = (await request.json()) as { type: string; prize?: string };
      actions.push(body);
      if (body.type === 'counter') {
        current = {
          ...current,
          status: 'countered',
          prize: body.prize!,
          turnUserId: BOB.id,
          availableActions: ['cancel'],
        };
      }
      return HttpResponse.json(current);
    }),
  );
  renderAt(<ChallengeDetailPage />, { path: '/golf/challenges/c1', route: '/golf/challenges/:id' });
  return actions;
}

describe('ChallengeDetailPage', () => {
  it('lets the recipient counter with a new prize', async () => {
    const actions = setup({});
    const user = userEvent.setup();
    expect(await screen.findByTestId('prize')).toHaveTextContent('Loser buys lunch');
    expect(screen.getAllByText('Bob')).toHaveLength(2); // VS header + timeline
    expect(screen.getByText(/sent the challenge/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Counteroffer' }));
    const input = screen.getByLabelText('Your counteroffer');
    expect(input).toHaveValue('Loser buys lunch');
    await user.clear(input);
    await user.type(input, 'Loser buys dinner');
    await user.click(screen.getByRole('button', { name: 'Send counteroffer' }));

    await waitFor(() => expect(actions).toEqual([{ type: 'counter', prize: 'Loser buys dinner' }]));
    expect(await screen.findByTestId('prize')).toHaveTextContent('Loser buys dinner');
    expect(await screen.findByRole('button', { name: 'Withdraw challenge' })).toBeInTheDocument();
  });

  it('accepts and declines', async () => {
    const actions = setup({});
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Accept' }));
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(actions).toEqual([{ type: 'accept' }, { type: 'decline' }]));
  });

  it('reports results for accepted matches', async () => {
    const actions = setup({ status: 'accepted', turnUserId: null, availableActions: ['report'] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Bob won' }));
    await user.click(screen.getByRole('button', { name: 'I won' }));
    await waitFor(() =>
      expect(actions).toEqual([
        { type: 'report', winnerId: BOB.id },
        { type: 'report', winnerId: ME.id },
      ]),
    );
  });

  it('confirms or disputes a reported result', async () => {
    const actions = setup({
      status: 'result_reported',
      winnerId: BOB.id,
      availableActions: ['confirm', 'dispute'],
    });
    const user = userEvent.setup();
    expect(await screen.findByText('Reported winner: Bob')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dispute' }));
    await user.click(screen.getByRole('button', { name: 'Confirm result' }));
    await waitFor(() => expect(actions).toEqual([{ type: 'dispute' }, { type: 'confirm' }]));
  });

  it('shows the winner when completed', async () => {
    setup({ status: 'completed', winnerId: ME.id, turnUserId: null, availableActions: [] });
    expect(await screen.findByText('🏆 You won!')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
