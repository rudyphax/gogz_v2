import { describe, expect, it } from 'vitest';
import { seedDemo } from '../src/db/seed.js';
import type { SmsProvider } from '../src/services/sms.js';
import { createUser, makeApp, signedIn, useTestDb } from './helpers.js';

const db = useTestDb();

async function setup(smsOverride?: SmsProvider) {
  const ctx = makeApp(db, smsOverride ? { sms: smsOverride } : {});
  const alice = await createUser(db, {
    displayName: 'Alice',
    phone: '+15550000001',
    smsOptIn: true,
  });
  const bob = await createUser(db, { displayName: 'Bob', phone: '+15550000002', smsOptIn: true });
  const carol = await createUser(db, { displayName: 'Carol' });
  return {
    ...ctx,
    alice,
    bob,
    carol,
    asAlice: await signedIn(ctx.app, db, alice.id),
    asBob: await signedIn(ctx.app, db, bob.id),
    asCarol: await signedIn(ctx.app, db, carol.id),
  };
}

describe('friends', () => {
  it('lists everyone else in the group with head-to-head records', async () => {
    const { asAlice, asBob, bob, carol } = await setup();
    const { body: c } = await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: bob.id, prize: '$5' })
      .expect(201);
    await asBob.post(`/api/golf/challenges/${c.id}/actions`).send({ type: 'accept' }).expect(200);
    await asBob
      .post(`/api/golf/challenges/${c.id}/actions`)
      .send({ type: 'report', winnerId: bob.id })
      .expect(200);
    await asAlice
      .post(`/api/golf/challenges/${c.id}/actions`)
      .send({ type: 'confirm' })
      .expect(200);

    const { body } = await asAlice.get('/api/golf/friends').expect(200);
    expect(body.map((f: { displayName: string }) => f.displayName)).toEqual(['Bob', 'Carol']);
    expect(body.find((f: { id: string }) => f.id === bob.id).record).toEqual({
      wins: 0,
      losses: 1,
    });
    expect(body.find((f: { id: string }) => f.id === carol.id).record).toEqual({
      wins: 0,
      losses: 0,
    });
  });

  it('keeps demo users and real users apart', async () => {
    const { asAlice } = await setup();
    await seedDemo(db);
    const { body } = await asAlice.get('/api/golf/friends').expect(200);
    expect(body).toHaveLength(2);
  });
});

describe('challenge flow', () => {
  it('runs send → counter → accept → report → confirm, texting the other player each time', async () => {
    const { asAlice, asBob, bob, alice, sms } = await setup();

    const { body: created } = await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: bob.id, prize: 'Loser buys lunch' })
      .expect(201);
    expect(created).toMatchObject({
      status: 'pending',
      turnUserId: bob.id,
      availableActions: ['cancel'],
    });
    expect(sms.messages[0]).toEqual({
      to: '+15550000002',
      body: expect.stringContaining(`Alice challenged you to a round for "Loser buys lunch"`),
    });
    expect(sms.messages[0]!.body).toContain(`http://localhost:5173/golf/challenges/${created.id}`);

    const act = (agent: typeof asAlice, body: object) =>
      agent.post(`/api/golf/challenges/${created.id}/actions`).send(body);

    let res = await act(asBob, { type: 'counter', prize: 'Loser buys dinner' }).expect(200);
    expect(res.body).toMatchObject({
      status: 'countered',
      prize: 'Loser buys dinner',
      turnUserId: alice.id,
    });
    expect(sms.messages[1]).toMatchObject({
      to: '+15550000001',
      body: expect.stringContaining('countered'),
    });

    res = await act(asAlice, { type: 'accept' }).expect(200);
    expect(res.body.status).toBe('accepted');
    await act(asAlice, { type: 'report', winnerId: alice.id }).expect(200);
    expect(sms.messages.at(-1)!.body).toContain('says Alice won');
    res = await act(asBob, { type: 'confirm' }).expect(200);
    expect(res.body).toMatchObject({ status: 'completed', winnerId: alice.id });
    expect(sms.messages).toHaveLength(5);

    const { body: detail } = await asAlice.get(`/api/golf/challenges/${created.id}`).expect(200);
    expect(detail.events.map((e: { type: string }) => e.type)).toEqual([
      'create',
      'counter',
      'accept',
      'report',
      'confirm',
    ]);
    expect(detail.events[1]).toMatchObject({ actorName: 'Bob', prize: 'Loser buys dinner' });
  });

  it('rejects illegal moves with 409', async () => {
    const { asAlice, bob } = await setup();
    const { body } = await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: bob.id, prize: '$5' });
    const res = await asAlice
      .post(`/api/golf/challenges/${body.id}/actions`)
      .send({ type: 'accept' })
      .expect(409);
    expect(res.body.error).toMatch(/Waiting/);
  });

  it('hides challenges from people not in them', async () => {
    const { asAlice, asCarol, bob } = await setup();
    const { body } = await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: bob.id, prize: '$5' });
    await asCarol.get(`/api/golf/challenges/${body.id}`).expect(404);
    await asCarol
      .post(`/api/golf/challenges/${body.id}/actions`)
      .send({ type: 'accept' })
      .expect(404);
    expect((await asCarol.get('/api/golf/challenges').expect(200)).body).toEqual([]);
  });

  it('lists my challenges newest first', async () => {
    const { asAlice, bob, carol } = await setup();
    await asAlice.post('/api/golf/challenges').send({ opponentId: bob.id, prize: 'first' });
    await asAlice.post('/api/golf/challenges').send({ opponentId: carol.id, prize: 'second' });
    const { body } = await asAlice.get('/api/golf/challenges').expect(200);
    expect(body.map((c: { prize: string }) => c.prize)).toEqual(['second', 'first']);
  });

  it('validates new challenges', async () => {
    const { asAlice, alice } = await setup();
    await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: alice.id, prize: '$5' })
      .expect(400);
    await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: 'nope', prize: '$5' })
      .expect(400);
    await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: '00000000-0000-4000-8000-000000000000', prize: '$5' })
      .expect(404);
    const res = await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: alice.id, prize: '' })
      .expect(400);
    expect(res.body.error).toBe('Enter a prize');
  });

  it('cannot challenge demo users from a real account', async () => {
    const { asAlice } = await setup();
    await seedDemo(db);
    const demoFriend = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.isDemo, true) });
    await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: demoFriend!.id, prize: '$5' })
      .expect(404);
  });
});

describe('text messages', () => {
  it('skips players without a phone or SMS consent', async () => {
    const { asBob, carol, sms } = await setup();
    await asBob
      .post('/api/golf/challenges')
      .send({ opponentId: carol.id, prize: '$5' })
      .expect(201);
    expect(sms.messages).toHaveLength(0);
  });

  it('never texts demo users', async () => {
    const { app, sms } = makeApp(db);
    await seedDemo(db);
    const demo = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.role, 'demo') });
    const friend = await db.query.users.findFirst({
      where: (u, { and, eq }) => and(eq(u.isDemo, true), eq(u.role, 'member')),
    });
    const agent = await signedIn(app, db, demo!.id);
    await agent
      .post('/api/golf/challenges')
      .send({ opponentId: friend!.id, prize: '$5' })
      .expect(201);
    expect(sms.messages).toHaveLength(0);
  });

  it('still saves the challenge when the SMS provider fails', async () => {
    const failing: SmsProvider = { send: () => Promise.reject(new Error('Twilio down')) };
    const { asAlice, bob } = await setup(failing);
    await asAlice
      .post('/api/golf/challenges')
      .send({ opponentId: bob.id, prize: '$5' })
      .expect(201);
  });
});
