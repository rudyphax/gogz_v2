export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  /** Public URL of the app, used for links in text messages. */
  appOrigin: string;
  secureCookies: boolean;
  /** Max password-login attempts per IP per 15 minutes. */
  loginRateLimit: number;
  cronSecret: string | null;
  google: { clientId: string; clientSecret: string; redirectUri: string } | null;
  twilio: { accountSid: string; authToken: string; from: string } | null;
  blobToken: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv =
    env.NODE_ENV === 'production' || env.NODE_ENV === 'test' ? env.NODE_ENV : 'development';
  const appOrigin = (
    env.APP_ORIGIN ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:5173')
  ).replace(/\/$/, '');
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI ?? `${appOrigin}/api/auth/google/callback`,
        }
      : null;
  const twilio =
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
      ? {
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: env.TWILIO_FROM_NUMBER,
        }
      : null;
  return {
    nodeEnv,
    appOrigin,
    secureCookies: appOrigin.startsWith('https://'),
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT ?? 10),
    cronSecret: env.CRON_SECRET ?? null,
    google,
    twilio,
    blobToken: env.BLOB_READ_WRITE_TOKEN ?? null,
  };
}
