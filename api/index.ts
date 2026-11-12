/**
 * Vercel Function entry point. Vercel routes /api/* here (see vercel.ts)
 * and serves the Express app with Fluid Compute, reusing the instance
 * (and its Postgres pool) across requests.
 */
import { buildAppFromEnv } from '../apps/api/src/bootstrap.js';

export default buildAppFromEnv();
