import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { PlanDto, SessionDto } from '@gogz/shared';
import { server } from '../../test/server';
import { renderAt } from '../../test/render';
import { GymPage } from './GymPage';
import { NewPlanPage } from './NewPlanPage';
import { ProgressPage } from './ProgressPage';

const plan = (over: Partial<PlanDto> = {}): PlanDto => ({
  id: 'p1',
  name: 'Golf performance · Full Body',
  goal: 'golf',
  daysPerWeek: 2,
  equipment: ['dumbbell'],
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
  days: [
    {
      id: 'd1',
      dayIndex: 0,
      name: 'Full Body A',
      exercises: [
        {
          id: 'x1',
          exerciseSlug: 'goblet-squat',
          exerciseName: 'Goblet Squat',
          sets: 3,
          repMin: 6,
          repMax: 10,
        },
      ],
    },
  ],
  ...over,
});

describe('GymPage', () => {
  it('prompts to build a plan when there is none', async () => {
    server.use(
      http.get('/api/gym/plans', () => HttpResponse.json([])),
      http.get('/api/gym/sessions', () => HttpResponse.json([])),
    );
    renderAt(<GymPage />);
    expect(await screen.findByRole('link', { name: 'Build one from your goals' })).toHaveAttribute(
      'href',
      '/gym/plans/new',
    );
    expect(screen.getByText(/logged workouts will show up/)).toBeInTheDocument();
  });

  it('shows the active plan, history and other plans, and starts a workout', async () => {
    const calls: string[] = [];
    server.use(
      http.get('/api/gym/plans', () =>
        HttpResponse.json([plan(), plan({ id: 'p2', name: 'Old plan', isActive: false })]),
      ),
      http.get('/api/gym/sessions', () =>
        HttpResponse.json([
          {
            id: 's0',
            planDayName: 'Full Body A',
            startedAt: '2026-11-09T12:00:00Z',
            completedAt: null,
            setCount: 3,
          },
        ]),
      ),
      http.post('/api/gym/sessions', async ({ request }) => {
        calls.push(JSON.stringify(await request.json()));
        return HttpResponse.json({ id: 's1' } as SessionDto, { status: 201 });
      }),
      http.post('/api/gym/plans/p2/activate', () => {
        calls.push('activate');
        return HttpResponse.json(plan({ id: 'p2' }));
      }),
      http.delete('/api/gym/plans/p2', () => {
        calls.push('delete');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt(<GymPage />, { extra: { '/gym/sessions/:id': <p>Session page</p> } });

    expect(
      await screen.findByRole('heading', { name: 'Golf performance · Full Body' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3×6–10')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make active' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Start Full Body A' }));
    expect(await screen.findByText('Session page')).toBeInTheDocument();
    expect(calls).toEqual(['activate', 'delete', '{"planDayId":"d1"}']);
  });

  it('shows load errors', async () => {
    server.use(
      http.get('/api/gym/plans', () => HttpResponse.json({ error: 'DB down' }, { status: 500 })),
      http.get('/api/gym/sessions', () => HttpResponse.json([])),
    );
    renderAt(<GymPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('DB down');
  });
});

describe('NewPlanPage', () => {
  it('submits goal, days and equipment', async () => {
    let body: unknown;
    server.use(
      http.post('/api/gym/plans', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(plan(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAt(<NewPlanPage />, { extra: { '/gym': <p>Gym home</p> } });
    await user.click(screen.getByText('Golf performance'));
    await user.click(screen.getByText('5'));
    await user.click(screen.getByLabelText('Barbell'));
    await user.click(screen.getByLabelText('Resistance bands'));
    await user.type(screen.getByLabelText('Plan name (optional)'), 'Off-season');
    await user.click(screen.getByRole('button', { name: 'Generate plan' }));
    expect(await screen.findByText('Gym home')).toBeInTheDocument();
    expect(body).toEqual({
      goal: 'golf',
      daysPerWeek: 5,
      equipment: ['dumbbell', 'bands'],
      name: 'Off-season',
    });
  });

  it('requires at least one equipment option and can cancel', async () => {
    const user = userEvent.setup();
    renderAt(<NewPlanPage />, { extra: { '/gym': <p>Gym home</p> } });
    await user.click(screen.getByLabelText('Barbell'));
    await user.click(screen.getByLabelText('Dumbbells'));
    expect(screen.getByRole('button', { name: 'Generate plan' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Gym home')).toBeInTheDocument();
  });

  it('shows server errors', async () => {
    server.use(
      http.post('/api/gym/plans', () => HttpResponse.json({ error: 'Bad plan' }, { status: 400 })),
    );
    const user = userEvent.setup();
    renderAt(<NewPlanPage />);
    await user.click(screen.getByRole('button', { name: 'Generate plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad plan');
  });
});

describe('ProgressPage', () => {
  it('asks you to log a workout first', async () => {
    server.use(http.get('/api/gym/progress', () => HttpResponse.json([])));
    renderAt(<ProgressPage />);
    expect(await screen.findByText(/Log a workout/)).toBeInTheDocument();
  });

  it('lists best sets for the chosen exercise', async () => {
    server.use(
      http.get('/api/gym/progress', () =>
        HttpResponse.json([
          { exerciseSlug: 'bench-press', exerciseName: 'Bench Press' },
          { exerciseSlug: 'push-up', exerciseName: 'Push-up' },
        ]),
      ),
      http.get('/api/gym/progress/bench-press', () =>
        HttpResponse.json({
          exerciseName: 'Bench Press',
          points: [
            { sessionId: 's1', date: '2026-11-01T12:00:00Z', weight: 135, reps: 10, e1rm: 180 },
          ],
        }),
      ),
      http.get('/api/gym/progress/push-up', () =>
        HttpResponse.json({
          exerciseName: 'Push-up',
          points: [{ sessionId: 's2', date: '2026-11-02T12:00:00Z', weight: 0, reps: 20, e1rm: 0 }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderAt(<ProgressPage />);
    expect(await screen.findByText('135 lb × 10')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bench Press progress chart' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Exercise'), 'push-up');
    expect(await screen.findByText('20 reps')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
