import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { users } from '../src/db/schema.js';
import { makeApp, useTestDb } from './helpers.js';

const db = useTestDb();

describe('test-only routes', () => {
  it('are not mounted outside NODE_ENV=test', async () => {
    const { app } = makeApp(db, { config: { nodeEnv: 'production' } });
    await request(app).post('/api/test/reset').expect(401);
  });

  it('reset the database and simulate Google sign-in through the allowlist', async () => {
    const { app, sms } = makeApp(db);
    await sms.send('+1', 'old');
    await request(app)
      .post('/api/test/reset')
      .send({ admin: 'admin@example.com', members: ['friend@example.com'] })
      .expect(204);
    expect(sms.messages).toEqual([]);
    expect(await db.select().from(users)).toHaveLength(5); // demo world only

    await request(app)
      .post('/api/test/google-login')
      .send({ email: 'stranger@example.com' })
      .expect(403, { error: 'not_invited' });
    await request(app)
      .post('/api/test/google-login')
      .send({ email: 'friend@example.com', emailVerified: false })
      .expect(403, { error: 'unverified' });

    const agent = request.agent(app);
    await agent
      .post('/api/test/google-login')
      .send({ email: 'friend@example.com', givenName: 'Pal' })
      .expect(200);
    expect((await agent.get('/api/me')).body).toMatchObject({ displayName: 'Pal', role: 'member' });

    await sms.send('+1', 'hi');
    expect((await agent.get('/api/test/sms')).body).toEqual([{ to: '+1', body: 'hi' }]);
  });
});
