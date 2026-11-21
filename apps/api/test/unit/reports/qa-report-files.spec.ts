import { QaReportFilesController } from '../../../src/reports/reports.qa-files.controller';

const id = '16388341-b68e-461b-b83f-ba87ec67caa9';
const principal = { userId: 'user_qa', sessionId: 'sess_qa' };
const storageKey = 'owned-key';
function setup(outcome: string, objectKey: string | null = null) {
  const query = jest.fn((statement: string) =>
    statement.startsWith('select outcome')
      ? { rows: [{ outcome, object_key: objectKey }] }
      : { rows: [] },
  );
  const pool = { withClient: (task: (client: unknown) => Promise<void>) => task({ query }) };
  const storage = {
    key: jest.fn(() => storageKey),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new QaReportFilesController(pool as never, storage as never);
  const remove = () => controller.remove({ clerkPrincipal: principal } as never, id);
  return { query, storage, remove };
}

describe('isolated QA report removal', () => {
  it('commits after storage confirms removal', async () => {
    const { query, storage, remove } = setup('remove', storageKey);
    await remove();
    expect(storage.delete).toHaveBeenCalledWith(storageKey);
    expect(query).toHaveBeenLastCalledWith('commit');
  });
  it.each([
    ['missing', 404],
    ['busy', 409],
    ['remove', 503],
  ])('rolls back %s and never touches a mismatched object', async (outcome, status) => {
    const { query, storage, remove } = setup(outcome, 'wrong-key');
    await expect(remove()).rejects.toMatchObject({ status });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('rollback');
  });
  it('preserves the attempt on a storage failure', async () => {
    const { query, storage, remove } = setup('remove', storageKey);
    storage.delete.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(remove()).rejects.toMatchObject({ status: 503 });
    expect(query).toHaveBeenLastCalledWith('rollback');
  });
  it('allows an owner to repeat a confirmed removal', async () => {
    const { storage, remove } = setup('expired');
    await remove();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
