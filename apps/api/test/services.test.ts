import type * as Arctic from 'arctic';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { errorHandler } from '../src/middleware/errors.js';
import { challengeMessage } from '../src/services/challengeMessages.js';
import { ConsoleSmsProvider, MemorySmsProvider, TwilioSmsProvider } from '../src/services/sms.js';
import { BlobAvatarStorage } from '../src/services/storage.js';

vi.mock('@vercel/blob', () => ({
  put: vi.fn((path: string) => Promise.resolve({ url: `https://blob.test/${path}` })),
}));

vi.mock('arctic', async (importOriginal) => {
  const actual = await importOriginal<typeof Arctic>();
  class Google {
    createAuthorizationURL(state: string) {
      return new URL(`https://accounts.google.com/o/oauth2/v2/auth?state=${state}`);
    }
    validateAuthorizationCode() {
      return Promise.resolve({ idToken: () => 'id-token' });
    }
  }
  return {
    ...actual,
    Google,
    decodeIdToken: () => ({
      email: 'Tiger@Example.com',
      email_verified: true,
      given_name: 'Tiger',
    }),
  };
});

describe('loadConfig', () => {
  it('defaults to local development', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({
      nodeEnv: 'development',
      appOrigin: 'http://localhost:5173',
      secureCookies: false,
      google: null,
      twilio: null,
      blobToken: null,
      cronSecret: null,
      loginRateLimit: 10,
    });
  });

  it('reads production settings', () => {
    const c = loadConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://gogz.app/',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_FROM_NUMBER: '+15550001111',
      BLOB_READ_WRITE_TOKEN: 'blob',
      CRON_SECRET: 'cron',
      LOGIN_RATE_LIMIT: '3',
    });
    expect(c).toMatchObject({
      nodeEnv: 'production',
      appOrigin: 'https://gogz.app',
      secureCookies: true,
      google: { clientId: 'id', redirectUri: 'https://gogz.app/api/auth/google/callback' },
      twilio: { from: '+15550001111' },
      blobToken: 'blob',
      cronSecret: 'cron',
      loginRateLimit: 3,
    });
  });

  it('falls back to the Vercel deployment URL', () => {
    expect(loadConfig({ VERCEL_URL: 'gogz-abc.vercel.app' }).appOrigin).toBe(
      'https://gogz-abc.vercel.app',
    );
    expect(
      loadConfig({
        GOOGLE_CLIENT_ID: 'a',
        GOOGLE_CLIENT_SECRET: 'b',
        GOOGLE_REDIRECT_URI: 'http://x/cb',
      }).google?.redirectUri,
    ).toBe('http://x/cb');
  });
});

describe('SMS providers', () => {
  it('Twilio posts form data with basic auth', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 201 }));
    const twilio = new TwilioSmsProvider(
      { accountSid: 'AC1', authToken: 'tok', from: '+15550001111' },
      fetchMock,
    );
    await twilio.send('+15552223333', 'hello');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('AC1:tok').toString('base64')}`,
    );
    expect(String(init!.body)).toBe('To=%2B15552223333&From=%2B15550001111&Body=hello');
  });

  it('Twilio surfaces API errors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('bad number', { status: 400 }));
    const twilio = new TwilioSmsProvider(
      { accountSid: 'AC1', authToken: 'tok', from: '+1' },
      fetchMock,
    );
    await expect(twilio.send('+1', 'x')).rejects.toThrow('Twilio responded 400: bad number');
  });

  it('console and memory providers', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleSmsProvider().send('+1', 'hi');
    expect(log).toHaveBeenCalledWith('[sms] to +1: hi');
    log.mockRestore();
    const mem = new MemorySmsProvider();
    await mem.send('+1', 'hi');
    expect(mem.messages).toEqual([{ to: '+1', body: 'hi' }]);
    mem.clear();
    expect(mem.messages).toEqual([]);
  });
});

describe('BlobAvatarStorage', () => {
  it('uploads to Vercel Blob', async () => {
    const url = await new BlobAvatarStorage('tok').save('u1', 'image/png', Buffer.from('x'));
    expect(url).toBe('https://blob.test/avatars/u1.png');
  });
});

describe('Google OAuth adapter', () => {
  it('builds the auth URL and maps ID token claims', async () => {
    const { createGoogleOAuth } = await import('../src/auth/google.js');
    const google = createGoogleOAuth({
      clientId: 'id',
      clientSecret: 's',
      redirectUri: 'http://x/cb',
    });
    expect(google.createAuthorizationURL('st', 'v').searchParams.get('state')).toBe('st');
    expect(await google.getProfile('code', 'v')).toEqual({
      email: 'tiger@example.com',
      emailVerified: true,
      givenName: 'Tiger',
      familyName: '',
      name: 'Tiger',
    });
  });
});

describe('challengeMessage', () => {
  const ctx = { actorName: 'Al', prize: '$5', link: 'http://l' };
  it.each([
    ['create', 'challenged you'],
    ['counter', 'countered'],
    ['accept', 'accepted'],
    ['decline', 'declined'],
    ['cancel', 'withdrew'],
    ['report', 'says someone won'],
    ['confirm', 'confirmed'],
    ['dispute', 'disputed'],
  ] as const)('%s', (event, text) => {
    const msg = challengeMessage(event, ctx);
    expect(msg).toContain(text);
    expect(msg).toContain('http://l');
  });
});

describe('errorHandler', () => {
  it('hides unexpected errors behind a 500', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('secret details');
    });
    app.use(errorHandler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/boom').expect(500);
    expect(res.body).toEqual({ error: 'Something went wrong' });
    spy.mockRestore();
  });
});
