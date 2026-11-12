import { sql } from 'drizzle-orm';
import { Router, type Response } from 'express';
import type { AppDeps } from '../app.js';
import { completeGoogleLogin } from '../auth/login.js';
import { seedAdmin, seedDemo } from '../db/seed.js';
import { emailSchema } from '@gogz/shared';
import { MemorySmsProvider } from '../services/sms.js';
import { allowedEmails } from '../db/schema.js';

/**
 * Only mounted when NODE_ENV=test. Lets Playwright stand in for Google:
 * it runs the same allowlist check as the real OAuth callback.
 */
export function testingRoutes(
  deps: AppDeps,
  startSession: (res: Response, userId: string) => Promise<void>,
) {
  const { db, sms } = deps;
  const router = Router();

  router.post('/reset', async (req, res) => {
    await db.execute(
      sql`TRUNCATE users, allowed_emails, sessions, challenges, challenge_events, workout_plans, plan_days, plan_day_exercises, workout_sessions, set_logs CASCADE`,
    );
    const { admin, members = [] } = req.body as { admin?: string; members?: string[] };
    if (admin) await seedAdmin(db, admin);
    for (const email of members) await db.insert(allowedEmails).values({ email, role: 'member' });
    await seedDemo(db);
    if (sms instanceof MemorySmsProvider) sms.clear();
    res.status(204).end();
  });

  router.post('/google-login', async (req, res) => {
    const email = emailSchema.parse(req.body.email);
    const result = await completeGoogleLogin(db, {
      email,
      emailVerified: req.body.emailVerified !== false,
      givenName: req.body.givenName ?? email.split('@')[0],
      familyName: req.body.familyName ?? '',
      name: req.body.givenName ?? email,
    });
    if (!result.ok) {
      res.status(403).json({ error: result.reason });
      return;
    }
    await startSession(res, result.user.id);
    res.json({ id: result.user.id });
  });

  router.get('/sms', (_req, res) => {
    res.json(sms instanceof MemorySmsProvider ? sms.messages : []);
  });

  return router;
}
