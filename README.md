# GOGZ · Golf & Gym

A private app for a group of friends who golf and lift. Send each other golf challenges with
something on the line (by text message), negotiate the prize, track head-to-head records, and
generate and log gym workouts that suggest your next weights.

Only invited friends can sign in. There's also a **Try the demo** button that opens a sandboxed
account with sample data, so anyone can look around.

## Features

**Golf**

- Friends list with your win–loss record against each friend
- Tap a friend, enter a prize, and send a challenge. They get a text with a link to respond.
- Accept, decline, or counteroffer by changing the prize. Counters can go back and forth.
- After the round, one player reports the winner and the other confirms or disputes, so records
  only count results both players agree on.

**Gym**

- Plan generator: pick a goal (strength, muscle growth, endurance, golf performance), days per
  week and available equipment. It builds a full-body, upper/lower or push/pull/legs split.
- Log sets (weight × reps) for a workout day. Each exercise shows what you did last time and
  suggests today's target (double progression: add reps, then add weight).
- Progress chart per exercise (best set and estimated one-rep max).

**Profile**: name, display name, mobile number with SMS consent, optional password, and photo.
**Members** (admin): manage the invite list.

## Stack

| Layer    | Tech                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4, Recharts        |
| Backend  | Node.js, TypeScript, Express 5, Drizzle ORM, PostgreSQL, zod                              |
| Auth     | Google OAuth (PKCE, via `arctic`) with an email allowlist, plus optional argon2 passwords |
| Services | Twilio (SMS), Vercel Blob (avatars), Vercel Cron (nightly demo reset)                     |
| Hosting  | Vercel (static frontend and Express as a Vercel Function) with Neon Postgres              |
| Testing  | Vitest, Supertest, React Testing Library, MSW, Playwright; GitHub Actions CI              |

### Layout

```
packages/shared   Pure domain logic + zod schemas + API types, used by both apps
  src/challenge.ts          challenge state machine (pending → countered → accepted → …)
  src/workouts/             exercise library, plan generator, progression rules
apps/api          Express API
  src/app.ts                app factory; dependencies (DB, SMS, storage, Google) are injected
  src/routes/               auth, profile, golf, gym, admin, cron, test-only routes
  drizzle/                  SQL migrations
apps/web          React SPA (features/{auth,golf,gym,profile,admin})
api/index.ts      Vercel Function entry; serves the Express app
e2e/              Playwright specs
```

The rules that matter, like who can make which challenge move and what weight to try next, are
pure functions in `packages/shared`. The API and UI both use them, and they're tested without a
database or browser.

### Security notes

- **No self sign-up.** An account is only created when a verified Google email is on the
  `allowed_emails` table. Removing someone from the list signs them out everywhere and blocks
  future logins (Google or password).
- Sessions are random tokens stored hashed (SHA-256) in Postgres, in an `HttpOnly`, `Secure`
  (in production) and `SameSite=Lax` cookie, with sliding 30-day expiry.
- Requests that change data also check the `Origin` header. Password login is rate-limited and
  takes the same time whether or not the account exists.
- The demo account lives in a separate "demo world" (`users.is_demo`): demo users never see real
  users, can't edit their profile, and never trigger texts.

## Running locally

Requirements: Node 22+ (24 recommended) and PostgreSQL 14+ running locally.

```bash
npm install
cp .env.example .env          # set ADMIN_EMAIL to your Gmail address
createdb gogz_dev
npm run db:migrate
npm run db:seed               # allowlists ADMIN_EMAIL as admin + seeds the demo account
npm run dev                   # API on :3011, web on http://localhost:5173
```

Without Google credentials you can still use **Try the demo**. To sign in with Google locally,
create an OAuth client (see below) and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
Without Twilio credentials, texts are printed in the API terminal instead of sent.

## Tests

```bash
npm run typecheck
npm run lint
npm test                # shared + API + web unit/component tests
npm run test:coverage   # same, failing below the coverage thresholds
npm run e2e             # Playwright (starts its own API + web servers and gogz_e2e database)
```

- **Shared** (60 tests): challenge state machine, plan generator, progression, validation.
- **API** (76 tests): Supertest against a real Postgres `gogz_test` database. Covers the full
  OAuth callback (with a fake Google), the allowlist, sessions, CSRF, rate limiting, every
  challenge transition and its text message, workout logging, admin and cron.
- **Web** (41 tests): components with React Testing Library, with MSW standing in for the API.
- **E2E** (10 tests, desktop and mobile): uninvited users rejected, demo login, password login,
  admin invites, the whole challenge negotiation across two browser sessions (asserting on the
  texts sent), and building a plan and logging workouts.

E2E sign-in goes through a test-only route (`/api/test/google-login`) that runs the same
allowlist check as the real Google callback. It's only mounted when `NODE_ENV=test`.

## Deploying (Vercel + Neon)

1. Push to GitHub and import the repo in Vercel. `vercel.ts` configures the build, rewrites and
   cron job.
2. **Database**: add **Neon** from the Vercel Marketplace (Storage tab). It sets `DATABASE_URL`;
   use the pooled connection string. Then run migrations and the seed against it once:
   ```bash
   DATABASE_URL="<neon url>" ADMIN_EMAIL="you@gmail.com" npm run db:migrate
   DATABASE_URL="<neon url>" ADMIN_EMAIL="you@gmail.com" npm run db:seed
   ```
3. **Google sign-in**: in Google Cloud Console → APIs & Services → Credentials, create an OAuth
   client ID (Web application). Add these authorized redirect URIs:
   `https://<your-domain>/api/auth/google/callback` and
   `http://localhost:5173/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` in Vercel.
4. **Texts**: create a Twilio account and buy a number. US texting requires registration;
   **toll-free verification** is the simplest route for a small app and takes a few days. Set
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`.
5. **Avatars**: add a **Blob** store in Vercel (it sets `BLOB_READ_WRITE_TOKEN`).
6. Set `APP_ORIGIN=https://<your-domain>` and a random `CRON_SECRET`.

## Roadmap

- AI-generated workout plans (Claude API) behind the existing `WorkoutGenerator` interface
- Swap or reorder exercises within a plan
- Group leaderboard for the golf challenges

## Design decisions

- **Handicaps**: TheGrint has no public API, and scraping it would break their terms of service.
  The golf section tracks head-to-head challenge records instead.
- **One deploy, one origin**: the SPA and API share a domain, so the session cookie is
  first-party and no CORS setup is needed.
- **Plain `pg` driver everywhere**: the same code runs against local Postgres and Neon's pooled
  endpoint.
