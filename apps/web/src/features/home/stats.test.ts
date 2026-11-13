import { describe, expect, it } from 'vitest';
import type { ChallengeDto, Friend, SessionSummaryDto } from '@gogz/shared';
import { featuredChallenge, golfSummary, greeting, gymWeek, startOfWeek } from './stats';

const ME = 'me';
const session = (completedAt: string | null, setCount = 10): SessionSummaryDto => ({
  id: completedAt ?? 'open',
  planDayName: 'Upper A',
  startedAt: completedAt ?? '2026-11-12T10:00:00',
  completedAt,
  setCount,
});
const challenge = (over: Partial<ChallengeDto>): ChallengeDto => ({
  id: 'c',
  status: 'pending',
  prize: 'Lunch',
  challenger: { id: ME, displayName: 'Me', avatarUrl: null },
  opponent: { id: 'bob', displayName: 'Bob', avatarUrl: null },
  turnUserId: 'bob',
  winnerId: null,
  availableActions: [],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting(new Date(2026, 10, 13, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 10, 13, 13))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 10, 13, 21))).toBe('Good evening');
  });
});

describe('gymWeek', () => {
  // Friday 13 Nov 2026; the week starts Monday 9 Nov.
  const now = new Date(2026, 10, 13, 12);

  it('starts weeks on Monday', () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 10, 9));
    expect(startOfWeek(new Date(2026, 10, 15))).toEqual(new Date(2026, 10, 9)); // Sunday
  });

  it('counts this week and the run of active weeks', () => {
    const stats = gymWeek(
      [
        session('2026-11-12T18:00:00', 12),
        session('2026-11-10T18:00:00', 8),
        session(null, 99),
        session('2026-11-04T18:00:00'), // last week
        session('2026-10-28T18:00:00'), // two weeks ago
        session('2026-10-07T18:00:00'), // gap before this
      ],
      now,
    );
    expect(stats).toEqual({ workouts: 2, sets: 20, streak: 3 });
  });

  it('keeps last week’s streak alive before the first workout of the week', () => {
    expect(gymWeek([session('2026-11-04T18:00:00')], now).streak).toBe(1);
    expect(gymWeek([], now)).toEqual({ workouts: 0, sets: 0, streak: 0 });
  });
});

describe('golf', () => {
  it('sums records and open challenges', () => {
    const friends = [
      { record: { wins: 2, losses: 1 } },
      { record: { wins: 0, losses: 3 } },
    ] as Friend[];
    const challenges = [
      challenge({}),
      challenge({ status: 'completed', turnUserId: null, winnerId: ME }),
    ];
    expect(golfSummary(friends, challenges, ME)).toEqual({ wins: 2, losses: 4, open: 1 });
  });

  it('features your move first, then live matches, then waiting', () => {
    const waiting = challenge({ id: 'w' });
    const live = challenge({ id: 'l', status: 'accepted', turnUserId: null });
    const mine = challenge({ id: 'm', turnUserId: ME });
    expect(featuredChallenge([waiting, live, mine], ME)?.id).toBe('m');
    expect(featuredChallenge([waiting, live], ME)?.id).toBe('l');
    expect(featuredChallenge([waiting], ME)?.id).toBe('w');
    expect(featuredChallenge([], ME)).toBeNull();
  });
});
