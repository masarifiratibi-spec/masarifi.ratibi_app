import type { PoolClient } from 'pg';
import { FinancialResetWorker } from '../../../src/security/financial-reset.worker';

describe('financial reset object cleanup', () => {
  it('resumes after an external deletion failure and acknowledges only confirmed deletes', async () => {
    const objects = [
      { owner_id: 'a', request_id: 'reset-a', kind: 'voice', storage_ref: 'media' },
      { owner_id: 'b', request_id: 'reset-b', kind: 'report', storage_ref: 'document' },
    ];
    const query = jest.fn((sql: string, args?: string[]) => {
      if (sql.includes('list_pending')) return { rows: objects.slice() };
      if (sql.includes('complete_financial')) {
        const index = objects.findIndex(
          (o) =>
            o.owner_id === args?.[0] &&
            o.request_id === args[1] &&
            o.kind === args[2] &&
            o.storage_ref === args[3],
        );
        if (index < 0) throw new Error('WRONG_OWNER_OR_REQUEST');
        objects.splice(index, 1);
      }
      return { rows: [] };
    });
    const repository = {
      withWorkerTransaction: (action: (c: PoolClient) => unknown) =>
        action({ query } as unknown as PoolClient),
    };
    const voice = {
      delete: jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(undefined),
    };
    const report = { delete: jest.fn().mockResolvedValue(undefined) };
    const worker = new FinancialResetWorker(
      repository as never,
      voice as never,
      report as never,
      {} as never,
      {} as never,
    );
    await expect(worker.run()).rejects.toThrow('FINANCIAL_RESET_CLEANUP_UNAVAILABLE');
    expect(objects.map((o) => o.owner_id)).toEqual(['a']);
    expect(report.delete).toHaveBeenCalledWith('document');
    await expect(worker.run('a')).resolves.toBe(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('list_pending'), ['a']);
    expect(objects).toEqual([]);
  });
});
