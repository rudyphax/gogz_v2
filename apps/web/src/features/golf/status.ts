import type { ChallengeDto } from '@gogz/shared';

export type Tone = 'stone' | 'green' | 'amber' | 'red' | 'blue';

export function opponentOf(c: ChallengeDto, meId: string) {
  return c.challenger.id === meId ? c.opponent : c.challenger;
}

/** Short status from the viewer's point of view. */
export function describeStatus(c: ChallengeDto, meId: string): { label: string; tone: Tone } {
  const myTurn = c.turnUserId === meId;
  switch (c.status) {
    case 'pending':
      return myTurn ? { label: 'Respond', tone: 'amber' } : { label: 'Sent', tone: 'blue' };
    case 'countered':
      return myTurn
        ? { label: 'Counteroffer', tone: 'amber' }
        : { label: 'Countered', tone: 'blue' };
    case 'accepted':
      return { label: 'On', tone: 'green' };
    case 'result_reported':
      return myTurn
        ? { label: 'Confirm result', tone: 'amber' }
        : { label: 'Awaiting confirmation', tone: 'blue' };
    case 'completed':
      return c.winnerId === meId ? { label: 'Won', tone: 'green' } : { label: 'Lost', tone: 'red' };
    case 'declined':
      return { label: 'Declined', tone: 'stone' };
    case 'cancelled':
      return { label: 'Withdrawn', tone: 'stone' };
  }
}

export type Group = 'yourMove' | 'waiting' | 'live' | 'history';

export function groupOf(c: ChallengeDto, meId: string): Group {
  if (c.turnUserId === meId) return 'yourMove';
  if (c.status === 'accepted') return 'live';
  if (c.turnUserId) return 'waiting';
  return 'history';
}
