import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, eq, ne, or } from 'drizzle-orm';
import { Router } from 'express';
import {
  availableActions,
  challengeActionSchema,
  createChallenge,
  createChallengeSchema,
  headToHeadRecords,
  transition,
  type ChallengeActionType,
  type ChallengeDto,
  type ChallengeState,
  type Friend,
} from '@gogz/shared';
import type { AppDeps } from '../app.js';
import type { Db } from '../db/client.js';
import { challengeEvents, challenges, users, type User } from '../db/schema.js';
import { publicUser } from '../dto.js';
import { badRequest, HttpError, notFound } from '../errors.js';
import { currentUser } from '../middleware/auth.js';
import { challengeMessage } from '../services/challengeMessages.js';

const challenger = alias(users, 'challenger');
const opponent = alias(users, 'opponent');

type Row = { c: typeof challenges.$inferSelect; challenger: User; opponent: User };

function toState(c: typeof challenges.$inferSelect): ChallengeState {
  return {
    status: c.status,
    prize: c.prize,
    challengerId: c.challengerId,
    opponentId: c.opponentId,
    turnUserId: c.turnUserId,
    winnerId: c.winnerId,
  };
}

function toDto(row: Row, viewerId: string): ChallengeDto {
  return {
    id: row.c.id,
    status: row.c.status,
    prize: row.c.prize,
    challenger: publicUser(row.challenger),
    opponent: publicUser(row.opponent),
    turnUserId: row.c.turnUserId,
    winnerId: row.c.winnerId,
    availableActions: availableActions(toState(row.c), viewerId),
    createdAt: row.c.createdAt.toISOString(),
    updatedAt: row.c.updatedAt.toISOString(),
  };
}

function selectChallenges(db: Db) {
  return db
    .select({ c: challenges, challenger, opponent })
    .from(challenges)
    .innerJoin(challenger, eq(challenger.id, challenges.challengerId))
    .innerJoin(opponent, eq(opponent.id, challenges.opponentId));
}

const involves = (userId: string) =>
  or(eq(challenges.challengerId, userId), eq(challenges.opponentId, userId));

export function golfRoutes({ db, sms, config }: AppDeps) {
  const router = Router();
  const link = (id: string) => `${config.appOrigin}/golf/challenges/${id}`;

  async function notify(recipient: User, body: string) {
    if (recipient.isDemo || !recipient.phone || !recipient.smsOptIn) return;
    try {
      await sms.send(recipient.phone, body);
    } catch (err) {
      // A failed text shouldn't undo the move; the challenge still shows in the app.
      console.error('SMS failed', err);
    }
  }

  async function loadChallenge(id: string, viewerId: string): Promise<Row> {
    const [row] = await selectChallenges(db).where(and(eq(challenges.id, id), involves(viewerId)));
    if (!row) throw notFound('Challenge not found');
    return row;
  }

  router.get('/friends', async (_req, res) => {
    const me = currentUser(res);
    const friends = await db
      .select()
      .from(users)
      .where(and(eq(users.isDemo, me.isDemo), ne(users.id, me.id)))
      .orderBy(asc(users.displayName));
    const completed = await db
      .select()
      .from(challenges)
      .where(and(eq(challenges.status, 'completed'), involves(me.id)));
    const records = headToHeadRecords(me.id, completed);
    const body: Friend[] = friends.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      firstName: f.firstName,
      lastName: f.lastName,
      avatarUrl: f.avatarUrl,
      record: records.get(f.id) ?? { wins: 0, losses: 0 },
    }));
    res.json(body);
  });

  router.get('/challenges', async (_req, res) => {
    const me = currentUser(res);
    const rows = await selectChallenges(db)
      .where(involves(me.id))
      .orderBy(desc(challenges.updatedAt));
    res.json(rows.map((r) => toDto(r, me.id)));
  });

  router.post('/challenges', async (req, res) => {
    const me = currentUser(res);
    const input = createChallengeSchema.parse(req.body);
    const [opp] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.opponentId), eq(users.isDemo, me.isDemo)));
    if (!opp) throw notFound('Friend not found');
    if (opp.id === me.id) throw badRequest('You cannot challenge yourself');

    const state = createChallenge(me.id, opp.id, input.prize);
    const created = await db.transaction(async (tx) => {
      const [c] = await tx.insert(challenges).values(state).returning();
      await tx
        .insert(challengeEvents)
        .values({ challengeId: c!.id, actorId: me.id, type: 'create', prize: state.prize });
      return c!;
    });
    await notify(
      opp,
      challengeMessage('create', {
        actorName: me.displayName,
        prize: state.prize,
        link: link(created.id),
      }),
    );
    res.status(201).json(toDto({ c: created, challenger: me, opponent: opp }, me.id));
  });

  router.get('/challenges/:id', async (req, res) => {
    const me = currentUser(res);
    const row = await loadChallenge(req.params.id, me.id);
    const events = await db
      .select({ e: challengeEvents, actorName: users.displayName })
      .from(challengeEvents)
      .innerJoin(users, eq(users.id, challengeEvents.actorId))
      .where(eq(challengeEvents.challengeId, row.c.id))
      .orderBy(asc(challengeEvents.createdAt));
    res.json({
      ...toDto(row, me.id),
      events: events.map(({ e, actorName }) => ({
        id: e.id,
        actorId: e.actorId,
        actorName,
        type: e.type,
        prize: e.prize,
        createdAt: e.createdAt.toISOString(),
      })),
    } satisfies ChallengeDto);
  });

  router.post('/challenges/:id/actions', async (req, res) => {
    const me = currentUser(res);
    const action = challengeActionSchema.parse(req.body);

    const { updated, notifyUserId } = await db.transaction(async (tx) => {
      // Lock the row so two simultaneous moves can't both apply.
      const [current] = await tx
        .select()
        .from(challenges)
        .where(and(eq(challenges.id, req.params.id), involves(me.id)))
        .for('update');
      if (!current) throw notFound('Challenge not found');
      const result = transition(toState(current), action, me.id);
      if (!result.ok) throw new HttpError(409, result.error);
      const [c] = await tx
        .update(challenges)
        .set({ ...result.state, updatedAt: new Date() })
        .where(eq(challenges.id, current.id))
        .returning();
      await tx.insert(challengeEvents).values({
        challengeId: current.id,
        actorId: me.id,
        type: action.type,
        prize: action.type === 'counter' ? result.state.prize : null,
      });
      return { updated: c!, notifyUserId: result.notifyUserId };
    });

    const row = await loadChallenge(updated.id, me.id);
    const recipient = row.challenger.id === notifyUserId ? row.challenger : row.opponent;
    const winnerName =
      updated.winnerId === row.challenger.id
        ? row.challenger.displayName
        : row.opponent.displayName;
    await notify(
      recipient,
      challengeMessage(action.type as ChallengeActionType, {
        actorName: me.displayName,
        prize: updated.prize,
        link: link(updated.id),
        winnerName,
      }),
    );
    res.json(toDto(row, me.id));
  });

  return router;
}
