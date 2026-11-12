import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise, type Equipment } from './exercises.js';
import { generatePlan, ruleBasedGenerator, validateGeneratorInput } from './generate.js';

const fullGym: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine'];

describe('exercise library', () => {
  it('has unique slugs', () => {
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
  });

  it('looks up by slug', () => {
    expect(getExercise('deadlift')?.name).toBe('Deadlift');
    expect(getExercise('nope')).toBeUndefined();
  });
});

describe('generatePlan', () => {
  it.each([
    [2, 'full_body', ['Full Body A', 'Full Body B']],
    [3, 'full_body', ['Full Body A', 'Full Body B', 'Full Body C']],
    [4, 'upper_lower', ['Upper A', 'Lower A', 'Upper B', 'Lower B']],
    [5, 'ppl_upper_lower', ['Push', 'Pull', 'Legs', 'Upper', 'Lower']],
    [6, 'push_pull_legs', ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B']],
  ])('%i days → %s split', (days, split, names) => {
    const plan = generatePlan({ goal: 'hypertrophy', daysPerWeek: days, equipment: fullGym });
    expect(plan.split).toBe(split);
    expect(plan.days.map((d) => d.name)).toEqual(names);
    expect(plan.name).toContain(`${days}x/week`);
  });

  it('is deterministic', () => {
    const input = { goal: 'strength' as const, daysPerWeek: 4, equipment: fullGym };
    expect(generatePlan(input)).toEqual(generatePlan(input));
  });

  it('only uses exercises the equipment allows (bodyweight always allowed)', () => {
    const plan = generatePlan({ goal: 'hypertrophy', daysPerWeek: 3, equipment: ['dumbbell'] });
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThan(3);
      for (const e of day.exercises) {
        const eq = getExercise(e.exerciseSlug)!.equipment;
        expect(eq.some((x) => x === 'dumbbell' || x === 'bodyweight')).toBe(true);
      }
    }
  });

  it('never repeats an exercise within a day', () => {
    const plan = generatePlan({ goal: 'hypertrophy', daysPerWeek: 6, equipment: fullGym });
    for (const day of plan.days) {
      const slugs = day.exercises.map((e) => e.exerciseSlug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('varies repeated day types', () => {
    const plan = generatePlan({ goal: 'hypertrophy', daysPerWeek: 4, equipment: fullGym });
    expect(plan.days[0]!.exercises[0]!.exerciseSlug).not.toBe(
      plan.days[2]!.exercises[0]!.exerciseSlug,
    );
  });

  it('uses goal-specific rep ranges', () => {
    const strength = generatePlan({ goal: 'strength', daysPerWeek: 3, equipment: fullGym });
    expect(strength.days[0]!.exercises[0]).toMatchObject({ sets: 5, repMin: 3, repMax: 5 });
    const endurance = generatePlan({ goal: 'endurance', daysPerWeek: 3, equipment: fullGym });
    expect(endurance.days[0]!.exercises[0]).toMatchObject({ repMin: 15, repMax: 20 });
  });

  it('adds rotational work for golf', () => {
    const plan = generatePlan({ goal: 'golf', daysPerWeek: 3, equipment: fullGym });
    for (const day of plan.days) {
      expect(day.exercises.some((e) => getExercise(e.exerciseSlug)!.pattern === 'rotation')).toBe(
        true,
      );
    }
  });

  it('rejects invalid input', () => {
    expect(() => generatePlan({ goal: 'golf', daysPerWeek: 7, equipment: fullGym })).toThrow(
      /between/,
    );
    expect(() => generatePlan({ goal: 'golf', daysPerWeek: 3, equipment: [] })).toThrow(
      /equipment/,
    );
    expect(validateGeneratorInput({ goal: 'golf', daysPerWeek: 2.5, equipment: fullGym })).toMatch(
      /between/,
    );
  });

  it('exposes an async generator interface', async () => {
    const plan = await ruleBasedGenerator.generate({
      goal: 'golf',
      daysPerWeek: 2,
      equipment: ['bands'],
    });
    expect(plan.days).toHaveLength(2);
  });
});
