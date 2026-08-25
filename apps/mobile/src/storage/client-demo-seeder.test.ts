import { seedClientDemoData } from './client-demo-seeder';

class DemoDatabaseFake {
  rows = new Map<string, Set<string>>();
  statements: string[] = [];
  failOn = '';

  async withExclusiveTransactionAsync(
    operation: (database: DemoDatabaseFake) => Promise<void>
  ) {
    const snapshot = new Map(
      [...this.rows].map(([table, ids]) => [table, new Set(ids)])
    );
    try {
      await operation(this);
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  async getFirstAsync<T>(sql: string, id: string): Promise<T | null> {
    const table = sql.match(/FROM (\w+)/)?.[1] ?? '';
    return (this.rows.get(table)?.has(id) ? { id } : null) as T | null;
  }

  async runAsync(sql: string, ...values: unknown[]) {
    if (this.failOn && sql.includes(this.failOn))
      throw new Error('seed failed');
    this.statements.push(sql);
    const table = sql.match(/(?:INTO|REPLACE INTO) (\w+)/)?.[1];
    if (!table) return;
    const id = String(values[0]);
    const ids = this.rows.get(table) ?? new Set<string>();
    ids.add(id);
    this.rows.set(table, ids);
  }
}

it('inserts the complete client demo once and writes its marker last', async () => {
  const database = new DemoDatabaseFake();

  expect(
    await seedClientDemoData({
      database: database as never,
      now: Date.UTC(2027, 1, 15),
      timeZone: 'Asia/Riyadh'
    })
  ).toBe(true);
  expect(database.rows.get('finance_accounts')?.has('account-default')).toBe(
    true
  );
  expect(
    database.rows.get('planning_budgets')?.has('demo-budget-current')
  ).toBe(true);
  expect(database.rows.get('tracking_events')?.size).toBeGreaterThan(0);
  expect(database.rows.get('notifications')?.size).toBeGreaterThan(0);
  expect(database.statements.at(-1)).toContain('demo_seed_markers');

  const statementCount = database.statements.length;
  expect(await seedClientDemoData({ database: database as never })).toBe(false);
  expect(database.statements).toHaveLength(statementCount);
});

it('uses additive inserts and rolls every row back when seeding fails', async () => {
  const database = new DemoDatabaseFake();
  database.rows.set('finance_accounts', new Set(['user-account']));
  database.failOn = 'planning_budgets';

  await expect(
    seedClientDemoData({ database: database as never })
  ).rejects.toThrow('seed failed');

  expect(database.rows.get('finance_accounts')).toEqual(
    new Set(['user-account'])
  );
  expect(database.rows.get('demo_seed_markers')).toBeUndefined();
  expect(database.statements.every((sql) => !sql.includes('DO UPDATE'))).toBe(
    true
  );
});
