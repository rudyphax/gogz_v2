import { describe, expect, it } from 'vitest';
import {
  challengeActionSchema,
  createPlanSchema,
  emailSchema,
  normalizePhone,
  setPasswordSchema,
  updateProfileSchema,
} from './schemas.js';

describe('normalizePhone', () => {
  it.each([
    ['(555) 123-4567', '+15551234567'],
    ['1-555-123-4567', '+15551234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['123', null],
    ['+0123', null],
    ['555 123 456 789', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe('updateProfileSchema', () => {
  const base = { firstName: 'Tiger', lastName: 'W', displayName: 'Tiger', smsOptIn: true };

  it('normalizes phone numbers and empties to null', () => {
    expect(updateProfileSchema.parse({ ...base, phone: '555-123-4567' }).phone).toBe(
      '+15551234567',
    );
    expect(updateProfileSchema.parse({ ...base, phone: '' }).phone).toBeNull();
    expect(updateProfileSchema.parse({ ...base, phone: null }).phone).toBeNull();
  });

  it('rejects bad phone numbers and blank names', () => {
    expect(updateProfileSchema.safeParse({ ...base, phone: '12' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...base, firstName: ' ', phone: null }).success).toBe(
      false,
    );
    // Google accounts don't always have a last name.
    expect(updateProfileSchema.safeParse({ ...base, lastName: '', phone: null }).success).toBe(
      true,
    );
  });
});

it('lowercases emails', () => {
  expect(emailSchema.parse(' Tiger@Example.COM ')).toBe('tiger@example.com');
  expect(emailSchema.safeParse('nope').success).toBe(false);
});

it('requires long passwords', () => {
  expect(setPasswordSchema.safeParse({ newPassword: 'short' }).success).toBe(false);
  expect(setPasswordSchema.safeParse({ newPassword: 'long-enough-pw' }).success).toBe(true);
});

it('validates challenge actions', () => {
  expect(challengeActionSchema.safeParse({ type: 'counter', prize: '$50' }).success).toBe(true);
  expect(challengeActionSchema.safeParse({ type: 'counter' }).success).toBe(false);
  expect(challengeActionSchema.safeParse({ type: 'explode' }).success).toBe(false);
});

it('validates plan input', () => {
  expect(
    createPlanSchema.safeParse({ goal: 'golf', daysPerWeek: 3, equipment: ['dumbbell'] }).success,
  ).toBe(true);
  expect(
    createPlanSchema.safeParse({ goal: 'golf', daysPerWeek: 9, equipment: ['dumbbell'] }).success,
  ).toBe(false);
});
