import { Pool } from 'pg';
import { HttpException } from '@nestjs/common';

import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { PoolService } from '../../../src/platform/database/pool.service';
import { ClaimedMutationExecutor } from '../../../src/sync/claimed-mutation.executor';
import { SyncHandlers } from '../../../src/sync/sync.handlers';
import { SyncRepository, type ClaimedMutation } from '../../../src/sync/sync.repository';
import { prepareClaimedMutationRuntime } from '../../../src/sync/claimed-mutation.runtime';

describe('supplied claimed-mutation executor', () => {
  it('records the public NOT_FOUND owner outcome once without scheduling another attempt', async () => {
    const repository = {
      workerComplete: jest
        .fn<
          ReturnType<SyncRepository['workerComplete']>,
          Parameters<SyncRepository['workerComplete']>
        >()
        .mockResolvedValue(undefined),
      retryMutation: jest
        .fn<
          ReturnType<SyncRepository['retryMutation']>,
          Parameters<SyncRepository['retryMutation']>
        >()
        .mockResolvedValue(undefined),
      createConflict: jest.fn<
        ReturnType<SyncRepository['createConflict']>,
        Parameters<SyncRepository['createConflict']>
      >(),
      conflictTarget: jest.fn<
        ReturnType<SyncRepository['conflictTarget']>,
        Parameters<SyncRepository['conflictTarget']>
      >(),
    };
    const dispatch = jest
      .fn<ReturnType<SyncHandlers['dispatch']>, Parameters<SyncHandlers['dispatch']>>()
      .mockRejectedValue(new HttpException({ code: 'NOT_FOUND' }, 404));
    const values: Record<string, number> = {
      MASARIFI_SYNC_MAX_ATTEMPTS: 10,
      MASARIFI_SYNC_RETRY_BASE_SECONDS: 1,
      MASARIFI_SYNC_RETRY_MAX_SECONDS: 300,
      MASARIFI_SYNC_RETRY_JITTER_MS: 0,
    };
    const config = { getRequired: (key: string) => values[key] } as PlatformConfigService;
    const claimed: ClaimedMutation = {
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'synthetic-other-owner',
      deviceId: '11111111-1111-4111-8111-222222222222',
      factorAgeSeconds: 1,
      authenticatedAt: new Date().toISOString(),
      attemptCount: 1,
      leaseToken: '11111111-1111-4111-8111-333333333333',
      mutation: {
        operationId: '11111111-1111-4111-8111-444444444444',
        domain: 'transactions',
        resourceType: 'transaction',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'update',
        resourceId: '11111111-1111-4111-8111-555555555555',
        baseVersion: 1,
        payload: { note: 'Synthetic note', reason: 'Synthetic owner isolation' },
      },
    };
    await new ClaimedMutationExecutor(
      repository,
      { dispatch } as unknown as SyncHandlers,
      config,
      't03-synthetic-one',
    ).process(claimed);
    expect(repository.retryMutation).not.toHaveBeenCalled();
    expect(repository.workerComplete).toHaveBeenCalledWith(
      claimed.id,
      claimed.leaseToken,
      'rejected',
      null,
      { code: 'NOT_FOUND' },
    );
  });
  it('refuses incomplete ordinary worker configuration before opening a connection', async () => {
    const connect = jest.spyOn(Pool.prototype, 'connect');
    const config = { getRequired: () => undefined } as never;
    await expect(
      prepareClaimedMutationRuntime(config, config, 't03-synthetic-one', 'f'.repeat(64)),
    ).rejects.toThrow('EXACT_EXECUTOR_CONFIG_UNVERIFIED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('constructs ordinary dependencies without connecting, claiming, or registering background jobs', async () => {
    const connect = jest.spyOn(Pool.prototype, 'connect');
    const interval = jest.spyOn(global, 'setInterval');
    const values: Record<string, unknown> = {
      DATABASE_URL: 'postgresql://synthetic@127.0.0.1:55473/t03_synthetic',
      MASARIFI_DATABASE_POOL_MAX: 1,
      MASARIFI_PROCESS_KIND: 'worker',
      MASARIFI_SYNC_RETRY_BASE_SECONDS: 1,
      MASARIFI_SYNC_RETRY_MAX_SECONDS: 300,
      MASARIFI_SYNC_RETRY_JITTER_MS: 0,
      MASARIFI_SYNC_MAX_ATTEMPTS: 10,
      MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    };
    const config = {
      get: (key: string) => values[key],
      getRequired: (key: string) => values[key],
    } as PlatformConfigService;
    const pool = new PoolService(config);
    try {
      new ClaimedMutationExecutor(
        new SyncRepository(pool),
        new SyncHandlers({} as never, {} as never),
        config,
        't03-synthetic-one',
      );
      expect(connect).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
      const apiValues: Record<string, unknown> = {
        ...values,
        DATABASE_URL: 'postgresql://synthetic-api@127.0.0.1:55473/t03_synthetic',
        MASARIFI_PROCESS_KIND: 'api',
      };
      const apiConfig = {
        get: (key: string) => apiValues[key],
        getRequired: (key: string) => apiValues[key],
      } as PlatformConfigService;
      const prepared = await prepareClaimedMutationRuntime(
        config,
        apiConfig,
        't03-synthetic-one',
        'f'.repeat(64),
      );
      expect(prepared.normalPool).not.toBe(prepared.apiCommandPool);
      await prepared.close();
      expect(connect).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
    } finally {
      await pool.onModuleDestroy();
    }
  });

  it('requires separate API command configuration before allocation and closes both pools if one close fails', async () => {
    const values: Record<string, unknown> = {
      DATABASE_URL: 'postgresql://synthetic-worker@127.0.0.1:55473/t03_synthetic',
      MASARIFI_PROCESS_KIND: 'worker',
      MASARIFI_DATABASE_POOL_MAX: 1,
      MASARIFI_SYNC_RETRY_BASE_SECONDS: 1,
      MASARIFI_SYNC_RETRY_MAX_SECONDS: 300,
      MASARIFI_SYNC_RETRY_JITTER_MS: 0,
      MASARIFI_SYNC_MAX_ATTEMPTS: 10,
      MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    };
    const worker = {
      get: (key: string) => values[key],
      getRequired: (key: string) => values[key],
    } as PlatformConfigService;
    await expect(
      prepareClaimedMutationRuntime(worker, worker, 't03-synthetic-one', 'f'.repeat(64)),
    ).rejects.toThrow('EXACT_EXECUTOR_API_CONFIG_UNVERIFIED');
    const apiValues: Record<string, unknown> = {
      ...values,
      DATABASE_URL: 'postgresql://synthetic-api@127.0.0.1:55473/t03_synthetic',
      MASARIFI_PROCESS_KIND: 'api',
    };
    const api = {
      get: (key: string) => apiValues[key],
      getRequired: (key: string) => apiValues[key],
    } as PlatformConfigService;
    const runtime = await prepareClaimedMutationRuntime(
      worker,
      api,
      't03-synthetic-one',
      'f'.repeat(64),
    );
    const end = jest
      .spyOn(Pool.prototype, 'end')
      .mockImplementationOnce(() => {
        throw new Error('SYNTHETIC_CLOSE_FAILURE');
      })
      .mockImplementationOnce(() => undefined);
    await expect(runtime.close()).rejects.toThrow('EXACT_EXECUTOR_CLOSE_FAILED');
    expect(end).toHaveBeenCalledTimes(2);
  });
});
