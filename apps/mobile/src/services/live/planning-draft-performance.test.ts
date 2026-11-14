import { createLiveFinancialPlanningService } from './financial-planning-service';
import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';

const mockSql: string[] = [];
const mockDatabases = new Map<string, ReturnType<typeof mockDatabase>>();
function mockDatabase() {
  const { DatabaseSync } = jest.requireActual('node:sqlite');
  const native = new DatabaseSync(':memory:');
  native.exec(
    'CREATE TABLE planning_drafts(id TEXT PRIMARY KEY,payload TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,updated_at INTEGER NOT NULL)'
  );
  return {
    native,
    getAllAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      return native.prepare(sql).all(...args);
    },
    getFirstAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      return native.prepare(sql).get(...args) ?? null;
    },
    runAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      return native.prepare(sql).run(...args);
    }
  };
}
jest.mock('@/storage/database', () => ({
  openDatabase: async (owner: string) => {
    if (!mockDatabases.has(owner)) mockDatabases.set(owner, mockDatabase());
    return mockDatabases.get(owner);
  },
  runExclusiveDatabaseTransaction: async (
    db: ReturnType<typeof mockDatabase>,
    action: (db: unknown) => Promise<void>
  ) => {
    db.native.exec('BEGIN');
    try {
      await action(db);
      db.native.exec('COMMIT');
    } catch (error) {
      db.native.exec('ROLLBACK');
      throw error;
    }
  }
}));

afterAll(() => {
  for (const db of mockDatabases.values()) db.native.close();
});

it('reads and saves one owner draft without hydrating or rewriting financial tables', async () => {
  let owner = 'a';
  registerLiveClerkBridge({
    getSession: async () => ({
      id: owner,
      userId: owner,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async () => 'fixture',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const service = createLiveFinancialPlanningService({ persistent: true });
  const draft = {
    id: 'salary',
    kind: 'salary' as const,
    entityId: null,
    payload: { amount: '١٢٣٫٤٥' },
    status: 'editing' as const,
    updatedAt: 1
  };
  await service.saveDraft(draft);
  expect((await service.loadDraft('salary'))?.payload).toEqual({
    amount: '١٢٣٫٤٥'
  });
  owner = 'b';
  expect(await service.loadDraft('salary')).toBeNull();
  await service.saveDraft({ ...draft, payload: { amount: '200' } });
  owner = 'a';
  expect((await service.loadDraft('salary'))?.payload).toEqual({
    amount: '١٢٣٫٤٥'
  });
  await service.discardDraft('salary');
  expect(await service.loadDraft('salary')).toBeNull();
  owner = 'b';
  expect((await service.loadDraft('salary'))?.payload).toEqual({
    amount: '200'
  });
  expect(mockSql.every((sql) => /planning_drafts/.test(sql))).toBe(true);
  expect(
    mockSql
      .filter((sql) => /^DELETE/.test(sql))
      .every((sql) => /WHERE id/.test(sql))
  ).toBe(true);
});
