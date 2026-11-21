import { Client } from 'pg';

const channel = 'masarifi_requested_pdf_email';
const idleRescanMs = 30_000;
const reconnectMs = 10_000;

// LISTEN owns one session. A pooled transaction connection cannot keep a subscription.
export class RequestedEmailPoll {
  private client?: Client;
  private interval?: NodeJS.Timeout;
  private connected = false;
  private stopped = false;
  private running = false;
  private pending = true;
  private nextScan = 0;
  private nextConnect = 0;

  constructor(
    private readonly connectionString: string,
    private readonly pollMs: number,
    private readonly poll: () => Promise<boolean>,
    private readonly reportError: (event: string, error: unknown) => void,
  ) {}

  start(): void {
    this.interval = setInterval(() => {
      this.tick();
    }, this.pollMs);
    void this.listen();
  }

  private tick(): void {
    if (this.stopped) return;
    if (!this.client && Date.now() >= this.nextConnect) void this.listen();
    if (!this.connected || this.pending || Date.now() >= this.nextScan) void this.scan();
  }

  private async listen(): Promise<void> {
    const client = new Client({
      connectionString: this.connectionString,
      application_name: 'requested-pdf-email-listener',
      connectionTimeoutMillis: 2_000,
      query_timeout: 2_000,
      keepAlive: true,
    });
    this.client = client;
    const disconnect = (error?: unknown) => {
      if (this.client !== client) return;
      this.client = undefined;
      this.connected = false;
      this.pending = true;
      this.nextConnect = Date.now() + reconnectMs;
      void client.end().catch(() => undefined);
      if (error) this.reportError('REPORT_EMAIL_LISTEN_FAILED', error);
    };
    client.on('error', disconnect);
    client.once('end', () => {
      disconnect();
    });
    client.on('notification', (notice) => {
      if (!this.connected || this.client !== client || notice.channel !== channel) return;
      // A busy pass or a backlog stays on the normal cadence, even for self-notifications.
      const idle = !this.pending && !this.running;
      this.pending = true;
      if (idle) void this.scan();
    });
    try {
      await client.connect();
      await client.query('set role masarifi_worker');
      await client.query(`LISTEN ${channel}`);
      // During a rolling release an old schema or a non-session connection uses fast polling.
      const result = await client.query<{ ready: boolean }>(
        `
        select exists(select from pg_listening_channels() c where c=$1)
          and exists(select from pg_trigger where tgrelid='private.report_output_attempts'::regclass
            and tgname='requested_pdf_email_wake' and tgenabled in ('O','A'))
          and exists(select from pg_trigger where tgrelid='public.profiles'::regclass
            and tgname='requested_pdf_email_owner_wake' and tgenabled in ('O','A')) as ready`,
        [channel],
      );
      if (!result.rows[0]?.ready) throw new Error('REPORT_EMAIL_WAKE_UNAVAILABLE');
      if (this.client !== client || this.stopped) return;
      this.connected = true;
      // Re-read after LISTEN commits to cover inserts before subscription or on disconnect.
      this.pending = true;
      void this.scan();
    } catch (error) {
      disconnect(error);
    }
  }

  private async scan(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    this.pending = false;
    try {
      if (await this.poll()) this.pending = true;
      this.nextScan = Date.now() + idleRescanMs;
    } catch (error) {
      this.pending = true;
      this.reportError('REPORT_EMAIL_POLL_FAILED', error);
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.interval);
    const client = this.client;
    this.client = undefined;
    this.connected = false;
    if (client) void client.end().catch(() => undefined);
  }
}
