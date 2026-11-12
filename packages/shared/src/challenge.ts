/**
 * Golf challenge state machine.
 *
 * Flow: pending ⇄ countered → accepted → result_reported → completed
 * A challenge can also end as declined or cancelled before it is accepted.
 * `turnUserId` is the player who must act next (null when nobody owes a move).
 */

export const CHALLENGE_STATUSES = [
  'pending',
  'countered',
  'accepted',
  'declined',
  'cancelled',
  'result_reported',
  'completed',
] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export interface ChallengeState {
  status: ChallengeStatus;
  prize: string;
  challengerId: string;
  opponentId: string;
  turnUserId: string | null;
  winnerId: string | null;
}

export type ChallengeAction =
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'counter'; prize: string }
  | { type: 'cancel' }
  | { type: 'report'; winnerId: string }
  | { type: 'confirm' }
  | { type: 'dispute' };

export type ChallengeActionType = ChallengeAction['type'];

export type TransitionResult =
  | {
      ok: true;
      state: ChallengeState;
      /** User who should be told about this change (gets an SMS). */
      notifyUserId: string;
    }
  | { ok: false; error: string };

export const MAX_PRIZE_LENGTH = 140;

export function createChallenge(
  challengerId: string,
  opponentId: string,
  prize: string,
): ChallengeState {
  const trimmed = prize.trim();
  if (challengerId === opponentId) throw new Error('You cannot challenge yourself');
  if (!trimmed) throw new Error('Prize is required');
  if (trimmed.length > MAX_PRIZE_LENGTH) throw new Error('Prize is too long');
  return {
    status: 'pending',
    prize: trimmed,
    challengerId,
    opponentId,
    turnUserId: opponentId,
    winnerId: null,
  };
}

export function otherParticipant(state: ChallengeState, userId: string): string {
  return userId === state.challengerId ? state.opponentId : state.challengerId;
}

export function isParticipant(state: ChallengeState, userId: string): boolean {
  return userId === state.challengerId || userId === state.opponentId;
}

const fail = (error: string): TransitionResult => ({ ok: false, error });

export function transition(
  state: ChallengeState,
  action: ChallengeAction,
  actorId: string,
): TransitionResult {
  if (!isParticipant(state, actorId)) return fail('You are not part of this challenge');
  const other = otherParticipant(state, actorId);
  const negotiating = state.status === 'pending' || state.status === 'countered';
  const myTurn = state.turnUserId === actorId;

  switch (action.type) {
    case 'accept':
    case 'decline': {
      if (!negotiating) return fail(`Cannot ${action.type} a challenge that is ${state.status}`);
      if (!myTurn) return fail('Waiting on the other player');
      return {
        ok: true,
        state: {
          ...state,
          status: action.type === 'accept' ? 'accepted' : 'declined',
          turnUserId: null,
        },
        notifyUserId: other,
      };
    }
    case 'counter': {
      if (!negotiating) return fail(`Cannot counter a challenge that is ${state.status}`);
      if (!myTurn) return fail('Waiting on the other player');
      const prize = action.prize.trim();
      if (!prize) return fail('Prize is required');
      if (prize.length > MAX_PRIZE_LENGTH) return fail('Prize is too long');
      if (prize === state.prize) return fail('A counteroffer must change the prize');
      return {
        ok: true,
        state: { ...state, status: 'countered', prize, turnUserId: other },
        notifyUserId: other,
      };
    }
    case 'cancel': {
      if (!negotiating) return fail(`Cannot cancel a challenge that is ${state.status}`);
      if (myTurn) return fail('Decline the offer instead of cancelling it');
      return {
        ok: true,
        state: { ...state, status: 'cancelled', turnUserId: null },
        notifyUserId: other,
      };
    }
    case 'report': {
      if (state.status !== 'accepted') return fail('Only accepted challenges can be reported');
      if (!isParticipant(state, action.winnerId)) return fail('Winner must be one of the players');
      return {
        ok: true,
        state: {
          ...state,
          status: 'result_reported',
          winnerId: action.winnerId,
          turnUserId: other,
        },
        notifyUserId: other,
      };
    }
    case 'confirm':
    case 'dispute': {
      if (state.status !== 'result_reported') return fail('There is no result to review');
      if (!myTurn) return fail('The other player must review the result');
      return {
        ok: true,
        state:
          action.type === 'confirm'
            ? { ...state, status: 'completed', turnUserId: null }
            : { ...state, status: 'accepted', winnerId: null, turnUserId: null },
        notifyUserId: other,
      };
    }
  }
}

/** Actions the given user may take right now (drives which buttons the UI shows). */
export function availableActions(state: ChallengeState, userId: string): ChallengeActionType[] {
  if (!isParticipant(state, userId)) return [];
  const myTurn = state.turnUserId === userId;
  switch (state.status) {
    case 'pending':
    case 'countered':
      return myTurn ? ['accept', 'counter', 'decline'] : ['cancel'];
    case 'accepted':
      return ['report'];
    case 'result_reported':
      return myTurn ? ['confirm', 'dispute'] : [];
    default:
      return [];
  }
}

export interface HeadToHead {
  wins: number;
  losses: number;
}

/** Tally completed challenges between `userId` and each opponent. */
export function headToHeadRecords(
  userId: string,
  challenges: Pick<ChallengeState, 'status' | 'challengerId' | 'opponentId' | 'winnerId'>[],
): Map<string, HeadToHead> {
  const records = new Map<string, HeadToHead>();
  for (const c of challenges) {
    if (c.status !== 'completed' || !c.winnerId) continue;
    if (c.challengerId !== userId && c.opponentId !== userId) continue;
    const opponent = c.challengerId === userId ? c.opponentId : c.challengerId;
    const record = records.get(opponent) ?? { wins: 0, losses: 0 };
    if (c.winnerId === userId) record.wins += 1;
    else record.losses += 1;
    records.set(opponent, record);
  }
  return records;
}
