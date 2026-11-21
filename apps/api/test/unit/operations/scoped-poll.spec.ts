import type { PoolClient } from 'pg';

import { OperationsRepository } from '../../../src/operations/operations.repository';
import type { PoolService } from '../../../src/platform/database/pool.service';

describe('operations claim database calls', () => {
  const keys = ['sync-mutations.retry'];

  it.each([
    ['masarifi_worker', keys, 1],
    ['masarifi_worker', undefined, 5],
    ['masarifi_api', keys, 5],
    [undefined, keys, 5],
  ] as const)(
    'uses the correct transaction for %s with scope %j',
    async (runtimeRole, scope, count) => {
      const claim = { jobKey: keys[0], attemptId: 'test-attempt' };
      const query = jest.fn((sql: string, params?: unknown[]) =>
        Promise.resolve({
          rows: params && sql.includes('private.claim_due_jobs') ? [{ value: claim }] : [],
        }),
      );
      const repository = new OperationsRepository({
        runtimeRole,
        withClient: (action: (client: PoolClient) => Promise<unknown>) =>
          action({ query } as unknown as PoolClient),
      } as PoolService);
      await expect(repository.claim('scheduler-test', 1, scope)).resolves.toEqual([claim]);
      expect(query).toHaveBeenCalledTimes(count);
      const scheduler = query.mock.calls.find(([sql]) => sql.includes('private.claim_due_jobs'));
      expect(scheduler?.[1]).toEqual(scope ? ['scheduler-test', 1, scope] : ['scheduler-test', 1]);
      if (count === 1) {
        expect(scheduler?.[0]).toContain("set_config('request.jwt.claims'");
      } else {
        expect(query.mock.calls.map(([sql]) => sql)).toEqual([
          'begin',
          expect.stringContaining("set_config('request.jwt.claims'"),
          'set local role masarifi_worker',
          expect.stringContaining('private.claim_due_jobs'),
          'commit',
        ]);
      }
    },
  );
});
