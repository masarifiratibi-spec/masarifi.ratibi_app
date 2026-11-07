import { CoreFinanceSyncAdapter } from './core-finance-sync-adapter';

it('keeps a conflicted local edit and exposes a delete conflict instead of discarding it', async () => {
  const statements: string[] = [];
  const runAsync = jest.fn(async (sql: string) => {
    statements.push(sql);
  });
  const transaction = {
    getFirstAsync: jest.fn(async (sql: string) =>
      // Conflicted work is not in flight, but still blocks a remote tombstone.
      sql.includes("status IN ('pending','sending','conflict')")
        ? { present: 1 }
        : null
    ),
    runAsync
  };
  const database = {
    ...transaction,
    withExclusiveTransactionAsync: jest.fn(
      async (action: (value: unknown) => Promise<void>) => action(transaction)
    )
  };
  const adapter = new CoreFinanceSyncAdapter(database as never);
  await adapter.applyDelta(
    'transactions',
    [
      {
        resourceId: 'transaction-one',
        operation: 'delete',
        version: 2,
        deletedAt: '2026-08-31T00:00:00.000Z'
      }
    ],
    'cursor-two',
    null
  );
  const sql = statements.join('\n');
  expect(sql).toContain('finance_sync_conflicts');
  expect(sql).not.toContain('UPDATE finance_transactions SET status=?');
});

it('defers the whole delta while a local command is in flight without advancing its cursor', async () => {
  const transaction = {
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes("status IN ('pending','sending')") ? { present: 1 } : null
    ),
    runAsync: jest.fn()
  };
  const database = {
    ...transaction,
    withExclusiveTransactionAsync: jest.fn(
      async (action: (value: unknown) => Promise<void>) => action(transaction)
    )
  };
  const accepted = await new CoreFinanceSyncAdapter(database as never).applyDelta(
    'transactions',
    [{
      resourceId: 'transaction-one',
      operation: 'delete',
      version: 2,
      deletedAt: '2026-08-31T00:00:00.000Z'
    }],
    'cursor-two',
    null
  );
  expect(accepted).toBe(false);
  expect(transaction.runAsync).not.toHaveBeenCalled();
});

it('applies a repeated tombstone to a missing row without failing cursor progress', async () => {
  const statements: string[] = [];
  const transaction = {
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async (sql: string) => {
      statements.push(sql);
    })
  };
  const database = {
    ...transaction,
    withExclusiveTransactionAsync: jest.fn(
      async (action: (value: unknown) => Promise<void>) => action(transaction)
    )
  };
  const adapter = new CoreFinanceSyncAdapter(database as never);
  await adapter.applyDelta(
    'accounts',
    [
      {
        resourceId: 'missing-account',
        operation: 'delete',
        version: 3,
        deletedAt: '2026-08-31T00:00:00.000Z'
      }
    ],
    'cursor-three',
    null
  );
  expect(
    statements.some((sql) => sql.includes('UPDATE finance_accounts'))
  ).toBe(true);
  expect(statements.at(-1)).toContain('sync_state');
});

it.each([
  ['accounts', 'archived'],
  ['categories', 'archived'],
  ['transactions', 'deleted']
] as const)(
  'updates the persisted %s payload and indexed status for exact hydration',
  async (domain, expectedStatus) => {
    const calls: unknown[][] = [];
    const transaction = {
      getFirstAsync: jest.fn(async () => null),
      runAsync: jest.fn(async (...args: unknown[]) => {
        calls.push(args);
      })
    };
    const database = {
      ...transaction,
      withExclusiveTransactionAsync: jest.fn(
        async (action: (value: unknown) => Promise<void>) => action(transaction)
      )
    };
    await new CoreFinanceSyncAdapter(database as never).applyDelta(
      domain,
      [
        {
          resourceId: 'server-record',
          operation: 'delete',
          version: 3,
          deletedAt: '2026-08-31T00:00:00.000Z'
        }
      ],
      'cursor-three',
      null
    );
    const tombstone = calls.find(([sql]) =>
      String(sql).includes(`UPDATE finance_${domain}`)
    );
    expect(String(tombstone?.[0])).toContain('payload=');
    expect(tombstone).toEqual(
      expect.arrayContaining([expect.any(String), expectedStatus])
    );
  }
);
