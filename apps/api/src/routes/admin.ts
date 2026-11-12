import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { addAllowedEmailSchema, type AllowedEmailDto } from '@gogz/shared';
import type { AppDeps } from '../app.js';
import { allowedEmails, users } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { deleteUserSessions } from '../auth/sessions.js';
import { currentUser, requireAdmin } from '../middleware/auth.js';

export function adminRoutes({ db }: AppDeps) {
  const router = Router();
  router.use(requireAdmin);

  router.get('/allowed-emails', async (_req, res) => {
    const rows = await db
      .select({ a: allowedEmails, userId: users.id })
      .from(allowedEmails)
      .leftJoin(users, eq(users.email, allowedEmails.email))
      .orderBy(asc(allowedEmails.email));
    const body: AllowedEmailDto[] = rows.map(({ a, userId }) => ({
      email: a.email,
      role: a.role,
      createdAt: a.createdAt.toISOString(),
      registered: userId !== null,
    }));
    res.json(body);
  });

  router.post('/allowed-emails', async (req, res) => {
    const { email, role } = addAllowedEmailSchema.parse(req.body);
    const [row] = await db
      .insert(allowedEmails)
      .values({ email, role })
      .onConflictDoUpdate({ target: allowedEmails.email, set: { role } })
      .returning();
    await db.update(users).set({ role }).where(eq(users.email, email));
    res
      .status(201)
      .json({ email: row!.email, role: row!.role, createdAt: row!.createdAt.toISOString() });
  });

  router.delete('/allowed-emails/:email', async (req, res) => {
    const email = req.params.email.toLowerCase();
    if (email === currentUser(res).email) throw badRequest('You cannot remove yourself');
    const [removed] = await db
      .delete(allowedEmails)
      .where(eq(allowedEmails.email, email))
      .returning();
    if (!removed) throw notFound('Email not on the list');
    // Sign them out everywhere; their data stays in case they're re-invited.
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user) await deleteUserSessions(db, user.id);
    res.status(204).end();
  });

  return router;
}
