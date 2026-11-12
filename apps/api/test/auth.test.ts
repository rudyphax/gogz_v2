import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../src/auth/passwords.js';
import { createSession, SESSION_TTL_MS, validateSession } from '../src/auth/sessions.js';
import { allowedEmails, sessions, users } from '../src/db/schema.js';
import { seedDemo } from '../src/db/seed.js';
import { APP_ORIGIN, createUser, fakeGoogle, makeApp, signedIn, useTestDb } from './helpers.js';

const db = useTestDb();

function cookieHeader(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw ?? [];
}

describe('session guard', () => {
  it('rejects unauthenticated API calls', async () => {
    const { app } = makeApp(db);
    await request(app).get('/api/me').expect(401);
    await request(app).get('/api/golf/friends').expect(401);
  });

  it('returns the signed-in user', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db, { displayName: 'Rudy' });
    const agent = await signedIn(app, db, user.id);
    const res = await agent.get('/api/me').expect(200);
    expect(res.body).toMatchObject({
      id: user.id,
      displayName: 'Rudy',
      hasPassword: false,
      role: 'member',
    });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('ignores unknown session tokens', async () => {
    const { app } = makeApp(db);
    await request(app).get('/api/me').set('Cookie', 'gogz_session=garbage').expect(401);
  });

  it('serves health checks and 404s unknown API routes', async () => {
    const { app } = makeApp(db);
    await request(app).get('/api/health').expect(200, { ok: true });
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    await agent.get('/api/nope').expect(404);
  });
});

describe('session lifecycle', () => {
  it('expires old sessions and slides active ones', async () => {
    const user = await createUser(db);
    const start = new Date('2026-01-01T00:00:00Z');
    const token = await createSession(db, user.id, start);

    const later = new Date(start.getTime() + SESSION_TTL_MS * 0.75);
    expect((await validateSession(db, token, later))?.id).toBe(user.id);
    const [row] = await db.select().from(sessions);
    expect(row!.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);

    const expired = new Date(later.getTime() + SESSION_TTL_MS + 1);
    expect(await validateSession(db, token, expired)).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});

describe('CSRF origin check', () => {
  it('blocks cross-site writes but allows same-origin ones', async () => {
    const { app } = makeApp(db);
    await request(app).post('/api/auth/logout').set('Origin', 'https://evil.example').expect(403);
    await request(app).post('/api/auth/logout').set('Origin', APP_ORIGIN).expect(204);
  });
});

describe('Google sign-in', () => {
  it('reports whether Google is configured', async () => {
    await request(makeApp(db).app).get('/api/auth/providers').expect(200, { google: false });
    await request(makeApp(db, { google: fakeGoogle() }).app)
      .get('/api/auth/providers')
      .expect(200, { google: true });
  });

  it('returns 503 when Google is not configured', async () => {
    const { app } = makeApp(db);
    await request(app).get('/api/auth/google').expect(503);
    await request(app).get('/api/auth/google/callback').expect(503);
  });

  async function startFlow(app: ReturnType<typeof makeApp>['app']) {
    const res = await request(app).get('/api/auth/google').expect(302);
    const state = new URL(res.headers.location!).searchParams.get('state')!;
    const cookies = cookieHeader(res)
      .map((c) => c.split(';')[0])
      .join('; ');
    return { state, cookies };
  }

  it('creates an account for an allowlisted, verified email', async () => {
    await db.insert(allowedEmails).values({ email: 'friend@example.com', role: 'member' });
    const { app } = makeApp(db, { google: fakeGoogle() });
    const { state, cookies } = await startFlow(app);

    const res = await request(app)
      .get(`/api/auth/google/callback?code=ok&state=${state}`)
      .set('Cookie', cookies)
      .expect(302);
    expect(res.headers.location).toBe('/golf');
    const sessionCookie = cookieHeader(res).find((c) => c.startsWith('gogz_session='))!;
    expect(sessionCookie).toMatch(/HttpOnly/);
    expect(sessionCookie).toMatch(/SameSite=Lax/);

    const [user] = await db.select().from(users).where(eq(users.email, 'friend@example.com'));
    expect(user).toMatchObject({
      firstName: 'Friend',
      lastName: 'Person',
      displayName: 'Friend',
      role: 'member',
    });

    // Second login reuses the account.
    const again = await startFlow(app);
    await request(app)
      .get(`/api/auth/google/callback?code=ok&state=${again.state}`)
      .set('Cookie', again.cookies)
      .expect(302);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('returns to the page the user started from', async () => {
    await db.insert(allowedEmails).values({ email: 'friend@example.com', role: 'member' });
    const { app } = makeApp(db, { google: fakeGoogle() });
    for (const [next, expected] of [
      ['/golf/challenges/abc', '/golf/challenges/abc'],
      ['//evil.example', '/golf'],
      ['https://evil.example', '/golf'],
    ]) {
      const res = await request(app)
        .get(`/api/auth/google?next=${encodeURIComponent(next)}`)
        .expect(302);
      const state = new URL(res.headers.location!).searchParams.get('state')!;
      const cookies = cookieHeader(res)
        .map((c) => c.split(';')[0])
        .join('; ');
      const done = await request(app)
        .get(`/api/auth/google/callback?code=ok&state=${state}`)
        .set('Cookie', cookies);
      expect(done.headers.location).toBe(expected);
    }
  });

  it('rejects emails that are not on the allowlist', async () => {
    const { app } = makeApp(db, { google: fakeGoogle({ email: 'stranger@example.com' }) });
    const { state, cookies } = await startFlow(app);
    const res = await request(app)
      .get(`/api/auth/google/callback?code=ok&state=${state}`)
      .set('Cookie', cookies)
      .expect(302);
    expect(res.headers.location).toBe('/login?error=not_invited');
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('rejects unverified Google emails', async () => {
    await db.insert(allowedEmails).values({ email: 'friend@example.com', role: 'member' });
    const { app } = makeApp(db, { google: fakeGoogle({ emailVerified: false }) });
    const { state, cookies } = await startFlow(app);
    const res = await request(app)
      .get(`/api/auth/google/callback?code=ok&state=${state}`)
      .set('Cookie', cookies);
    expect(res.headers.location).toBe('/login?error=unverified');
  });

  it('rejects mismatched state and failed code exchange', async () => {
    const { app } = makeApp(db, { google: fakeGoogle() });
    const { state, cookies } = await startFlow(app);
    let res = await request(app)
      .get(`/api/auth/google/callback?code=ok&state=wrong`)
      .set('Cookie', cookies);
    expect(res.headers.location).toBe('/login?error=oauth');
    res = await request(app).get(`/api/auth/google/callback?code=ok&state=${state}`);
    expect(res.headers.location).toBe('/login?error=oauth');
    res = await request(app)
      .get(`/api/auth/google/callback?code=bad&state=${state}`)
      .set('Cookie', cookies);
    expect(res.headers.location).toBe('/login?error=oauth');
  });

  it('gives admins on the allowlist the admin role', async () => {
    await db.insert(allowedEmails).values({ email: 'friend@example.com', role: 'admin' });
    const { app } = makeApp(db, { google: fakeGoogle() });
    const { state, cookies } = await startFlow(app);
    await request(app)
      .get(`/api/auth/google/callback?code=ok&state=${state}`)
      .set('Cookie', cookies);
    const [user] = await db.select().from(users);
    expect(user!.role).toBe('admin');
  });
});

describe('password login', () => {
  async function userWithPassword(email = 'pw@example.com') {
    return createUser(db, { email, passwordHash: await hashPassword('correct horse battery') });
  }

  it('signs in with the right password', async () => {
    const { app } = makeApp(db);
    await userWithPassword();
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'PW@example.com', password: 'correct horse battery' })
      .expect(200);
    await agent.get('/api/me').expect(200);
  });

  it('rejects wrong passwords, unknown users and users without passwords', async () => {
    const { app } = makeApp(db);
    await userWithPassword();
    await createUser(db, { email: 'nopw@example.com' });
    for (const body of [
      { email: 'pw@example.com', password: 'wrong' },
      { email: 'nobody@example.com', password: 'whatever' },
      { email: 'nopw@example.com', password: 'whatever' },
    ]) {
      const res = await request(app).post('/api/auth/login').send(body).expect(401);
      expect(res.body.error).toBe('Incorrect email or password');
    }
  });

  it('locks out users removed from the allowlist', async () => {
    const { app } = makeApp(db);
    await userWithPassword();
    await db.delete(allowedEmails).where(eq(allowedEmails.email, 'pw@example.com'));
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'pw@example.com', password: 'correct horse battery' })
      .expect(401);
  });

  it('rate-limits attempts', async () => {
    const { app } = makeApp(db, { config: { loginRateLimit: 2 } });
    const body = { email: 'x@example.com', password: 'nope' };
    await request(app).post('/api/auth/login').send(body).expect(401);
    await request(app).post('/api/auth/login').send(body).expect(401);
    await request(app).post('/api/auth/login').send(body).expect(429);
  });

  it('validates input', async () => {
    const { app } = makeApp(db);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('demo login', () => {
  it('503s until the demo is seeded, then signs in as the demo user', async () => {
    const { app } = makeApp(db);
    await request(app).post('/api/auth/demo').expect(503);
    await seedDemo(db);
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/demo').expect(200);
    expect(res.body.role).toBe('demo');
    const friends = await agent.get('/api/golf/friends').expect(200);
    expect(friends.body).toHaveLength(4);
  });
});

describe('logout', () => {
  it('ends the session', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/me').expect(401);
  });
});
