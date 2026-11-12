import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { allowedEmails, users } from '../src/db/schema.js';
import { createSession, SESSION_COOKIE } from '../src/auth/sessions.js';
import type { GoogleOAuth } from '../src/auth/google.js';
import { MemorySmsProvider } from '../src/services/sms.js';
import { InlineAvatarStorage } from '../src/services/storage.js';

export const APP_ORIGIN = 'http://localhost:5173';

/** Shared DB connection for a test file; tables are truncated before each test. */
export function useTestDb() {
  const { db, pool } = createDb(process.env.TEST_DATABASE_URL!);
  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE users, allowed_emails, sessions, challenges, challenge_events, workout_plans, plan_days, plan_day_exercises, workout_sessions, set_logs CASCADE`,
    );
  });
  afterAll(() => pool.end());
  return db;
}

export type TestDb = ReturnType<typeof useTestDb>;

export function makeApp(
  db: TestDb,
  overrides: Partial<AppDeps> & { config?: Partial<Config> } = {},
) {
  const sms = new MemorySmsProvider();
  const config: Config = {
    ...loadConfig({ NODE_ENV: 'test', APP_ORIGIN }),
    loginRateLimit: 1000,
    cronSecret: 'cron-secret',
    ...overrides.config,
  };
  const deps: AppDeps = {
    db,
    sms,
    storage: new InlineAvatarStorage(),
    google: null,
    ...overrides,
    config,
  };
  return { app: createApp(deps), sms, deps };
}

let counter = 0;
export async function createUser(
  db: TestDb,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  counter += 1;
  const email = overrides.email ?? `user${counter}@example.com`;
  if (!overrides.isDemo) {
    await db
      .insert(allowedEmails)
      .values({ email, role: overrides.role === 'admin' ? 'admin' : 'member' })
      .onConflictDoNothing();
  }
  const [user] = await db
    .insert(users)
    .values({
      displayName: `User ${counter}`,
      firstName: 'User',
      lastName: `${counter}`,
      ...overrides,
      email,
    })
    .returning();
  return user!;
}

/** Supertest agent already signed in as `userId`. */
export async function signedIn(app: ReturnType<typeof createApp>, db: TestDb, userId: string) {
  const token = await createSession(db, userId);
  const agent = request.agent(app);
  agent.set('Cookie', `${SESSION_COOKIE}=${token}`);
  return agent;
}

export function fakeGoogle(
  profile: Partial<Awaited<ReturnType<GoogleOAuth['getProfile']>>> = {},
): GoogleOAuth {
  return {
    createAuthorizationURL: (state) => new URL(`https://accounts.google.test/auth?state=${state}`),
    getProfile: (code) =>
      code === 'bad'
        ? Promise.reject(new Error('invalid_grant'))
        : Promise.resolve({
            email: 'friend@example.com',
            emailVerified: true,
            givenName: 'Friend',
            familyName: 'Person',
            name: 'Friend Person',
            ...profile,
          }),
  };
}
