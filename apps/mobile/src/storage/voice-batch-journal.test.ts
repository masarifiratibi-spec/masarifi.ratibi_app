import { openDatabase } from './database';
import { pruneVoiceBatches } from './voice-batch-journal';

jest.mock('./database', () => ({ openDatabase: jest.fn() }));
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run(...parameters: (string | number)[]): unknown;
      all(): { id: string }[];
    };
  };
}>('node:sqlite');

it('bounds clean terminal history while preserving pending captures and media ownership', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      'CREATE TABLE voice_batch_operations(id TEXT PRIMARY KEY,payload TEXT NOT NULL)'
    );
    const insert = db.prepare('INSERT INTO voice_batch_operations VALUES(?,?)');
    const now = Date.now();
    for (let index = 0; index < 110; index++)
      insert.run(
        String(index),
        JSON.stringify({
          phase: 'completed',
          audioReference: null,
          recordedAt: now - index
        })
      );
    insert.run(
      'old',
      JSON.stringify({
        phase: 'completed',
        audioReference: null,
        recordedAt: now - 8 * 86400000
      })
    );
    insert.run(
      'pending',
      JSON.stringify({
        phase: 'processing',
        audioReference: null,
        recordedAt: 0
      })
    );
    insert.run(
      'media',
      JSON.stringify({
        phase: 'failed',
        audioReference: 'file://retained.m4a',
        recordedAt: 0
      })
    );
    jest.mocked(openDatabase).mockResolvedValue({
      runAsync: async (sql: string, ...parameters: (string | number)[]) =>
        db.prepare(sql).run(...parameters)
    } as never);
    await pruneVoiceBatches('owner');
    const rows = db
      .prepare('SELECT id FROM voice_batch_operations')
      .all()
      .map((row) => row.id);
    expect(rows).toHaveLength(102);
    expect(rows).toEqual(
      expect.arrayContaining(['0', '99', 'pending', 'media'])
    );
    expect(rows).not.toContain('100');
    expect(rows).not.toContain('old');
    expect(openDatabase).toHaveBeenCalledWith('owner');
  } finally {
    db.close();
  }
});
