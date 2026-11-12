export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

/** Development: print texts to the terminal instead of sending them. */
export class ConsoleSmsProvider implements SmsProvider {
  send(to: string, body: string): Promise<void> {
    console.log(`[sms] to ${to}: ${body}`);
    return Promise.resolve();
  }
}

/** Tests and e2e: keep texts in memory so they can be asserted on. */
export class MemorySmsProvider implements SmsProvider {
  readonly messages: { to: string; body: string }[] = [];
  send(to: string, body: string): Promise<void> {
    this.messages.push({ to, body });
    return Promise.resolve();
  }
  clear() {
    this.messages.length = 0;
  }
}

export class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly opts: { accountSid: string; authToken: string; from: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, body: string): Promise<void> {
    const { accountSid, authToken, from } = this.opts;
    const res = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );
    if (!res.ok) throw new Error(`Twilio responded ${res.status}: ${await res.text()}`);
  }
}
