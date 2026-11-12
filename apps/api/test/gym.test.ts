import { describe, expect, it } from 'vitest';
import type { PlanDto, SessionDto } from '@gogz/shared';
import { createUser, makeApp, signedIn, useTestDb } from './helpers.js';

const db = useTestDb();

async function setup() {
  const ctx = makeApp(db);
  const user = await createUser(db);
  const other = await createUser(db);
  return {
    ...ctx,
    me: await signedIn(ctx.app, db, user.id),
    them: await signedIn(ctx.app, db, other.id),
  };
}

const planInput = {
  goal: 'hypertrophy',
  daysPerWeek: 4,
  equipment: ['barbell', 'dumbbell', 'cable'],
};

describe('plans', () => {
  it('generates and stores a plan from goals', async () => {
    const { me } = await setup();
    const { body } = await me.post('/api/gym/plans').send(planInput).expect(201);
    const plan = body as PlanDto;
    expect(plan.isActive).toBe(true);
    expect(plan.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    expect(plan.days[0]!.exercises[0]).toMatchObject({
      exerciseName: 'Bench Press',
      sets: 4,
      repMin: 8,
      repMax: 12,
    });
    expect((await me.get(`/api/gym/plans/${plan.id}`).expect(200)).body).toEqual(plan);
  });

  it('accepts a custom name', async () => {
    const { me } = await setup();
    const { body } = await me
      .post('/api/gym/plans')
      .send({ ...planInput, name: 'Winter bulk' })
      .expect(201);
    expect(body.name).toBe('Winter bulk');
  });

  it('keeps exactly one active plan', async () => {
    const { me } = await setup();
    const first = (await me.post('/api/gym/plans').send(planInput)).body as PlanDto;
    const second = (await me.post('/api/gym/plans').send({ ...planInput, goal: 'golf' }))
      .body as PlanDto;
    let list = (await me.get('/api/gym/plans').expect(200)).body as PlanDto[];
    expect(list.map((p) => [p.id, p.isActive])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);
    await me.post(`/api/gym/plans/${first.id}/activate`).expect(200);
    list = (await me.get('/api/gym/plans')).body;
    expect(list[0]).toMatchObject({ id: first.id, isActive: true });
    expect(list.filter((p) => p.isActive)).toHaveLength(1);
  });

  it('deletes plans but keeps workout history', async () => {
    const { me } = await setup();
    const plan = (await me.post('/api/gym/plans').send(planInput)).body as PlanDto;
    const session = (await me.post('/api/gym/sessions').send({ planDayId: plan.days[0]!.id }))
      .body as SessionDto;
    await me.delete(`/api/gym/plans/${plan.id}`).expect(204);
    await me.get(`/api/gym/plans/${plan.id}`).expect(404);
    const { body } = await me.get(`/api/gym/sessions/${session.id}`).expect(200);
    expect(body).toMatchObject({ planDayId: null, planDayName: 'Upper A', exercises: [] });
  });

  it("can't see or change someone else's plan", async () => {
    const { me, them } = await setup();
    const plan = (await me.post('/api/gym/plans').send(planInput)).body as PlanDto;
    await them.get(`/api/gym/plans/${plan.id}`).expect(404);
    await them.post(`/api/gym/plans/${plan.id}/activate`).expect(404);
    await them.delete(`/api/gym/plans/${plan.id}`).expect(404);
    await them.post('/api/gym/sessions').send({ planDayId: plan.days[0]!.id }).expect(404);
  });

  it('validates input', async () => {
    const { me } = await setup();
    await me
      .post('/api/gym/plans')
      .send({ ...planInput, daysPerWeek: 9 })
      .expect(400);
    await me
      .post('/api/gym/plans')
      .send({ ...planInput, equipment: [] })
      .expect(400);
  });

  it('lists the exercise library', async () => {
    const { me } = await setup();
    const { body } = await me.get('/api/gym/exercises').expect(200);
    expect(body.length).toBeGreaterThan(30);
  });
});

describe('workout logging', () => {
  async function planAndSession() {
    const ctx = await setup();
    const plan = (await ctx.me.post('/api/gym/plans').send(planInput)).body as PlanDto;
    const day = plan.days[0]!;
    const session = (await ctx.me.post('/api/gym/sessions').send({ planDayId: day.id }).expect(201))
      .body as SessionDto;
    return { ...ctx, plan, day, session };
  }

  it('starts a session with the day’s exercises and no history', async () => {
    const { session, day } = await planAndSession();
    expect(session.planDayName).toBe(day.name);
    expect(session.exercises).toHaveLength(day.exercises.length);
    expect(session.exercises[0]).toMatchObject({ lastSets: [], suggestion: null });
    expect(session.completedAt).toBeNull();
  });

  it('logs sets, completes, and suggests progression next time', async () => {
    const { me, day, session } = await planAndSession();
    const bench = day.exercises[0]!.exerciseSlug;
    const sets = [1, 2, 3, 4].map((setNumber) => ({
      exerciseSlug: bench,
      setNumber,
      reps: 12,
      weight: 135,
    }));

    let res = await me.put(`/api/gym/sessions/${session.id}/sets`).send({ sets }).expect(200);
    expect(res.body.sets).toHaveLength(4);
    // Saving again replaces rather than duplicates.
    res = await me
      .put(`/api/gym/sessions/${session.id}/sets`)
      .send({ sets: sets.slice(0, 3) })
      .expect(200);
    expect(res.body.sets).toHaveLength(3);

    res = await me.post(`/api/gym/sessions/${session.id}/complete`).expect(200);
    expect(res.body.completedAt).not.toBeNull();

    const next = (await me.post('/api/gym/sessions').send({ planDayId: day.id }))
      .body as SessionDto;
    expect(next.exercises[0]).toMatchObject({
      lastSets: [
        { reps: 12, weight: 135 },
        { reps: 12, weight: 135 },
        { reps: 12, weight: 135 },
      ],
      suggestion: { weight: 140, reps: 8 },
    });

    const history = (await me.get('/api/gym/sessions').expect(200)).body;
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ id: session.id, setCount: 3 });
  });

  it('only uses completed sessions as history', async () => {
    const { me, day, session } = await planAndSession();
    const bench = day.exercises[0]!.exerciseSlug;
    await me
      .put(`/api/gym/sessions/${session.id}/sets`)
      .send({ sets: [{ exerciseSlug: bench, setNumber: 1, reps: 5, weight: 100 }] });
    const next = (await me.post('/api/gym/sessions').send({ planDayId: day.id }))
      .body as SessionDto;
    expect(next.exercises[0]!.lastSets).toEqual([]);
  });

  it('rejects duplicate sets and bad sessions', async () => {
    const { me, them, session } = await planAndSession();
    const dup = { exerciseSlug: 'bench-press', setNumber: 1, reps: 5, weight: 100 };
    await me
      .put(`/api/gym/sessions/${session.id}/sets`)
      .send({ sets: [dup, dup] })
      .expect(400);
    await me.post('/api/gym/sessions').send({}).expect(400);
    await them.get(`/api/gym/sessions/${session.id}`).expect(404);
    await them.put(`/api/gym/sessions/${session.id}/sets`).send({ sets: [] }).expect(404);
  });

  it('deletes a session', async () => {
    const { me, session } = await planAndSession();
    await me.delete(`/api/gym/sessions/${session.id}`).expect(204);
    await me.get(`/api/gym/sessions/${session.id}`).expect(404);
  });

  it('charts progress per exercise', async () => {
    const { me, day, session } = await planAndSession();
    const bench = day.exercises[0]!.exerciseSlug;
    await me.put(`/api/gym/sessions/${session.id}/sets`).send({
      sets: [
        { exerciseSlug: bench, setNumber: 1, reps: 10, weight: 100 },
        { exerciseSlug: bench, setNumber: 2, reps: 5, weight: 110 },
        { exerciseSlug: 'lat-pulldown', setNumber: 1, reps: 0, weight: 50 },
      ],
    });
    const exercises = (await me.get('/api/gym/progress').expect(200)).body;
    expect(exercises.map((e: { exerciseSlug: string }) => e.exerciseSlug)).toEqual([
      'bench-press',
      'lat-pulldown',
    ]);

    const { body } = await me.get(`/api/gym/progress/${bench}`).expect(200);
    expect(body.exerciseName).toBe('Bench Press');
    expect(body.points).toEqual([
      { sessionId: session.id, date: session.startedAt, weight: 100, reps: 10, e1rm: 133.3 },
    ]);
    expect((await me.get('/api/gym/progress/lat-pulldown')).body.points).toEqual([]);
  });
});
