import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { PlatformConfigService } from '../config/platform-config.service';

export function buildPoolOptions(connectionString: string, max: number): PoolConfig {
  if (!Number.isInteger(max) || max < 1 || max > 50) {
    throw new Error('DATABASE_POOL_SIZE_INVALID');
  }
  return {
    connectionString,
    max,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 1_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 2_000,
  };
}

@Injectable()
export class PoolService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly runtimeRole?: 'masarifi_api' | 'masarifi_worker';
  private readonly initializedClients = new WeakSet<PoolClient>();

  constructor(config: PlatformConfigService) {
    this.pool = new Pool(
      buildPoolOptions(config.get('DATABASE_URL'), config.get('MASARIFI_DATABASE_POOL_MAX')),
    );
    const processKind = config.get('MASARIFI_PROCESS_KIND');
    this.runtimeRole =
      processKind === 'api'
        ? 'masarifi_api'
        : processKind === 'worker'
          ? 'masarifi_worker'
          : undefined;
  }

  async query<T extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
    timeoutMs = 2_000,
  ): Promise<QueryResult<T>> {
    const client = await this.connect();
    const query = client.query<T>(text, [...values]);
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        query,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error('DATABASE_QUERY_TIMEOUT'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      client.release(timedOut);
    }
  }

  async ping(timeoutMs: number): Promise<void> {
    await this.query('select 1', [], timeoutMs);
  }

  async withClient<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.connect();
    try {
      return await action(client);
    } finally {
      client.release();
    }
  }

  private async connect(): Promise<PoolClient> {
    const client = await this.pool.connect();
    if (!this.runtimeRole || this.initializedClients.has(client)) return client;
    try {
      await client.query(`set role ${this.runtimeRole}`);
      this.initializedClients.add(client);
      return client;
    } catch (error) {
      client.release(true);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
