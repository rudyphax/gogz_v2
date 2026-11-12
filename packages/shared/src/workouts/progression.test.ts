import { describe, expect, it } from 'vitest';
import { bestSet, estimatedOneRepMax, suggestNext, weightIncrement } from './progression.js';

const range = { repMin: 8, repMax: 12 };

describe('weightIncrement', () => {
  it('scales with the movement', () => {
    expect(weightIncrement('back-squat')).toBe(10);
    expect(weightIncrement('bench-press')).toBe(5);
    expect(weightIncrement('dumbbell-curl')).toBe(2.5);
    expect(weightIncrement('unknown')).toBe(5);
  });
});

describe('suggestNext', () => {
  it('returns null with no history', () => {
    expect(suggestNext('bench-press', range, [])).toBeNull();
    expect(suggestNext('bench-press', range, [{ reps: 0, weight: 100 }])).toBeNull();
  });

  it('adds weight when every set hits the top of the range', () => {
    const s = suggestNext('bench-press', range, [
      { reps: 12, weight: 135 },
      { reps: 12, weight: 135 },
    ]);
    expect(s).toMatchObject({ weight: 140, reps: 8 });
  });

  it('adds a rep when inside the range', () => {
    expect(
      suggestNext('bench-press', range, [
        { reps: 10, weight: 135 },
        { reps: 9, weight: 135 },
      ]),
    ).toMatchObject({ weight: 135, reps: 10 });
  });

  it('ignores lighter warm-up sets', () => {
    expect(
      suggestNext('bench-press', range, [
        { reps: 5, weight: 95 },
        { reps: 12, weight: 135 },
      ]),
    ).toMatchObject({ weight: 140 });
  });

  it('builds back to the bottom of the range after a miss', () => {
    expect(suggestNext('bench-press', range, [{ reps: 6, weight: 135 }])).toMatchObject({
      weight: 135,
      reps: 8,
    });
  });

  it('progresses bodyweight moves by reps, capped at the top of the range', () => {
    expect(suggestNext('push-up', range, [{ reps: 10, weight: 0 }])).toMatchObject({
      reps: 11,
      weight: 0,
    });
    expect(suggestNext('push-up', range, [{ reps: 15, weight: 0 }])).toMatchObject({ reps: 12 });
  });
});

describe('estimatedOneRepMax', () => {
  it('uses the Epley formula', () => {
    expect(estimatedOneRepMax(100, 10)).toBe(133.3);
    expect(estimatedOneRepMax(225, 1)).toBe(225);
    expect(estimatedOneRepMax(0, 5)).toBe(0);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
  });
});

describe('bestSet', () => {
  it('picks the highest estimated 1RM', () => {
    expect(
      bestSet([
        { reps: 10, weight: 100 },
        { reps: 3, weight: 115 },
        { reps: 0, weight: 300 },
      ]),
    ).toMatchObject({ weight: 100, reps: 10 });
  });

  it('breaks ties toward heavier weight and handles empty input', () => {
    expect(bestSet([])).toBeNull();
    expect(
      bestSet([
        { reps: 5, weight: 0 },
        { reps: 6, weight: 0 },
      ]),
    ).toMatchObject({ reps: 5, weight: 0 });
  });
});
