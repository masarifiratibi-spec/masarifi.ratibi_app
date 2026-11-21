import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eraseFinancialProjections } from './financial-reset-projections';

const { DatabaseSync } = jest.requireActual('node:sqlite') as {
  DatabaseSync: new (filename: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): { all(): unknown[] };
  };
};
function device() {
  const db = new DatabaseSync(':memory:');
  const schema = readFileSync(join(__dirname, 'database.ts'), 'utf8')
    .split('const migrations = parseMigrations(`')[1]!
    .split('`);')[0]!;
  const pieces = schema.split(/-- migration:(\d+)\s*/);
  const migrations = [];
  for (let i = 1; i < pieces.length; i += 2)
    migrations.push([Number(pieces[i]), pieces[i + 1]!] as const);
  for (const [, sql] of migrations.sort(([a], [b]) => a - b)) db.exec(sql);
  db.exec(`PRAGMA foreign_keys=ON;
    INSERT INTO finance_accounts VALUES ('a','{"balance":500}','active',1,1);
    INSERT INTO sync_mutation_queue(operation_id,domain,resource_type,operation,payload,created_at,updated_at)
    VALUES('old','transactions','transaction','create','{}',1,1);
    INSERT INTO query_read_cache VALUES ('["core-finance","accounts"]','ar',1,'{"old":true}',1);
    INSERT INTO query_read_cache VALUES ('["settings","profile"]','ar',1,'{"name":"owner"}',1);`);
  return db;
}
it('drops old financial writes and read snapshots only in the opened device partition', async () => {
  const owner = device(),
    other = device();
  try {
    owner.exec('BEGIN');
    await eraseFinancialProjections({
      execAsync: async (sql) => {
        owner.exec(sql);
      }
    });
    owner.exec('COMMIT');
    expect(
      owner.prepare('SELECT operation_id FROM sync_mutation_queue').all()
    ).toEqual([]);
    expect(owner.prepare('SELECT id FROM finance_accounts').all()).toEqual([]);
    expect(
      owner.prepare('SELECT query_key FROM query_read_cache').all()
    ).toEqual([{ query_key: '["settings","profile"]' }]);
    expect(
      other.prepare('SELECT operation_id FROM sync_mutation_queue').all()
    ).toEqual([{ operation_id: 'old' }]);
    owner.exec(
      "INSERT INTO sync_mutation_queue(operation_id,domain,resource_type,operation,payload,created_at,updated_at) VALUES('new','transactions','transaction','create','{}',2,2)"
    );
    expect(
      owner.prepare('SELECT operation_id FROM sync_mutation_queue').all()
    ).toEqual([{ operation_id: 'new' }]);
  } finally {
    owner.close();
    other.close();
  }
});
