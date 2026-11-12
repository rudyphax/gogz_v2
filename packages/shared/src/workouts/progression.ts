import { getExercise } from './exercises.js';

export interface LoggedSet {
  reps: number;
  weight: number;
}

export interface Suggestion {
  weight: number;
  reps: number;
  reason: string;
}

/** Weight jump (lb) once every set reaches the top of the rep range. */
export function weightIncrement(exerciseSlug: string): number {
  const exercise = getExercise(exerciseSlug);
  if (!exercise) return 5;
  if (!exercise.compound) return 2.5;
  return ['squat', 'hinge'].includes(exercise.pattern) ? 10 : 5;
}

/**
 * Double progression: add reps inside the target range, then add weight and
 * drop back to the bottom of the range once every set hits the top.
 */
export function suggestNext(
  exerciseSlug: string,
  target: { repMin: number; repMax: number },
  lastSets: LoggedSet[],
): Suggestion | null {
  const working = lastSets.filter((s) => s.reps > 0);
  if (working.length === 0) return null;

  const topWeight = Math.max(...working.map((s) => s.weight));
  const atTop = working.filter((s) => s.weight === topWeight);
  const minReps = Math.min(...atTop.map((s) => s.reps));

  if (topWeight === 0) {
    return {
      weight: 0,
      reps: Math.min(minReps + 1, target.repMax),
      reason: 'Bodyweight: add a rep',
    };
  }
  if (atTop.every((s) => s.reps >= target.repMax)) {
    const weight = topWeight + weightIncrement(exerciseSlug);
    return {
      weight,
      reps: target.repMin,
      reason: `Hit ${target.repMax} reps on every set: add weight`,
    };
  }
  if (minReps < target.repMin) {
    return {
      weight: topWeight,
      reps: target.repMin,
      reason: `Build back up to ${target.repMin} reps`,
    };
  }
  return { weight: topWeight, reps: minReps + 1, reason: 'Same weight, one more rep' };
}

/** Epley estimated one-rep max. */
export function estimatedOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Best set of a session by estimated 1RM (ties go to the heavier weight). */
export function bestSet(sets: LoggedSet[]): (LoggedSet & { e1rm: number }) | null {
  let best: (LoggedSet & { e1rm: number }) | null = null;
  for (const s of sets) {
    const e1rm = estimatedOneRepMax(s.weight, s.reps);
    if (s.reps <= 0) continue;
    if (!best || e1rm > best.e1rm || (e1rm === best.e1rm && s.weight > best.weight)) {
      best = { ...s, e1rm };
    }
  }
  return best;
}
