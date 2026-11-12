import cookieParser from 'cookie-parser';
import express from 'express';
import type { WorkoutGenerator } from '@gogz/shared';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import type { GoogleOAuth } from './auth/google.js';
import { checkOrigin, loadUser, requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { cronRoutes } from './routes/cron.js';
import { golfRoutes } from './routes/golf.js';
import { gymRoutes } from './routes/gym.js';
import { profileRoutes } from './routes/profile.js';
import { testingRoutes } from './routes/testing.js';
import type { SmsProvider } from './services/sms.js';
import type { AvatarStorage } from './services/storage.js';

export interface AppDeps {
  db: Db;
  config: Config;
  sms: SmsProvider;
  storage: AvatarStorage;
  google: GoogleOAuth | null;
  generator?: WorkoutGenerator;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const api = express.Router();
  api.use(checkOrigin(deps.config.appOrigin));
  api.use(loadUser(deps.db));

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/cron', cronRoutes(deps));

  const auth = authRoutes(deps);
  if (deps.config.nodeEnv === 'test') api.use('/test', testingRoutes(deps, auth.startSession));
  api.use((req, res, next) => {
    // Everything except sign-in endpoints needs a session.
    if (req.path.startsWith('/auth/')) return next();
    requireAuth(req, res, next);
  });
  api.use(auth.router);
  api.use('/profile', profileRoutes(deps));
  api.use('/golf', golfRoutes(deps));
  api.use('/gym', gymRoutes(deps));
  api.use('/admin', adminRoutes(deps));

  app.use('/api', api);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
