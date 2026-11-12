import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { allowedEmails, users } from '../src/db/schema.js';
import { seedDemo } from '../src/db/seed.js';
import type { AvatarStorage } from '../src/services/storage.js';
import { createUser, makeApp, signedIn, useTestDb } from './helpers.js';

const db = useTestDb();

const profile = {
  firstName: 'Rory',
  lastName: 'M',
  displayName: 'Rors',
  phone: '(555) 222-3333',
  smsOptIn: true,
};

describe('profile', () => {
  it('updates names and normalizes the phone number', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    const { body } = await agent.patch('/api/profile').send(profile).expect(200);
    expect(body).toMatchObject({
      firstName: 'Rory',
      displayName: 'Rors',
      phone: '+15552223333',
      smsOptIn: true,
    });
  });

  it('turns SMS off when the phone number is removed', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    const { body } = await agent
      .patch('/api/profile')
      .send({ ...profile, phone: '' })
      .expect(200);
    expect(body).toMatchObject({ phone: null, smsOptIn: false });
  });

  it('rejects invalid phone numbers', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    const res = await agent
      .patch('/api/profile')
      .send({ ...profile, phone: '123' })
      .expect(400);
    expect(res.body.error).toBe('Enter a valid phone number');
  });

  it('only lets admins change their email, and moves the allowlist entry', async () => {
    const { app } = makeApp(db);
    const member = await createUser(db, { email: 'member@example.com' });
    const admin = await createUser(db, { email: 'admin@example.com', role: 'admin' });
    await (
      await signedIn(app, db, member.id)
    )
      .patch('/api/profile')
      .send({ ...profile, email: 'new@example.com' })
      .expect(403);

    const asAdmin = await signedIn(app, db, admin.id);
    await asAdmin
      .patch('/api/profile')
      .send({ ...profile, email: 'member@example.com' })
      .expect(409);
    const { body } = await asAdmin
      .patch('/api/profile')
      .send({ ...profile, email: 'Boss@Example.com' })
      .expect(200);
    expect(body.email).toBe('boss@example.com');
    const list = await db.select().from(allowedEmails);
    expect(list.map((a) => a.email).sort()).toEqual(['boss@example.com', 'member@example.com']);
    // Same email is a no-op.
    await asAdmin
      .patch('/api/profile')
      .send({ ...profile, email: 'boss@example.com' })
      .expect(200);
  });

  it('sets a password, then requires the current one to change it', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db, { email: 'pw@example.com' });
    const agent = await signedIn(app, db, user.id);
    await agent.put('/api/profile/password').send({ newPassword: 'short' }).expect(400);
    await agent.put('/api/profile/password').send({ newPassword: 'first-password-1' }).expect(204);
    expect((await agent.get('/api/me')).body.hasPassword).toBe(true);

    await agent.put('/api/profile/password').send({ newPassword: 'second-password-2' }).expect(400);
    await agent
      .put('/api/profile/password')
      .send({ currentPassword: 'wrong', newPassword: 'second-password-2' })
      .expect(400);
    await agent
      .put('/api/profile/password')
      .send({ currentPassword: 'first-password-1', newPassword: 'second-password-2' })
      .expect(204);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'pw@example.com', password: 'second-password-2' })
      .expect(200);
  });

  it('uploads and removes an avatar', async () => {
    const saved: string[] = [];
    const storage: AvatarStorage = {
      save: (userId, type, data) => {
        saved.push(`${userId}:${type}:${data.length}`);
        return Promise.resolve('https://blob.example/avatar.png');
      },
    };
    const { app } = makeApp(db, { storage });
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const { body } = await agent
      .put('/api/profile/avatar')
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(200);
    expect(body.avatarUrl).toBe('https://blob.example/avatar.png');
    expect(saved).toEqual([`${user.id}:image/png:4`]);

    await agent.put('/api/profile/avatar').set('Content-Type', 'text/plain').send('hi').expect(400);
    await agent
      .put('/api/profile/avatar')
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(3 * 1024 * 1024))
      .expect(413);

    const removed = await agent.delete('/api/profile/avatar').expect(200);
    expect(removed.body.avatarUrl).toBeNull();
  });

  it('stores avatars inline by default (local dev)', async () => {
    const { app } = makeApp(db);
    const user = await createUser(db);
    const agent = await signedIn(app, db, user.id);
    const { body } = await agent
      .put('/api/profile/avatar')
      .set('Content-Type', 'image/gif')
      .send(Buffer.from('GIF89a'))
      .expect(200);
    expect(body.avatarUrl).toBe(
      `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`,
    );
  });

  it('is read-only for the demo account', async () => {
    const { app } = makeApp(db);
    await seedDemo(db);
    const agent = request.agent(app);
    await agent.post('/api/auth/demo').expect(200);
    const res = await agent.patch('/api/profile').send(profile).expect(403);
    expect(res.body.error).toMatch(/demo/);
    await agent
      .put('/api/profile/password')
      .send({ newPassword: 'long-enough-password' })
      .expect(403);
  });
});

describe('admin: members allowlist', () => {
  it('is admin-only', async () => {
    const { app } = makeApp(db);
    const member = await createUser(db);
    await (await signedIn(app, db, member.id)).get('/api/admin/allowed-emails').expect(403);
  });

  it('adds, lists, promotes and removes members', async () => {
    const { app } = makeApp(db);
    const admin = await createUser(db, { email: 'admin@example.com', role: 'admin' });
    const friend = await createUser(db, { email: 'friend@example.com' });
    const asAdmin = await signedIn(app, db, admin.id);
    const asFriend = await signedIn(app, db, friend.id);

    await asAdmin.post('/api/admin/allowed-emails').send({ email: 'New@Example.com' }).expect(201);
    let { body } = await asAdmin.get('/api/admin/allowed-emails').expect(200);
    expect(
      body.map((a: { email: string; registered: boolean }) => [a.email, a.registered]),
    ).toEqual([
      ['admin@example.com', true],
      ['friend@example.com', true],
      ['new@example.com', false],
    ]);

    await asAdmin
      .post('/api/admin/allowed-emails')
      .send({ email: 'friend@example.com', role: 'admin' })
      .expect(201);
    const [promoted] = await db.select().from(users).where(eq(users.id, friend.id));
    expect(promoted!.role).toBe('admin');

    await asAdmin.delete('/api/admin/allowed-emails/friend@example.com').expect(204);
    await asFriend.get('/api/me').expect(401);
    await asAdmin.delete('/api/admin/allowed-emails/friend@example.com').expect(404);
    await asAdmin.delete('/api/admin/allowed-emails/new@example.com').expect(204);
    await asAdmin.delete('/api/admin/allowed-emails/admin@example.com').expect(400);
    ({ body } = await asAdmin.get('/api/admin/allowed-emails'));
    expect(body).toHaveLength(1);
  });
});

describe('demo reset cron', () => {
  it('requires the cron secret and reseeds demo data', async () => {
    const { app } = makeApp(db);
    await request(app).get('/api/cron/reset-demo').expect(401);
    await request(app).get('/api/cron/reset-demo').set('Authorization', 'Bearer wrong').expect(401);
    await request(app)
      .get('/api/cron/reset-demo')
      .set('Authorization', 'Bearer cron-secret')
      .expect(200);
    await request(app)
      .get('/api/cron/reset-demo')
      .set('Authorization', 'Bearer cron-secret')
      .expect(200);
    const demoUsers = await db.select().from(users).where(eq(users.isDemo, true));
    expect(demoUsers).toHaveLength(5);
  });

  it('is disabled when no secret is configured', async () => {
    const { app } = makeApp(db, { config: { cronSecret: null } });
    await request(app).get('/api/cron/reset-demo').set('Authorization', 'Bearer null').expect(401);
  });
});
