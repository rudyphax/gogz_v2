import type { NextFunction, Request, Response } from 'express';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { forbidden, HttpError } from '../errors.js';
import { SESSION_COOKIE, validateSession } from '../auth/sessions.js';

declare module 'express-serve-static-core' {
  interface Locals {
    user?: User;
  }
}

export function loadUser(db: Db) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const user = await validateSession(db, token);
      if (user) res.locals.user = user;
    }
    next();
  };
}

export function currentUser(res: Response): User {
  const user = res.locals.user;
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  currentUser(res);
  next();
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (currentUser(res).role !== 'admin') throw forbidden('Admins only');
  next();
}

export function blockDemo(_req: Request, res: Response, next: NextFunction) {
  if (currentUser(res).role === 'demo') throw forbidden('This is disabled in the demo account');
  next();
}

/**
 * CSRF defense in addition to SameSite=Lax cookies: browsers always send
 * Origin on cross-site POST/PUT/PATCH/DELETE, so reject any that isn't ours.
 */
export function checkOrigin(allowedOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (!safe && origin && origin !== allowedOrigin) throw forbidden('Cross-site request blocked');
    next();
  };
}
