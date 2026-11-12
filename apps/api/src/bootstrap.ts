import { createGoogleOAuth } from './auth/google.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { ConsoleSmsProvider, MemorySmsProvider, TwilioSmsProvider } from './services/sms.js';
import { BlobAvatarStorage, InlineAvatarStorage } from './services/storage.js';

/** Builds the app from environment variables (used by the local server and the Vercel function). */
export function buildAppFromEnv() {
  const config = loadConfig();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { db } = createDb(url);
  const sms =
    config.nodeEnv === 'test'
      ? new MemorySmsProvider()
      : config.twilio
        ? new TwilioSmsProvider(config.twilio)
        : new ConsoleSmsProvider();
  const storage = config.blobToken
    ? new BlobAvatarStorage(config.blobToken)
    : new InlineAvatarStorage();
  const google = config.google ? createGoogleOAuth(config.google) : null;
  return createApp({ db, config, sms, storage, google });
}
