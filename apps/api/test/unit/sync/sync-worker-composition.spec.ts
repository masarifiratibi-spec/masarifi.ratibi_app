import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { validateEnvironment } from '../../../src/platform/config/environment.schema';
import { SyncWorkerModule } from '../../../src/sync/sync.module';
import { SyncHandlers } from '../../../src/sync/sync.handlers';
import { SyncWorker } from '../../../src/sync/sync.worker';
import { SyncCommandRuntime } from '../../../src/sync/sync-command.runtime';

let configuration: PlatformConfigService;
@Global()
@Module({
  providers: [{ provide: PlatformConfigService, useFactory: () => configuration }],
  exports: [PlatformConfigService],
})
class TestConfigurationModule {}

it('fails normal worker startup closed without a separate API command connection', () => {
  for (const commandUrl of [undefined, 'postgresql://worker@127.0.0.1/inert']) {
    const values: Record<string, unknown> = {
      DATABASE_URL: 'postgresql://worker@127.0.0.1/inert',
      MASARIFI_SYNC_COMMAND_DATABASE_URL: commandUrl,
    };
    expect(
      () =>
        new SyncCommandRuntime({
          get: (key: string) => values[key],
          getRequired: (key: string) => values[key],
        } as PlatformConfigService),
    ).toThrow('SYNC_COMMAND_DATABASE_CONFIG_INVALID');
  }
});

it.each(['MASARIFI_AI_ASSISTANT_ONLY', 'MASARIFI_VOICE_ANALYSIS_ONLY'])(
  'preserves dedicated %s startup without allocating a command connection',
  async (key) => {
    const connect = jest.spyOn(Pool.prototype, 'connect');
    const runtime = new SyncCommandRuntime({
      get: (name: string) => (name === key ? true : undefined),
    } as PlatformConfigService);
    await runtime.onModuleDestroy();
    expect(connect).not.toHaveBeenCalled();
  },
);

it('uses separate least-privilege connections for normal sync claims and ledger commands', async () => {
  const workerUrl = 'postgresql://worker_fixture@127.0.0.1:55473/inert';
  const apiUrl = 'postgresql://api_fixture@127.0.0.1:55473/inert';
  const values: Record<string, unknown> = {
    ...validateEnvironment(process.env),
    MASARIFI_PROCESS_KIND: 'worker',
    DATABASE_URL: workerUrl,
    MASARIFI_SYNC_COMMAND_DATABASE_URL: apiUrl,
  };
  configuration = {
    get: (key: string) => values[key],
    getRequired: (key: string) => {
      if (values[key] === undefined) throw new Error('missing ' + key);
      return values[key];
    },
  } as PlatformConfigService;
  const observed: { connection: string; sql: string }[] = [];
  jest.spyOn(Pool.prototype, 'connect').mockImplementation(function (this: Pool) {
    const connection = (this as Pool & { options: { connectionString: string } }).options
      .connectionString;
    return Promise.resolve({
      release: () => undefined,
      query: (sql: string) => {
        observed.push({ connection, sql });
        if (connection === workerUrl && sql === 'set local role masarifi_api')
          return Promise.reject(new Error('42501 api role denied'));
        if (/^select \* from private\.claim_client_mutations/.test(sql)) return Promise.resolve({ rows: [] });
        if (/^select/.test(sql) && !sql.includes('set_config'))
          return Promise.reject(new Error('SYNTHETIC_COMMAND_BOUNDARY'));
        return Promise.resolve({ rows: [] });
      },
    } as never);
  } as never);
  const module = await Test.createTestingModule({
    imports: [TestConfigurationModule, SyncWorkerModule],
  }).compile();
  try {
    await module.get(SyncWorker).runJob('sync-mutations.retry');
    await expect(
      module
        .get(SyncHandlers)
        .dispatch(
          { userId: 'user_owner', sessionId: 'session', factorAgeSeconds: 0 },
          {
            operationId: '21000000-0000-4000-8000-000000000002',
            domain: 'transactions',
            resourceType: 'transaction',
            schemaVersion: 1,
            dependsOn: [],
            operation: 'create',
            resourceId: '21000000-0000-4000-8000-000000000002',
            baseVersion: null,
            payload: {
              kind: 'expense',
              amountMinor: 100,
              currency: 'SAR',
              accountId: '21000000-0000-4000-8000-000000000001',
              categoryId: '21000000-0000-4000-8000-000000000003',
              title: 'Inert composition probe',
              merchant: null,
              note: null,
              occurredAt: '2026-10-26T00:00:00.000Z',
              source: 'manual',
            },
          },
          'composition-probe',
        ),
    ).rejects.toBeDefined();
    expect(observed).toContainEqual({ connection: workerUrl, sql: 'set role masarifi_worker' });
    expect(observed).toContainEqual({ connection: apiUrl, sql: 'set role masarifi_api' });
    expect(observed).not.toContainEqual({
      connection: workerUrl,
      sql: 'set local role masarifi_api',
    });
  } finally {
    await module.close();
  }
});
