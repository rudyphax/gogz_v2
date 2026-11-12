import { describe, expect, it } from 'vitest';
import {
  availableActions,
  createChallenge,
  headToHeadRecords,
  transition,
  type ChallengeAction,
  type ChallengeState,
} from './challenge.js';

const A = 'alice';
const B = 'bob';
const C = 'carol';

function apply(state: ChallengeState, action: ChallengeAction, actor: string): ChallengeState {
  const result = transition(state, action, actor);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function expectError(state: ChallengeState, action: ChallengeAction, actor: string, msg: RegExp) {
  const result = transition(state, action, actor);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toMatch(msg);
}

describe('createChallenge', () => {
  it('starts pending with the opponent to act', () => {
    expect(createChallenge(A, B, '  $20  ')).toEqual({
      status: 'pending',
      prize: '$20',
      challengerId: A,
      opponentId: B,
      turnUserId: B,
      winnerId: null,
    });
  });

  it.each([
    [A, A, '$5', /yourself/],
    [A, B, '   ', /required/],
    [A, B, 'x'.repeat(141), /too long/],
  ])('rejects invalid input (%s vs %s)', (from, to, prize, msg) => {
    expect(() => createChallenge(from, to, prize)).toThrow(msg);
  });
});

describe('transition', () => {
  const fresh = () => createChallenge(A, B, 'Loser buys lunch');

  it('lets the opponent accept and notifies the challenger', () => {
    const result = transition(fresh(), { type: 'accept' }, B);
    expect(result).toMatchObject({
      ok: true,
      notifyUserId: A,
      state: { status: 'accepted', turnUserId: null },
    });
  });

  it('lets the opponent decline', () => {
    expect(apply(fresh(), { type: 'decline' }, B).status).toBe('declined');
  });

  it('supports counteroffers back and forth', () => {
    let s = apply(fresh(), { type: 'counter', prize: 'Loser buys dinner' }, B);
    expect(s).toMatchObject({ status: 'countered', prize: 'Loser buys dinner', turnUserId: A });
    s = apply(s, { type: 'counter', prize: 'Loser buys drinks' }, A);
    expect(s.turnUserId).toBe(B);
    s = apply(s, { type: 'accept' }, B);
    expect(s).toMatchObject({ status: 'accepted', prize: 'Loser buys drinks' });
  });

  it('rejects moves out of turn', () => {
    expectError(fresh(), { type: 'accept' }, A, /Waiting/);
    expectError(fresh(), { type: 'decline' }, A, /Waiting/);
    expectError(fresh(), { type: 'counter', prize: 'x' }, A, /Waiting/);
  });

  it('rejects outsiders', () => {
    expectError(fresh(), { type: 'accept' }, C, /not part/);
  });

  it('validates counter prizes', () => {
    expectError(fresh(), { type: 'counter', prize: ' ' }, B, /required/);
    expectError(fresh(), { type: 'counter', prize: 'y'.repeat(141) }, B, /too long/);
    expectError(fresh(), { type: 'counter', prize: 'Loser buys lunch' }, B, /change the prize/);
  });

  it('lets the waiting player cancel, but not the player whose turn it is', () => {
    expect(apply(fresh(), { type: 'cancel' }, A).status).toBe('cancelled');
    expectError(fresh(), { type: 'cancel' }, B, /Decline/);
  });

  it('does not allow negotiation after acceptance', () => {
    const accepted = apply(fresh(), { type: 'accept' }, B);
    expectError(accepted, { type: 'accept' }, B, /accepted/);
    expectError(accepted, { type: 'counter', prize: 'z' }, B, /accepted/);
    expectError(accepted, { type: 'cancel' }, A, /accepted/);
  });

  describe('results', () => {
    const accepted = () => apply(fresh(), { type: 'accept' }, B);

    it('report → confirm completes the challenge', () => {
      let s = apply(accepted(), { type: 'report', winnerId: A }, A);
      expect(s).toMatchObject({ status: 'result_reported', winnerId: A, turnUserId: B });
      expectError(s, { type: 'confirm' }, A, /other player/);
      s = apply(s, { type: 'confirm' }, B);
      expect(s).toMatchObject({ status: 'completed', winnerId: A, turnUserId: null });
    });

    it('dispute sends the challenge back to accepted', () => {
      const reported = apply(accepted(), { type: 'report', winnerId: B }, B);
      const disputed = apply(reported, { type: 'dispute' }, A);
      expect(disputed).toMatchObject({ status: 'accepted', winnerId: null });
    });

    it('rejects bad reports', () => {
      expectError(fresh(), { type: 'report', winnerId: A }, A, /accepted/);
      expectError(accepted(), { type: 'report', winnerId: C }, A, /Winner/);
      expectError(accepted(), { type: 'confirm' }, A, /no result/);
    });
  });
});

describe('availableActions', () => {
  const fresh = createChallenge(A, B, '$10');
  it.each<[string, ChallengeState, string, string[]]>([
    ['opponent on pending', fresh, B, ['accept', 'counter', 'decline']],
    ['challenger on pending', fresh, A, ['cancel']],
    ['outsider', fresh, C, []],
    ['accepted', { ...fresh, status: 'accepted', turnUserId: null }, A, ['report']],
    ['reviewer', { ...fresh, status: 'result_reported', turnUserId: A }, A, ['confirm', 'dispute']],
    ['reporter', { ...fresh, status: 'result_reported', turnUserId: A }, B, []],
    ['completed', { ...fresh, status: 'completed', turnUserId: null }, A, []],
  ])('%s', (_label, state, user, expected) => {
    expect(availableActions(state, user)).toEqual(expected);
  });
});

describe('headToHeadRecords', () => {
  it('counts only completed challenges involving the user', () => {
    const base = { challengerId: A, opponentId: B };
    const records = headToHeadRecords(A, [
      { ...base, status: 'completed', winnerId: A },
      { ...base, status: 'completed', winnerId: B },
      { challengerId: C, opponentId: A, status: 'completed', winnerId: A },
      { ...base, status: 'accepted', winnerId: null },
      { ...base, status: 'completed', winnerId: null },
      { challengerId: B, opponentId: C, status: 'completed', winnerId: B },
    ]);
    expect(records.get(B)).toEqual({ wins: 1, losses: 1 });
    expect(records.get(C)).toEqual({ wins: 1, losses: 0 });
    expect(records.size).toBe(2);
  });
});
