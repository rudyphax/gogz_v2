import { and, asc, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { Router } from 'express';
import {
  bestSet,
  createPlanSchema,
  EXERCISES,
  getExercise,
  ruleBasedGenerator,
  saveSetsSchema,
  suggestNext,
  type Equipment,
  type Goal,
  type PlanDto,
  type ProgressPointDto,
  type SessionDto,
  type SessionSummaryDto,
  type WorkoutGenerator,
} from '@gogz/shared';
import type { AppDeps } from '../app.js';
import type { Db } from '../db/client.js';
import {
  planDayExercises,
  planDays,
  setLogs,
  workoutPlans,
  workoutSessions,
} from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { currentUser } from '../middleware/auth.js';

const exerciseName = (slug: string) => getExercise(slug)?.name ?? slug;

export async function loadPlan(db: Db, userId: string, planId: string): Promise<PlanDto> {
  const [plan] = await db
    .select()
    .from(workoutPlans)
    .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)));
  if (!plan) throw notFound('Plan not found');
  const days = await db
    .select()
    .from(planDays)
    .where(eq(planDays.planId, plan.id))
    .orderBy(asc(planDays.dayIndex));
  const exercises = days.length
    ? await db
        .select()
        .from(planDayExercises)
        .where(
          inArray(
            planDayExercises.planDayId,
            days.map((d) => d.id),
          ),
        )
        .orderBy(asc(planDayExercises.position))
    : [];
  return {
    id: plan.id,
    name: plan.name,
    goal: plan.goal as Goal,
    daysPerWeek: plan.daysPerWeek,
    equipment: plan.equipment as Equipment[],
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    days: days.map((d) => ({
      id: d.id,
      dayIndex: d.dayIndex,
      name: d.name,
      exercises: exercises
        .filter((e) => e.planDayId === d.id)
        .map((e) => ({
          id: e.id,
          exerciseSlug: e.exerciseSlug,
          exerciseName: exerciseName(e.exerciseSlug),
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
        })),
    })),
  };
}

/** Generates a plan, stores it and makes it the user's active plan. */
export async function createPlan(
  db: Db,
  generator: WorkoutGenerator,
  userId: string,
  input: { goal: Goal; daysPerWeek: number; equipment: Equipment[]; name?: string | undefined },
): Promise<string> {
  const generated = await generator.generate(input);
  return db.transaction(async (tx) => {
    await tx.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.userId, userId));
    const [plan] = await tx
      .insert(workoutPlans)
      .values({
        userId,
        name: input.name || generated.name,
        goal: input.goal,
        daysPerWeek: input.daysPerWeek,
        equipment: input.equipment,
        isActive: true,
      })
      .returning();
    for (const [dayIndex, day] of generated.days.entries()) {
      const [row] = await tx
        .insert(planDays)
        .values({ planId: plan!.id, dayIndex, name: day.name })
        .returning();
      if (day.exercises.length) {
        await tx
          .insert(planDayExercises)
          .values(day.exercises.map((e, position) => ({ ...e, position, planDayId: row!.id })));
      }
    }
    return plan!.id;
  });
}

export function gymRoutes({ db, generator = ruleBasedGenerator }: AppDeps) {
  const router = Router();

  async function ownSession(userId: string, id: string) {
    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));
    if (!session) throw notFound('Workout not found');
    return session;
  }

  /** Sets from the most recent completed session (other than this one) for each exercise. */
  async function lastSetsBySlug(userId: string, slugs: string[], excludeSessionId: string) {
    const result = new Map<string, { reps: number; weight: number }[]>();
    if (slugs.length === 0) return result;
    const rows = await db
      .select({
        sessionId: setLogs.sessionId,
        slug: setLogs.exerciseSlug,
        reps: setLogs.reps,
        weight: setLogs.weight,
      })
      .from(setLogs)
      .innerJoin(workoutSessions, eq(workoutSessions.id, setLogs.sessionId))
      .where(
        and(
          eq(workoutSessions.userId, userId),
          ne(workoutSessions.id, excludeSessionId),
          isNotNull(workoutSessions.completedAt),
          inArray(setLogs.exerciseSlug, slugs),
        ),
      )
      .orderBy(desc(workoutSessions.startedAt), asc(setLogs.setNumber));
    const sessionForSlug = new Map<string, string>();
    for (const r of rows) {
      const chosen = sessionForSlug.get(r.slug);
      if (chosen === undefined) sessionForSlug.set(r.slug, r.sessionId);
      else if (chosen !== r.sessionId) continue;
      result.set(r.slug, [...(result.get(r.slug) ?? []), { reps: r.reps, weight: r.weight }]);
    }
    return result;
  }

  async function sessionDto(userId: string, id: string): Promise<SessionDto> {
    const session = await ownSession(userId, id);
    const exercises = session.planDayId
      ? await db
          .select()
          .from(planDayExercises)
          .where(eq(planDayExercises.planDayId, session.planDayId))
          .orderBy(asc(planDayExercises.position))
      : [];
    const sets = await db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, session.id))
      .orderBy(asc(setLogs.exerciseSlug), asc(setLogs.setNumber));
    const last = await lastSetsBySlug(
      userId,
      exercises.map((e) => e.exerciseSlug),
      session.id,
    );
    return {
      id: session.id,
      planDayId: session.planDayId,
      planDayName: session.planDayName,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      exercises: exercises.map((e) => {
        const lastSets = last.get(e.exerciseSlug) ?? [];
        return {
          id: e.id,
          exerciseSlug: e.exerciseSlug,
          exerciseName: exerciseName(e.exerciseSlug),
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          lastSets,
          suggestion: suggestNext(e.exerciseSlug, e, lastSets),
        };
      }),
      sets: sets.map((s) => ({
        exerciseSlug: s.exerciseSlug,
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
      })),
    };
  }

  router.get('/exercises', (_req, res) => {
    res.json(EXERCISES);
  });

  router.get('/plans', async (_req, res) => {
    const me = currentUser(res);
    const plans = await db
      .select({ id: workoutPlans.id })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, me.id))
      .orderBy(desc(workoutPlans.isActive), desc(workoutPlans.createdAt));
    res.json(await Promise.all(plans.map((p) => loadPlan(db, me.id, p.id))));
  });

  router.post('/plans', async (req, res) => {
    const me = currentUser(res);
    const input = createPlanSchema.parse(req.body);
    const id = await createPlan(db, generator, me.id, input);
    res.status(201).json(await loadPlan(db, me.id, id));
  });

  router.get('/plans/:id', async (req, res) => {
    res.json(await loadPlan(db, currentUser(res).id, req.params.id));
  });

  router.post('/plans/:id/activate', async (req, res) => {
    const me = currentUser(res);
    await loadPlan(db, me.id, req.params.id);
    await db.transaction(async (tx) => {
      await tx.update(workoutPlans).set({ isActive: false }).where(eq(workoutPlans.userId, me.id));
      await tx
        .update(workoutPlans)
        .set({ isActive: true })
        .where(eq(workoutPlans.id, req.params.id));
    });
    res.json(await loadPlan(db, me.id, req.params.id));
  });

  router.delete('/plans/:id', async (req, res) => {
    const me = currentUser(res);
    await loadPlan(db, me.id, req.params.id);
    await db.delete(workoutPlans).where(eq(workoutPlans.id, req.params.id));
    res.status(204).end();
  });

  router.get('/sessions', async (_req, res) => {
    const me = currentUser(res);
    const rows = await db
      .select({ s: workoutSessions, setCount: count(setLogs.id) })
      .from(workoutSessions)
      .leftJoin(setLogs, eq(setLogs.sessionId, workoutSessions.id))
      .where(eq(workoutSessions.userId, me.id))
      .groupBy(workoutSessions.id)
      .orderBy(desc(workoutSessions.startedAt))
      .limit(50);
    const body: SessionSummaryDto[] = rows.map(({ s, setCount }) => ({
      id: s.id,
      planDayName: s.planDayName,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      setCount,
    }));
    res.json(body);
  });

  router.post('/sessions', async (req, res) => {
    const me = currentUser(res);
    const planDayId = typeof req.body?.planDayId === 'string' ? req.body.planDayId : null;
    if (!planDayId) throw badRequest('Pick a workout day');
    const [day] = await db
      .select({ id: planDays.id, name: planDays.name })
      .from(planDays)
      .innerJoin(workoutPlans, eq(workoutPlans.id, planDays.planId))
      .where(and(eq(planDays.id, planDayId), eq(workoutPlans.userId, me.id)));
    if (!day) throw notFound('Workout day not found');
    const [session] = await db
      .insert(workoutSessions)
      .values({ userId: me.id, planDayId: day.id, planDayName: day.name })
      .returning();
    res.status(201).json(await sessionDto(me.id, session!.id));
  });

  router.get('/sessions/:id', async (req, res) => {
    res.json(await sessionDto(currentUser(res).id, req.params.id));
  });

  router.put('/sessions/:id/sets', async (req, res) => {
    const me = currentUser(res);
    const session = await ownSession(me.id, req.params.id);
    const { sets } = saveSetsSchema.parse(req.body);
    const keys = new Set(sets.map((s) => `${s.exerciseSlug}#${s.setNumber}`));
    if (keys.size !== sets.length) throw badRequest('Duplicate set numbers');
    await db.transaction(async (tx) => {
      await tx.delete(setLogs).where(eq(setLogs.sessionId, session.id));
      if (sets.length)
        await tx.insert(setLogs).values(sets.map((s) => ({ ...s, sessionId: session.id })));
    });
    res.json(await sessionDto(me.id, session.id));
  });

  router.post('/sessions/:id/complete', async (req, res) => {
    const me = currentUser(res);
    const session = await ownSession(me.id, req.params.id);
    await db
      .update(workoutSessions)
      .set({ completedAt: session.completedAt ?? new Date() })
      .where(eq(workoutSessions.id, session.id));
    res.json(await sessionDto(me.id, session.id));
  });

  router.delete('/sessions/:id', async (req, res) => {
    const me = currentUser(res);
    const session = await ownSession(me.id, req.params.id);
    await db.delete(workoutSessions).where(eq(workoutSessions.id, session.id));
    res.status(204).end();
  });

  /** Exercises the user has logged, for the progress picker. */
  router.get('/progress', async (_req, res) => {
    const me = currentUser(res);
    const rows = await db
      .selectDistinct({ slug: setLogs.exerciseSlug })
      .from(setLogs)
      .innerJoin(workoutSessions, eq(workoutSessions.id, setLogs.sessionId))
      .where(eq(workoutSessions.userId, me.id));
    res.json(
      rows
        .map((r) => ({ exerciseSlug: r.slug, exerciseName: exerciseName(r.slug) }))
        .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
    );
  });

  router.get('/progress/:slug', async (req, res) => {
    const me = currentUser(res);
    const rows = await db
      .select({
        sessionId: workoutSessions.id,
        startedAt: workoutSessions.startedAt,
        reps: setLogs.reps,
        weight: setLogs.weight,
      })
      .from(setLogs)
      .innerJoin(workoutSessions, eq(workoutSessions.id, setLogs.sessionId))
      .where(and(eq(workoutSessions.userId, me.id), eq(setLogs.exerciseSlug, req.params.slug)))
      .orderBy(asc(workoutSessions.startedAt));
    const bySession = new Map<string, { date: Date; sets: { reps: number; weight: number }[] }>();
    for (const r of rows) {
      const entry = bySession.get(r.sessionId) ?? { date: r.startedAt, sets: [] };
      entry.sets.push({ reps: r.reps, weight: r.weight });
      bySession.set(r.sessionId, entry);
    }
    const points: ProgressPointDto[] = [];
    for (const [sessionId, { date, sets }] of bySession) {
      const best = bestSet(sets);
      if (best)
        points.push({
          sessionId,
          date: date.toISOString(),
          weight: best.weight,
          reps: best.reps,
          e1rm: best.e1rm,
        });
    }
    res.json({
      exerciseSlug: req.params.slug,
      exerciseName: exerciseName(req.params.slug),
      points,
    });
  });

  return router;
}
