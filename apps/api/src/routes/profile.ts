import { and, eq, ne } from 'drizzle-orm';
import express, { Router } from 'express';
import { setPasswordSchema, updateProfileSchema } from '@gogz/shared';
import type { AppDeps } from '../app.js';
import { allowedEmails, users } from '../db/schema.js';
import { toMe } from '../dto.js';
import { badRequest, forbidden, HttpError } from '../errors.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { blockDemo, currentUser } from '../middleware/auth.js';
import { AVATAR_TYPES, MAX_AVATAR_BYTES } from '../services/storage.js';

export function profileRoutes({ db, storage }: AppDeps) {
  const router = Router();
  router.use(blockDemo);

  router.patch('/', async (_req, res) => {
    const me = currentUser(res);
    const input = updateProfileSchema.parse(_req.body);
    const changes: Partial<typeof users.$inferInsert> = {
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      phone: input.phone,
      smsOptIn: input.phone ? input.smsOptIn : false,
    };

    if (input.email && input.email !== me.email) {
      // Email is the allowlist key, so only admins may change it (and the allowlist moves with it).
      if (me.role !== 'admin') throw forbidden('Ask an admin to change your email');
      const [taken] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, input.email), ne(users.id, me.id)));
      if (taken) throw new HttpError(409, 'That email is already in use');
      await db.transaction(async (tx) => {
        await tx.delete(allowedEmails).where(eq(allowedEmails.email, me.email));
        await tx
          .insert(allowedEmails)
          .values({ email: input.email!, role: 'admin' })
          .onConflictDoNothing();
      });
      changes.email = input.email;
    }

    const [updated] = await db.update(users).set(changes).where(eq(users.id, me.id)).returning();
    res.json(toMe(updated!));
  });

  router.put('/password', async (req, res) => {
    const me = currentUser(res);
    const { currentPassword, newPassword } = setPasswordSchema.parse(req.body);
    if (me.passwordHash) {
      if (!currentPassword || !(await verifyPassword(me.passwordHash, currentPassword))) {
        throw badRequest('Current password is incorrect');
      }
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, me.id));
    res.status(204).end();
  });

  router.put(
    '/avatar',
    express.raw({ type: [...AVATAR_TYPES], limit: MAX_AVATAR_BYTES }),
    async (req, res) => {
      const me = currentUser(res);
      const contentType = req.get('content-type') ?? '';
      if (
        !(AVATAR_TYPES as readonly string[]).includes(contentType) ||
        !Buffer.isBuffer(req.body) ||
        req.body.length === 0
      ) {
        throw badRequest('Upload a JPEG, PNG, WebP or GIF image');
      }
      const url = await storage.save(me.id, contentType, req.body);
      const [updated] = await db
        .update(users)
        .set({ avatarUrl: url })
        .where(eq(users.id, me.id))
        .returning();
      res.json(toMe(updated!));
    },
  );

  router.delete('/avatar', async (_req, res) => {
    const me = currentUser(res);
    const [updated] = await db
      .update(users)
      .set({ avatarUrl: null })
      .where(eq(users.id, me.id))
      .returning();
    res.json(toMe(updated!));
  });

  return router;
}
