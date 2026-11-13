import type { ChallengeDto, Friend, SessionSummaryDto } from '@gogz/shared';
import { groupOf } from '../golf/status';

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Monday 00:00 of the week containing `d` (local time). */
export function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function gymWeek(sessions: SessionSummaryDto[], now: Date) {
  const done = sessions.filter((s) => s.completedAt);
  const weekStart = startOfWeek(now).getTime();
  const thisWeek = done.filter((s) => new Date(s.completedAt!).getTime() >= weekStart);

  // Streak: consecutive weeks (ending this week or last) with at least one workout.
  const weeks = new Set(done.map((s) => startOfWeek(new Date(s.completedAt!)).getTime()));
  const week = 7 * 24 * 60 * 60 * 1000;
  let cursor = weeks.has(weekStart) ? weekStart : weekStart - week;
  let streak = 0;
  // Step back a calendar week at a time (DST-safe via startOfWeek on a mid-week date).
  while (weeks.has(cursor)) {
    streak++;
    cursor = startOfWeek(new Date(cursor - 3 * 24 * 60 * 60 * 1000)).getTime();
  }

  return {
    workouts: thisWeek.length,
    sets: thisWeek.reduce((n, s) => n + s.setCount, 0),
    streak,
  };
}

export function golfSummary(friends: Friend[], challenges: ChallengeDto[], meId: string) {
  const wins = friends.reduce((n, f) => n + f.record.wins, 0);
  const losses = friends.reduce((n, f) => n + f.record.losses, 0);
  const open = challenges.filter((c) => groupOf(c, meId) !== 'history').length;
  return { wins, losses, open };
}

/** The challenge most worth showing: your move first, then live matches, then waiting. */
export function featuredChallenge(challenges: ChallengeDto[], meId: string) {
  for (const g of ['yourMove', 'live', 'waiting'] as const) {
    const c = challenges.find((x) => groupOf(x, meId) === g);
    if (c) return c;
  }
  return null;
}
