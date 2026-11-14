import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { PlatformConfigService } from '../config/platform-config.service';
import { financialGeneration } from '../http/financial-generation';
import { PlatformLogger } from '../observability/platform-logger';
import { workerErrorFields } from '../observability/worker-error';

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
  private readonly clientGenerations = new WeakMap<PoolClient, string>();

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
    let failed = false;
    try {
      return await Promise.race([
        query,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            failed = true;
            reject(new Error('DATABASE_QUERY_TIMEOUT'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      // The driver's own timeout may reject before our deadline, leaving work
      // running on this connection. Treat every failed query as uncertain.
      failed = true;
      this.logFailure(error, 'query');
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      client.release(failed);
    }
  }

  async ping(timeoutMs: number): Promise<void> {
    await this.query('select 1', [], timeoutMs);
  }

  async withClient<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.connect();
    let failed = false;
    try {
      return await action(client);
    } catch (error) {
      // A driver timeout can also time out a queued ROLLBACK. Never return an
      // uncertain transaction or owner-local settings to another request.
      failed = true;
      this.logFailure(error, 'transaction');
      throw error;
    } finally {
      client.release(failed);
    }
  }

  private async connect(): Promise<PoolClient> {
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      this.logFailure(error, 'connect');
      throw error;
    }
    try {
      const generation = financialGeneration.getStore() ?? '';
      if ((this.clientGenerations.get(client) ?? '') !== generation) {
        await client.query("select set_config('masarifi.financial_generation',$1,false)", [
          generation,
        ]);
        this.clientGenerations.set(client, generation);
      }
      if (this.initializedClients.has(client)) return client;
      // A client deadline does not cancel work behind the session pooler.
      // Keep stricter server budgets; PostgreSQL stores this setting in ms.
      const deadline =
        "select set_config('statement_timeout', least(nullif((select setting::integer from pg_settings where name='statement_timeout'), 0), 2000)::text, false)";
      const initialization = this.runtimeRole
        ? `${deadline}; set role ${this.runtimeRole}`
        : deadline;
      await client.query(initialization);
      this.initializedClients.add(client);
      return client;
    } catch (error) {
      client.release(true);
      this.logFailure(error, 'initialize');
      throw error;
    }
  }

  private logFailure(error: unknown, stage: string): void {
    new PlatformLogger().error('database.failed', {
      operation: `database.${stage}`,
      failureStage: stage,
      ...workerErrorFields(error),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
