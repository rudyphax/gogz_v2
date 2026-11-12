import { generateCodeVerifier, generateState } from 'arctic';
import { and, eq } from 'drizzle-orm';
import { Router, type CookieOptions, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginSchema } from '@gogz/shared';
import type { AppDeps } from '../app.js';
import { users } from '../db/schema.js';
import { toMe } from '../dto.js';
import { HttpError } from '../errors.js';
import { isAllowed, completeGoogleLogin } from '../auth/login.js';
import { dummyVerify, verifyPassword } from '../auth/passwords.js';
import { createSession, deleteSession, SESSION_COOKIE, SESSION_TTL_MS } from '../auth/sessions.js';
import { currentUser } from '../middleware/auth.js';

export const DEMO_EMAIL = 'demo@gogz.demo';
const OAUTH_COOKIE_MS = 10 * 60 * 1000;

/** Only same-app paths, so the login can't be used as an open redirect. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\')
    ? next
    : '/golf';
}

export function authRoutes({ db, config, google }: AppDeps) {
  const router = Router();
  const cookieBase: CookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    path: '/',
  };

  async function startSession(res: Response, userId: string) {
    const token = await createSession(db, userId);
    res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL_MS });
  }

  router.get('/me', (_req, res) => {
    res.json(toMe(currentUser(res)));
  });

  router.get('/auth/providers', (_req, res) => {
    res.json({ google: google !== null });
  });

  router.get('/auth/google', (req, res) => {
    if (!google) throw new HttpError(503, 'Google sign-in is not configured');
    const state = generateState();
    const verifier = generateCodeVerifier();
    const opts = { ...cookieBase, maxAge: OAUTH_COOKIE_MS };
    res.cookie('google_state', state, opts);
    res.cookie('google_verifier', verifier, opts);
    res.cookie('login_next', safeNext(req.query.next), opts);
    res.redirect(google.createAuthorizationURL(state, verifier).toString());
  });

  router.get('/auth/google/callback', async (req, res) => {
    if (!google) throw new HttpError(503, 'Google sign-in is not configured');
    const { code, state } = req.query;
    const storedState = req.cookies?.google_state as string | undefined;
    const verifier = req.cookies?.google_verifier as string | undefined;
    res.clearCookie('google_state', cookieBase);
    res.clearCookie('google_verifier', cookieBase);
    res.clearCookie('login_next', cookieBase);
    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      !storedState ||
      !verifier ||
      state !== storedState
    ) {
      res.redirect('/login?error=oauth');
      return;
    }
    let profile;
    try {
      profile = await google.getProfile(code, verifier);
    } catch {
      res.redirect('/login?error=oauth');
      return;
    }
    const result = await completeGoogleLogin(db, profile);
    if (!result.ok) {
      res.redirect(`/login?error=${result.reason}`);
      return;
    }
    await startSession(res, result.user.id);
    res.redirect(safeNext(req.cookies?.login_next));
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in a few minutes.' },
  });

  router.post('/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isDemo, false)));
    const valid =
      user?.passwordHash && (await isAllowed(db, email))
        ? await verifyPassword(user.passwordHash, password)
        : await dummyVerify(password);
    if (!user || !valid) throw new HttpError(401, 'Incorrect email or password');
    await startSession(res, user.id);
    res.json(toMe(user));
  });

  router.post('/auth/demo', async (_req, res) => {
    const [demo] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
    if (!demo) throw new HttpError(503, 'The demo account is not set up yet');
    await startSession(res, demo.id);
    res.json(toMe(demo));
  });

  router.post('/auth/logout', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await deleteSession(db, token);
    res.clearCookie(SESSION_COOKIE, cookieBase);
    res.status(204).end();
  });

  return { router, startSession };
}
