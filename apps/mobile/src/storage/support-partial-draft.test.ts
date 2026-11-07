import { readFileSync } from 'node:fs';
import type { SupportDraftInput } from '@/domain/support';
import { createLiveSupportService } from '@/services/live/engagement-service';

type Sqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...args: (string | number)[]): unknown;
    run(...args: (string | number)[]): unknown;
  };
  close(): void;
};
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => Sqlite;
}>('node:sqlite');
let mockDatabase: Sqlite;
jest.mock('@/storage/database', () => ({
  openDatabase: async () => ({
    getFirstAsync: async (sql: string, ...args: (string | number)[]) =>
      mockDatabase.prepare(sql).get(...args) ?? null,
    runAsync: async (sql: string, ...args: (string | number)[]) =>
      mockDatabase.prepare(sql).run(...args)
  }),
  runExclusiveDatabaseTransaction: async (
    database: unknown,
    work: (database: unknown) => Promise<void>
  ) => work(database)
}));

beforeEach(() => {
  mockDatabase = new DatabaseSync(':memory:');
  const ddl = readFileSync('src/storage/database.ts', 'utf8').match(
    /CREATE TABLE IF NOT EXISTS support_drafts \(([\s\S]*?)\n    \);/
  );
  if (!ddl) throw new Error('Support draft migration missing');
  mockDatabase.exec(ddl[0]);
});
afterEach(() => mockDatabase.close());

// Physical T14: entering only a subject incorrectly failed local autosave.
it.each([
  { subject: 'QA unsent subject', description: '' },
  { subject: '', description: 'QA unsent body' }
])('restores a partial support draft $subject $description without submitting it', async (text) => {
  const request = jest.fn() as jest.MockedFunction<typeof fetch>;
  const options = { baseUrl: 'https://api.example.test', token: async () => 'test-token', request };
  const draft: SupportDraftInput = {
    id: 'qa-local-partial', mode: 'ticket', category: 'privacy',
    ...text, ticketId: null, context: null
  };
  await createLiveSupportService(options).saveDraft(draft);
  const restored = await createLiveSupportService(options).loadDraft(draft.id);
  expect(restored).toMatchObject({ ...draft, status: 'draft' });
  await expect(createLiveSupportService(options).submitDraft(draft.id, 'never-send-partial'))
    .rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  expect(await createLiveSupportService(options).loadDraft(draft.id)).toEqual(restored);
});
