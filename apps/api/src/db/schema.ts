import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'member', 'demo']);
export const allowedRoleEnum = pgEnum('allowed_role', ['admin', 'member']);
export const challengeStatusEnum = pgEnum('challenge_status', [
  'pending',
  'countered',
  'accepted',
  'declined',
  'cancelled',
  'result_reported',
  'completed',
]);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  smsOptIn: boolean('sms_opt_in').notNull().default(false),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  role: roleEnum('role').notNull().default('member'),
  /** Demo-world users only see each other; real users never see them. */
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
});

export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  role: allowedRoleEnum('role').notNull().default('member'),
  createdAt: createdAt(),
});

export const sessions = pgTable('sessions', {
  /** SHA-256 of the cookie token, so a DB leak doesn't leak live sessions. */
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengerId: uuid('challenger_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    opponentId: uuid('opponent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prize: text('prize').notNull(),
    status: challengeStatusEnum('status').notNull().default('pending'),
    turnUserId: uuid('turn_user_id').references(() => users.id, { onDelete: 'set null' }),
    winnerId: uuid('winner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('challenges_challenger_idx').on(t.challengerId),
    index('challenges_opponent_idx').on(t.opponentId),
  ],
);

export const challengeEvents = pgTable('challenge_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  prize: text('prize'),
  createdAt: createdAt(),
});

export const workoutPlans = pgTable('workout_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  daysPerWeek: integer('days_per_week').notNull(),
  equipment: text('equipment')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const planDays = pgTable('plan_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => workoutPlans.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  name: text('name').notNull(),
});

export const planDayExercises = pgTable('plan_day_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  planDayId: uuid('plan_day_id')
    .notNull()
    .references(() => planDays.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  exerciseSlug: text('exercise_slug').notNull(),
  sets: integer('sets').notNull(),
  repMin: integer('rep_min').notNull(),
  repMax: integer('rep_max').notNull(),
});

export const workoutSessions = pgTable(
  'workout_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planDayId: uuid('plan_day_id').references(() => planDays.id, { onDelete: 'set null' }),
    /** Kept so history still reads well if the plan is deleted. */
    planDayName: text('plan_day_name').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('workout_sessions_user_idx').on(t.userId, t.startedAt)],
);

export const setLogs = pgTable(
  'set_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseSlug: text('exercise_slug').notNull(),
    setNumber: integer('set_number').notNull(),
    reps: integer('reps').notNull(),
    weight: doublePrecision('weight').notNull(),
  },
  (t) => [uniqueIndex('set_logs_unique').on(t.sessionId, t.exerciseSlug, t.setNumber)],
);

export type User = typeof users.$inferSelect;
