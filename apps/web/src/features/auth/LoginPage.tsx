import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import type { Me } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useMe, useProviders } from '../../api/hooks';
import { Button, Card, ErrorText, Field } from '../../components/ui';

const ERRORS: Record<string, string> = {
  not_invited: "That Google account isn't on the invite list. Ask the group admin to add you.",
  unverified: 'Your Google email address is not verified.',
  oauth: 'Google sign-in did not complete. Please try again.',
};

/** Only allow redirects to paths inside this app. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : '/golf';
}

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: me } = useMe();
  const { data: providers } = useProviders();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={next} replace />;

  async function signIn(request: () => Promise<Me>) {
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(keys.me, await request());
      await navigate(next, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void signIn(() => api<Me>('/auth/login', { method: 'POST', body: { email, password } }));
  }

  const oauthError = params.get('error');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-4xl font-black tracking-tight">GOGZ</h1>
          <p className="mt-1 text-sm text-brand-100">Golf challenges & gym logs for the crew</p>
        </div>
        <Card className="space-y-4">
          {oauthError && <ErrorText error={new Error(ERRORS[oauthError] ?? ERRORS.oauth)} />}

          <a
            href={
              providers?.google ? `/api/auth/google?next=${encodeURIComponent(next)}` : undefined
            }
            aria-disabled={!providers?.google}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ring-1 ring-stone-300 ${
              providers?.google
                ? 'bg-white hover:bg-stone-50'
                : 'pointer-events-none bg-stone-100 text-stone-400'
            }`}
          >
            <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Continue with Google
          </a>
          {providers && !providers.google && (
            <p className="text-center text-xs text-stone-500">
              Google sign-in isn't configured on this server.
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            or use your password
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Set one on your profile after signing in with Google."
            />
            <ErrorText error={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
          </form>
        </Card>

        <div className="mt-6 rounded-xl bg-white/10 p-4 text-center text-sm text-brand-50">
          <p>Just looking around? Try the app with sample data.</p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            disabled={busy}
            onClick={() => void signIn(() => api<Me>('/auth/demo', { method: 'POST' }))}
          >
            Try the demo
          </Button>
        </div>
      </div>
    </div>
  );
}
