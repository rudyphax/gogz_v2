import type { VercelConfig } from '@vercel/config/v1';

/**
 * One Vercel project: the Vite build is served from the CDN and every /api/*
 * request goes to the Express app in api/index.ts (a Vercel Function).
 * Same origin for both, so the session cookie is first-party.
 */
export const config: VercelConfig = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'apps/web/dist',
  rewrites: [
    { source: '/api/(.*)', destination: '/api' },
    // Client-side routes (e.g. /golf/challenges/123 from a text message) load the SPA.
    { source: '/((?!api/).*)', destination: '/index.html' },
  ],
  crons: [
    // Reset the demo account's data nightly (08:00 UTC). Vercel sends the CRON_SECRET bearer token.
    { path: '/api/cron/reset-demo', schedule: '0 8 * * *' },
  ],
};
