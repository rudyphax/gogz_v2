export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
  'bands',
  'bodyweight',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'biceps',
  'triceps',
  'calves',
  'core',
  'rotation',
] as const;
export type MovementPattern = (typeof PATTERNS)[number];

export interface Exercise {
  slug: string;
  name: string;
  pattern: MovementPattern;
  /** Any one of these is enough to perform the exercise. */
  equipment: Equipment[];
  compound: boolean;
}

const ex = (
  slug: string,
  name: string,
  pattern: MovementPattern,
  equipment: Equipment[],
  compound = true,
): Exercise => ({ slug, name, pattern, equipment, compound });

/** Ordered by preference: the generator picks earlier entries first. */
export const EXERCISES: readonly Exercise[] = [
  ex('back-squat', 'Barbell Back Squat', 'squat', ['barbell']),
  ex('front-squat', 'Front Squat', 'squat', ['barbell']),
  ex('goblet-squat', 'Goblet Squat', 'squat', ['dumbbell', 'kettlebell']),
  ex('leg-press', 'Leg Press', 'squat', ['machine']),
  ex('bodyweight-squat', 'Bodyweight Squat', 'squat', ['bodyweight', 'bands']),

  ex('deadlift', 'Deadlift', 'hinge', ['barbell']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'hinge', ['barbell', 'dumbbell']),
  ex('kettlebell-swing', 'Kettlebell Swing', 'hinge', ['kettlebell']),
  ex('glute-bridge', 'Glute Bridge', 'hinge', ['bodyweight', 'bands']),

  ex('walking-lunge', 'Walking Lunge', 'lunge', ['dumbbell', 'bodyweight']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'lunge', ['dumbbell', 'bodyweight']),
  ex('reverse-lunge', 'Reverse Lunge', 'lunge', ['barbell', 'kettlebell']),

  ex('bench-press', 'Bench Press', 'horizontal_push', ['barbell']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'horizontal_push', ['dumbbell']),
  ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'horizontal_push', ['dumbbell']),
  ex('machine-chest-press', 'Machine Chest Press', 'horizontal_push', ['machine']),
  ex('push-up', 'Push-up', 'horizontal_push', ['bodyweight', 'bands']),

  ex('overhead-press', 'Overhead Press', 'vertical_push', ['barbell']),
  ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'vertical_push', ['dumbbell']),
  ex('landmine-press', 'Half-kneeling Landmine Press', 'vertical_push', ['barbell']),
  ex('pike-push-up', 'Pike Push-up', 'vertical_push', ['bodyweight']),
  ex('kettlebell-press', 'Kettlebell Press', 'vertical_push', ['kettlebell']),

  ex('barbell-row', 'Barbell Row', 'horizontal_pull', ['barbell']),
  ex('dumbbell-row', 'One-arm Dumbbell Row', 'horizontal_pull', ['dumbbell']),
  ex('seated-cable-row', 'Seated Cable Row', 'horizontal_pull', ['cable', 'machine']),
  ex('band-row', 'Band Row', 'horizontal_pull', ['bands']),
  ex('inverted-row', 'Inverted Row', 'horizontal_pull', ['bodyweight']),

  ex('pull-up', 'Pull-up', 'vertical_pull', ['bodyweight']),
  ex('lat-pulldown', 'Lat Pulldown', 'vertical_pull', ['cable', 'machine']),
  ex('band-pulldown', 'Band Pulldown', 'vertical_pull', ['bands']),

  ex('dumbbell-curl', 'Dumbbell Curl', 'biceps', ['dumbbell'], false),
  ex('barbell-curl', 'Barbell Curl', 'biceps', ['barbell'], false),
  ex('cable-curl', 'Cable Curl', 'biceps', ['cable', 'bands'], false),

  ex('triceps-pushdown', 'Triceps Pushdown', 'triceps', ['cable', 'bands'], false),
  ex('overhead-triceps-extension', 'Overhead Triceps Extension', 'triceps', ['dumbbell'], false),
  ex('bench-dip', 'Bench Dip', 'triceps', ['bodyweight'], false),
  ex('skull-crusher', 'Skull Crusher', 'triceps', ['barbell'], false),

  ex(
    'standing-calf-raise',
    'Standing Calf Raise',
    'calves',
    ['machine', 'dumbbell', 'bodyweight'],
    false,
  ),

  ex('plank', 'Plank', 'core', ['bodyweight'], false),
  ex('dead-bug', 'Dead Bug', 'core', ['bodyweight'], false),
  ex('hanging-knee-raise', 'Hanging Knee Raise', 'core', ['bodyweight'], false),

  ex('cable-woodchop', 'Cable Woodchop', 'rotation', ['cable', 'bands'], false),
  ex('pallof-press', 'Pallof Press', 'rotation', ['cable', 'bands'], false),
  ex('med-ball-rotational-throw', 'Rotational Med-ball Throw', 'rotation', ['bodyweight'], false),
  ex('russian-twist', 'Russian Twist', 'rotation', ['dumbbell', 'kettlebell', 'bodyweight'], false),
];

const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

export function getExercise(slug: string): Exercise | undefined {
  return bySlug.get(slug);
}
