import { EXERCISES, type Equipment, type Exercise, type MovementPattern } from './exercises.js';

export const GOALS = ['strength', 'hypertrophy', 'endurance', 'golf'] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  strength: 'Strength',
  hypertrophy: 'Muscle growth',
  endurance: 'Muscular endurance',
  golf: 'Golf performance',
};

export const MIN_DAYS = 2;
export const MAX_DAYS = 6;

export interface GeneratorInput {
  goal: Goal;
  daysPerWeek: number;
  equipment: Equipment[];
}

export interface PlannedExercise {
  exerciseSlug: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface PlannedDay {
  name: string;
  exercises: PlannedExercise[];
}

export interface GeneratedPlan {
  name: string;
  split: SplitName;
  days: PlannedDay[];
}

/** Lets an AI-backed generator be swapped in later without touching callers. */
export interface WorkoutGenerator {
  generate(input: GeneratorInput): Promise<GeneratedPlan>;
}

export type SplitName = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'ppl_upper_lower';
type DayType = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

const DAY_TEMPLATES: Record<DayType, { label: string; slots: MovementPattern[] }> = {
  full: {
    label: 'Full Body',
    slots: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'vertical_push', 'core'],
  },
  upper: {
    label: 'Upper',
    slots: [
      'horizontal_push',
      'horizontal_pull',
      'vertical_push',
      'vertical_pull',
      'biceps',
      'triceps',
    ],
  },
  lower: { label: 'Lower', slots: ['squat', 'hinge', 'lunge', 'calves', 'core'] },
  push: {
    label: 'Push',
    slots: ['horizontal_push', 'vertical_push', 'horizontal_push', 'triceps'],
  },
  pull: { label: 'Pull', slots: ['vertical_pull', 'horizontal_pull', 'horizontal_pull', 'biceps'] },
  legs: { label: 'Legs', slots: ['squat', 'hinge', 'lunge', 'calves', 'core'] },
};

const SPLITS: Record<number, { split: SplitName; days: DayType[] }> = {
  2: { split: 'full_body', days: ['full', 'full'] },
  3: { split: 'full_body', days: ['full', 'full', 'full'] },
  4: { split: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower'] },
  5: { split: 'ppl_upper_lower', days: ['push', 'pull', 'legs', 'upper', 'lower'] },
  6: { split: 'push_pull_legs', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
};

interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
}

const PRESCRIPTIONS: Record<Goal, { compound: Prescription; accessory: Prescription }> = {
  strength: {
    compound: { sets: 5, repMin: 3, repMax: 5 },
    accessory: { sets: 3, repMin: 8, repMax: 10 },
  },
  hypertrophy: {
    compound: { sets: 4, repMin: 8, repMax: 12 },
    accessory: { sets: 3, repMin: 10, repMax: 15 },
  },
  endurance: {
    compound: { sets: 3, repMin: 15, repMax: 20 },
    accessory: { sets: 2, repMin: 15, repMax: 20 },
  },
  golf: {
    compound: { sets: 3, repMin: 6, repMax: 10 },
    accessory: { sets: 3, repMin: 10, repMax: 12 },
  },
};

const LETTERS = 'ABC';

export function validateGeneratorInput(input: GeneratorInput): string | null {
  if (
    !Number.isInteger(input.daysPerWeek) ||
    input.daysPerWeek < MIN_DAYS ||
    input.daysPerWeek > MAX_DAYS
  ) {
    return `Days per week must be between ${MIN_DAYS} and ${MAX_DAYS}`;
  }
  if (input.equipment.length === 0) return 'Pick at least one equipment option';
  return null;
}

/**
 * Deterministic, rule-based plan generator. Each slot in a day template is
 * filled with the first exercise for that movement pattern that the user's
 * equipment allows. Repeated day types (Upper A / Upper B) rotate through
 * the alternatives so the week isn't the same session twice.
 */
export function generatePlan(input: GeneratorInput): GeneratedPlan {
  const error = validateGeneratorInput(input);
  if (error) throw new Error(error);

  const available = new Set<Equipment>([...input.equipment, 'bodyweight']);
  const usable = (e: Exercise) => e.equipment.some((eq) => available.has(eq));
  const { split, days } = SPLITS[input.daysPerWeek]!;
  const prescription = PRESCRIPTIONS[input.goal];
  const occurrence = new Map<DayType, number>();

  const plannedDays = days.map((dayType) => {
    const n = occurrence.get(dayType) ?? 0;
    occurrence.set(dayType, n + 1);
    const repeats = days.filter((d) => d === dayType).length > 1;
    const template = DAY_TEMPLATES[dayType];
    const slots: MovementPattern[] =
      input.goal === 'golf' ? [...template.slots, 'rotation'] : template.slots;

    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const pattern of slots) {
      const candidates = EXERCISES.filter(
        (e) => e.pattern === pattern && usable(e) && !used.has(e.slug),
      );
      if (candidates.length === 0) continue;
      const pick = candidates[n % candidates.length]!;
      used.add(pick.slug);
      // Compound lifts get the goal's main prescription; isolation work gets the accessory one.
      const p = pick.compound ? prescription.compound : prescription.accessory;
      exercises.push({ exerciseSlug: pick.slug, ...p });
    }

    return {
      name: repeats ? `${template.label} ${LETTERS[n]}` : template.label,
      exercises,
    };
  });

  const splitLabel: Record<SplitName, string> = {
    full_body: 'Full Body',
    upper_lower: 'Upper/Lower',
    push_pull_legs: 'Push/Pull/Legs',
    ppl_upper_lower: 'PPL + Upper/Lower',
  };

  return {
    name: `${GOAL_LABELS[input.goal]} · ${splitLabel[split]} (${input.daysPerWeek}x/week)`,
    split,
    days: plannedDays,
  };
}

export const ruleBasedGenerator: WorkoutGenerator = {
  generate: (input) => Promise.resolve(generatePlan(input)),
};
