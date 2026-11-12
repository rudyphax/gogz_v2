import { Router } from 'express';
import type { AppDeps } from '../app.js';
import { seedDemo } from '../db/seed.js';
import { HttpError } from '../errors.js';

/** Vercel Cron calls this nightly with `Authorization: Bearer $CRON_SECRET`. */
export function cronRoutes({ db, config }: AppDeps) {
  const router = Router();
  router.get('/reset-demo', async (req, res) => {
    if (!config.cronSecret || req.get('authorization') !== `Bearer ${config.cronSecret}`) {
      throw new HttpError(401, 'Unauthorized');
    }
    await seedDemo(db);
    res.json({ ok: true });
  });
  return router;
}
