import { z } from 'zod';
import { MAX_PRIZE_LENGTH } from './challenge.js';
import { EQUIPMENT } from './workouts/exercises.js';
import { GOALS, MAX_DAYS, MIN_DAYS } from './workouts/generate.js';

/** Normalizes US numbers to E.164; accepts anything already in +E.164 form. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/[\s().-]/g, '');
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

const name = z.string().trim().min(1, 'Required').max(50);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

export const updateProfileSchema = z.object({
  firstName: name,
  lastName: z.string().trim().max(50),
  displayName: name,
  /** Blank or null clears the number. */
  phone: z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null || value.trim() === '') return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
        return z.NEVER;
      }
      return phone;
    }),
  smsOptIn: z.boolean(),
  email: emailSchema.optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const MIN_PASSWORD_LENGTH = 10;
export const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const prizeSchema = z.string().trim().min(1, 'Enter a prize').max(MAX_PRIZE_LENGTH);

export const createChallengeSchema = z.object({
  opponentId: z.uuid(),
  prize: prizeSchema,
});

export const challengeActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('accept') }),
  z.object({ type: z.literal('decline') }),
  z.object({ type: z.literal('cancel') }),
  z.object({ type: z.literal('confirm') }),
  z.object({ type: z.literal('dispute') }),
  z.object({ type: z.literal('counter'), prize: prizeSchema }),
  z.object({ type: z.literal('report'), winnerId: z.uuid() }),
]);

export const createPlanSchema = z.object({
  goal: z.enum(GOALS),
  daysPerWeek: z.number().int().min(MIN_DAYS).max(MAX_DAYS),
  equipment: z.array(z.enum(EQUIPMENT)).min(1, 'Pick at least one equipment option'),
  name: z.string().trim().max(80).optional(),
});

export const saveSetsSchema = z.object({
  sets: z
    .array(
      z.object({
        exerciseSlug: z.string().min(1).max(80),
        setNumber: z.number().int().min(1).max(20),
        reps: z.number().int().min(0).max(200),
        weight: z.number().min(0).max(2000),
      }),
    )
    .max(200),
});

export const addAllowedEmailSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member']).default('member'),
});
