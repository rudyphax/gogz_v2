import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { allowedEmails, users, type User } from '../db/schema.js';
import type { GoogleProfile } from './google.js';

export type LoginResult =
  { ok: true; user: User } | { ok: false; reason: 'not_invited' | 'unverified' };

export async function isAllowed(db: Db, email: string) {
  const [row] = await db
    .select()
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email.toLowerCase()));
  return row ?? null;
}

/**
 * The only way an account gets created: a verified Google email that is on
 * the allowlist. Existing users are re-checked so removing someone from the
 * allowlist locks them out.
 */
export async function completeGoogleLogin(db: Db, profile: GoogleProfile): Promise<LoginResult> {
  if (!profile.emailVerified) return { ok: false, reason: 'unverified' };
  const email = profile.email.toLowerCase();
  const allowed = await isAllowed(db, email);
  if (!allowed) return { ok: false, reason: 'not_invited' };

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { ok: true, user: existing };

  const [created] = await db
    .insert(users)
    .values({
      email,
      firstName: profile.givenName,
      lastName: profile.familyName,
      displayName: profile.givenName || profile.name || email.split('@')[0]!,
      role: allowed.role,
    })
    .returning();
  return { ok: true, user: created! };
}
