import { Client } from 'pg';

// LISTEN needs a session of its own, including when the worker pool has a single slot.
export class SchedulerWakeListener {
  private client?: Client;
  private reconnect?: NodeJS.Timeout;
  private stopped = false;
  ready = false;

  constructor(
    private readonly databaseUrl: string,
    private readonly keys: readonly string[],
    private readonly wake: () => void,
  ) {}

  async connect(): Promise<void> {
    if (this.stopped || this.client) return;
    const client = new Client({
      connectionString: this.databaseUrl,
      application_name: 'operations-scheduler-listener',
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1000,
    });
    this.client = client;
    const disconnected = () => {
      if (this.client !== client) return;
      const wasReady = this.ready;
      this.client = undefined;
      this.ready = false;
      void client.end().catch(() => undefined);
      if (!this.stopped) {
        if (wasReady) this.wake();
        this.reconnect = setTimeout(() => void this.connect(), 1000);
      }
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on('notification', ({ channel, payload }) => {
      if (
        this.client === client &&
        channel === 'masarifi_operations_wakeup' &&
        payload &&
        this.keys.includes(payload)
      )
        this.wake();
    });
    try {
      await client.connect();
      await client.query('LISTEN masarifi_operations_wakeup');
      if (this.client !== client) return;
      this.ready = true;
      this.wake(); // Rescan after LISTEN commits, including after every reconnect.
    } catch {
      disconnected();
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.ready = false;
    clearTimeout(this.reconnect);
    const client = this.client;
    this.client = undefined;
    if (client) await client.end().catch(() => undefined);
  }
}
