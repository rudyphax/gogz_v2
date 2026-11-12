import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SessionDto } from '@gogz/shared';
import { server } from '../../test/server';
import { renderAt } from '../../test/render';
import { initialRows, rowsToSets, SessionPage } from './SessionPage';

const SESSION: SessionDto = {
  id: 's1',
  planDayId: 'd1',
  planDayName: 'Upper A',
  startedAt: '2026-11-10T12:00:00Z',
  completedAt: null,
  exercises: [
    {
      id: 'x1',
      exerciseSlug: 'bench-press',
      exerciseName: 'Bench Press',
      sets: 2,
      repMin: 8,
      repMax: 12,
      lastSets: [
        { reps: 12, weight: 135 },
        { reps: 12, weight: 135 },
      ],
      suggestion: { weight: 140, reps: 8, reason: 'Hit 12 reps on every set: add weight' },
    },
    {
      id: 'x2',
      exerciseSlug: 'pull-up',
      exerciseName: 'Pull-up',
      sets: 1,
      repMin: 8,
      repMax: 12,
      lastSets: [],
      suggestion: null,
    },
  ],
  sets: [],
};

describe('session helpers', () => {
  it('pre-fills planned sets with the suggested weight', () => {
    expect(initialRows(SESSION)).toEqual({
      'bench-press': [
        { weight: '140', reps: '' },
        { weight: '140', reps: '' },
      ],
      'pull-up': [{ weight: '', reps: '' }],
    });
  });

  it('restores saved sets', () => {
    const rows = initialRows({
      ...SESSION,
      sets: [{ exerciseSlug: 'bench-press', setNumber: 1, reps: 9, weight: 140 }],
    });
    expect(rows['bench-press']).toEqual([{ weight: '140', reps: '9' }]);
  });

  it('only saves sets with reps and renumbers them', () => {
    expect(
      rowsToSets({
        'bench-press': [
          { weight: '140', reps: '' },
          { weight: '140', reps: '8' },
        ],
        'pull-up': [{ weight: '', reps: '10' }],
      }),
    ).toEqual([
      { exerciseSlug: 'bench-press', setNumber: 1, reps: 8, weight: 140 },
      { exerciseSlug: 'pull-up', setNumber: 1, reps: 10, weight: 0 },
    ]);
  });
});

describe('SessionPage', () => {
  it('shows last time and the suggestion, then saves and finishes', async () => {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    server.use(
      http.get('/api/gym/sessions/s1', () => HttpResponse.json(SESSION)),
      http.put('/api/gym/sessions/s1/sets', async ({ request }) => {
        calls.push({ method: 'PUT', url: request.url, body: await request.json() });
        return HttpResponse.json(SESSION);
      }),
      http.post('/api/gym/sessions/s1/complete', () => {
        calls.push({ method: 'POST', url: 'complete' });
        return HttpResponse.json({ ...SESSION, completedAt: '2026-11-10T13:00:00Z' });
      }),
    );
    const user = userEvent.setup();
    renderAt(<SessionPage />, {
      path: '/gym/sessions/s1',
      route: '/gym/sessions/:id',
      extra: { '/gym': <p>Gym home</p> },
    });

    expect(await screen.findByText('Last time: 135×12, 135×12')).toBeInTheDocument();
    expect(screen.getByText(/Today: 140 lb × 8/)).toBeInTheDocument();
    expect(screen.getByText(/first time/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Bench Press set 1 reps'), '9');
    await user.click(screen.getByRole('button', { name: 'Save progress' }));
    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '+ Add set' })[1]!);
    await user.type(screen.getByLabelText('Pull-up set 2 reps'), '7');
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText('Gym home')).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)).toEqual({ method: 'POST', url: 'complete' }));
    expect(calls[1]!.body).toEqual({
      sets: [
        { exerciseSlug: 'bench-press', setNumber: 1, reps: 9, weight: 140 },
        { exerciseSlug: 'pull-up', setNumber: 1, reps: 7, weight: 0 },
      ],
    });
  });

  it('is read-only once completed', async () => {
    server.use(
      http.get('/api/gym/sessions/s1', () =>
        HttpResponse.json({ ...SESSION, completedAt: '2026-11-10T13:00:00Z' }),
      ),
    );
    renderAt(<SessionPage />, { path: '/gym/sessions/s1', route: '/gym/sessions/:id' });
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Bench Press set 1 reps')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
  });
});
