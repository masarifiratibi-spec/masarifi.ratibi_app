import {
  applyPendingMigrations,
  assertCompatibleMigrationHistory,
  type MigrationFile,
} from '../../../src/platform/database/migration-runner';

describe('migration runner contracts', () => {
  const local = ['20260827000100', '20260827000200', '20260827000300', '20260827000400'];

  it('accepts clean and partially applied ordered histories', () => {
    expect(() => {
      assertCompatibleMigrationHistory([], local);
    }).not.toThrow();
    expect(() => {
      assertCompatibleMigrationHistory(local.slice(0, 2), local);
    }).not.toThrow();
    expect(() => {
      assertCompatibleMigrationHistory(local, local);
    }).not.toThrow();
  });

  it('fails closed for gaps, unknown migrations, or schema ahead', () => {
    expect(() => {
      assertCompatibleMigrationHistory([local[1] ?? ''], local);
    }).toThrow('MIGRATION_HISTORY_INVALID');
    expect(() => {
      assertCompatibleMigrationHistory([...local, '20260828000100'], local);
    }).toThrow('MIGRATION_SCHEMA_AHEAD');
  });

  it('applies only pending SQL atomically and records Supabase-compatible history', async () => {
    const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
    const client = {
      query: (text: string, values?: readonly unknown[]) => {
        queries.push({ text, values });
        return Promise.resolve({ rows: [] });
      },
    };
    const migrations: MigrationFile[] = [
      { version: local[0] ?? '', name: 'foundation', sql: 'select 1;' },
      { version: local[1] ?? '', name: 'outbox', sql: 'select 2;' },
    ];

    await applyPendingMigrations(client, migrations, [local[0] ?? ''], 9_000);

    expect(queries.slice(0, 3)).toEqual([
      { text: 'begin', values: undefined },
      {
        text: "select set_config('statement_timeout', $1, true)",
        values: ['9000ms'],
      },
      { text: 'select 2;', values: undefined },
    ]);
    expect(queries[3]?.text).toContain('insert into supabase_migrations.schema_migrations');
    expect(queries[3]?.values).toEqual([local[1], ['select 2;'], 'outbox']);
    expect(queries[4]).toEqual({ text: 'commit', values: undefined });
  });

  it('rolls back a failed migration without recording it', async () => {
    const queries: string[] = [];
    const client = {
      query: (text: string) => {
        queries.push(text);
        if (text === 'invalid sql') return Promise.reject(new Error('database detail'));
        return Promise.resolve({ rows: [] });
      },
    };

    await expect(
      applyPendingMigrations(
        client,
        [{ version: local[0] ?? '', name: 'foundation', sql: 'invalid sql' }],
        [],
        9_000,
      ),
    ).rejects.toThrow('MIGRATION_APPLY_FAILED');
    expect(queries).toEqual([
      'begin',
      "select set_config('statement_timeout', $1, true)",
      'invalid sql',
      'rollback',
    ]);
  });
});
