import { eq } from 'drizzle-orm';
import {
  createChallenge,
  generatePlan,
  transition,
  type ChallengeAction,
  type ChallengeState,
} from '@gogz/shared';
import type { Db } from './client.js';
import {
  allowedEmails,
  challengeEvents,
  challenges,
  planDayExercises,
  planDays,
  setLogs,
  users,
  workoutPlans,
  workoutSessions,
  type User,
} from './schema.js';
import { DEMO_EMAIL } from '../routes/auth.js';

export async function seedAdmin(db: Db, email: string) {
  await db
    .insert(allowedEmails)
    .values({ email: email.toLowerCase(), role: 'admin' })
    .onConflictDoUpdate({ target: allowedEmails.email, set: { role: 'admin' } });
}

const DEMO_FRIENDS = [
  { firstName: 'Jordan', lastName: 'Reyes', displayName: 'Jordan' },
  { firstName: 'Marcus', lastName: 'Lee', displayName: 'Marcus' },
  { firstName: 'Tyler', lastName: 'Brooks', displayName: 'T-Bone' },
  { firstName: 'Sam', lastName: 'Patel', displayName: 'Sammy P' },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Rebuilds the demo world from scratch: the demo login, four fake friends,
 * a challenge history and six weeks of workouts. Safe to run repeatedly.
 */
export async function seedDemo(db: Db, now = new Date()) {
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.isDemo, true));

    const [demo] = await tx
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        firstName: 'Demo',
        lastName: 'Golfer',
        displayName: 'Demo Golfer',
        role: 'demo',
        isDemo: true,
        phone: '+15555550100',
        smsOptIn: true,
      })
      .returning();
    const friends = await tx
      .insert(users)
      .values(
        DEMO_FRIENDS.map((f, i) => ({
          ...f,
          email: `${f.firstName.toLowerCase()}@friends.gogz.demo`,
          role: 'member' as const,
          isDemo: true,
          phone: `+1555555010${i + 1}`,
          smsOptIn: true,
        })),
      )
      .returning();
    const [jordan, marcus, tbone, sammy] = friends as [User, User, User, User];
    const me = demo!;

    // Challenge history: [challenger, opponent, prize, moves, days ago]
    type Move = [ChallengeAction, string];
    const history: [string, string, string, Move[], number][] = [
      [
        me.id,
        jordan.id,
        'Loser buys lunch',
        [
          [{ type: 'accept' }, jordan.id],
          [{ type: 'report', winnerId: me.id }, me.id],
          [{ type: 'confirm' }, jordan.id],
        ],
        40,
      ],
      [
        marcus.id,
        me.id,
        '$20',
        [
          [{ type: 'accept' }, me.id],
          [{ type: 'report', winnerId: marcus.id }, marcus.id],
          [{ type: 'confirm' }, me.id],
        ],
        33,
      ],
      [
        me.id,
        tbone.id,
        'Loser carries the bag',
        [
          [{ type: 'counter', prize: 'Loser carries the bag for 9 holes' }, tbone.id],
          [{ type: 'accept' }, me.id],
          [{ type: 'report', winnerId: me.id }, tbone.id],
          [{ type: 'confirm' }, me.id],
        ],
        25,
      ],
      [
        me.id,
        jordan.id,
        'Round of drinks',
        [
          [{ type: 'accept' }, jordan.id],
          [{ type: 'report', winnerId: me.id }, me.id],
          [{ type: 'confirm' }, jordan.id],
        ],
        18,
      ],
      [sammy.id, me.id, 'Winner picks the course', [[{ type: 'decline' }, me.id]], 12],
      [
        me.id,
        marcus.id,
        '$50 skins match',
        [[{ type: 'counter', prize: '$25 skins match' }, marcus.id]],
        3,
      ],
      [tbone.id, me.id, 'Loser buys breakfast', [], 1],
      [me.id, sammy.id, 'Closest to the pin', [[{ type: 'accept' }, sammy.id]], 2],
    ];

    for (const [from, to, prize, moves, daysAgo] of history) {
      let state: ChallengeState = createChallenge(from, to, prize);
      const at = new Date(now.getTime() - daysAgo * DAY);
      const events: { actorId: string; type: string; prize: string | null; createdAt: Date }[] = [
        { actorId: from, type: 'create', prize, createdAt: at },
      ];
      for (const [i, [action, actor]] of moves.entries()) {
        const result = transition(state, action, actor);
        if (!result.ok) throw new Error(`Bad demo seed: ${result.error}`);
        state = result.state;
        events.push({
          actorId: actor,
          type: action.type,
          prize: action.type === 'counter' ? state.prize : null,
          createdAt: new Date(at.getTime() + (i + 1) * 3600_000),
        });
      }
      const updatedAt = events.at(-1)!.createdAt;
      const [c] = await tx
        .insert(challenges)
        .values({ ...state, createdAt: at, updatedAt })
        .returning();
      await tx.insert(challengeEvents).values(events.map((e) => ({ ...e, challengeId: c!.id })));
    }

    // Workout plan plus six weeks of steadily improving sessions.
    const generated = generatePlan({
      goal: 'golf',
      daysPerWeek: 3,
      equipment: ['barbell', 'dumbbell', 'cable'],
    });
    const [plan] = await tx
      .insert(workoutPlans)
      .values({
        userId: me.id,
        name: generated.name,
        goal: 'golf',
        daysPerWeek: 3,
        equipment: ['barbell', 'dumbbell', 'cable'],
        isActive: true,
      })
      .returning();
    const days = [];
    for (const [dayIndex, day] of generated.days.entries()) {
      const [row] = await tx
        .insert(planDays)
        .values({ planId: plan!.id, dayIndex, name: day.name })
        .returning();
      await tx
        .insert(planDayExercises)
        .values(day.exercises.map((e, position) => ({ ...e, position, planDayId: row!.id })));
      days.push({ row: row!, exercises: day.exercises });
    }

    const startWeight: Record<string, number> = {};
    for (let week = 0; week < 6; week++) {
      for (const [d, { row, exercises }] of days.entries()) {
        const startedAt = new Date(now.getTime() - ((5 - week) * 7 + (6 - d * 2)) * DAY);
        const [session] = await tx
          .insert(workoutSessions)
          .values({
            userId: me.id,
            planDayId: row.id,
            planDayName: row.name,
            startedAt,
            completedAt: new Date(startedAt.getTime() + 3600_000),
          })
          .returning();
        const sets = exercises.flatMap((e, i) => {
          startWeight[e.exerciseSlug] ??= [135, 95, 65, 45, 25, 20, 15][i] ?? 20;
          const weight = startWeight[e.exerciseSlug]! + week * (i < 2 ? 10 : 5);
          return Array.from({ length: e.sets }, (_, s) => ({
            sessionId: session!.id,
            exerciseSlug: e.exerciseSlug,
            setNumber: s + 1,
            reps: Math.max(e.repMin, e.repMax - s - (week % 2)),
            weight,
          }));
        });
        await tx.insert(setLogs).values(sets);
      }
    }
  });
}
