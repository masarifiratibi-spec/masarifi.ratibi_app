import { OwnerDataErasureService } from '../../../src/security/owner-data-erasure.service';
import type { PoolService } from '../../../src/platform/database/pool.service';
import type { ReportsStorage } from '../../../src/reports/reports.storage';
import type { ExportStorage } from '../../../src/security/export-storage';
import type { SupportStorage } from '../../../src/engagement/support.storage';

const evidence = {
  requestId: 'bcb9aa9d-6b38-4461-9a02-8df363a235b9',
  userId: 'owner',
  evidenceAt: new Date(),
  correlationId: 'erasure',
};

function fixture(failStorage = false) {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    await Promise.resolve();
    calls.push(sql);
    if (sql.includes('lock_account_erasure_objects'))
      return {
        rows: [
          { kind: 'report', storage_ref: 'reports/owner/report.pdf' },
          { kind: 'export', storage_ref: 'exports/export/privacy.zip' },
          { kind: 'support', storage_ref: 'support/ticket/attachment' },
        ],
      };
    if (sql.includes('claim_account_upload_erasure'))
      return {
        rows: [
          { id: 'upload-fence', storage_ref: 'support/ticket/attachment', lease_token: 'lease' },
        ],
      };
    if (sql.includes('erase_account_owner_payload')) return { rows: [{ result: 12 }] };
    return { rows: [] };
  });
  const pool = {
    withClient: async (action: (client: { query: typeof query }) => Promise<unknown>) =>
      action({ query }),
  };
  const reports = {
    delete: jest.fn(async () => {
      await Promise.resolve();
      calls.push('report-object');
      if (failStorage) throw new Error('storage unavailable');
    }),
  };
  const exports = {
    delete: jest.fn(async () => {
      await Promise.resolve();
      calls.push('export-object');
    }),
  };
  const support = {
    delete: jest.fn(async () => {
      await Promise.resolve();
      calls.push('support-object');
    }),
  };
  return {
    service: new OwnerDataErasureService(
      pool as unknown as PoolService,
      reports as unknown as ReportsStorage,
      exports as unknown as ExportStorage,
      support as unknown as SupportStorage,
    ),
    calls,
  };
}

it('deletes storage objects before erasing their references and commits the counted outcome', async () => {
  const { service, calls } = fixture();
  expect(await service.erase(evidence)).toEqual({
    deletedCount: 12,
    anonymizedCount: 0,
    retainedCount: 0,
    policyIds: [],
  });
  const erased = calls.findIndex((sql) => sql.includes('erase_account_owner_payload'));
  expect(calls.indexOf('report-object')).toBeLessThan(erased);
  expect(calls.indexOf('export-object')).toBeLessThan(erased);
  expect(calls.indexOf('support-object')).toBeLessThan(erased);
  expect(calls.at(-1)).toBe('commit');
});

it('rolls back and preserves database references when object removal fails', async () => {
  const { service, calls } = fixture(true);
  await expect(service.erase(evidence)).rejects.toThrow('storage unavailable');
  expect(calls.some((sql) => sql.includes('erase_account_owner_payload'))).toBe(false);
  expect(calls.at(-1)).toBe('rollback');
});

it('deletes only the owner-claimed late-upload object before acknowledging its lease', async () => {
  const { service, calls } = fixture();
  await service.purgeOutstandingUploads(evidence.userId);
  const acknowledged = calls.findIndex((sql) => sql.includes('complete_account_upload_erasure'));
  expect(calls.indexOf('support-object')).toBeLessThan(acknowledged);
  expect(calls.at(-1)).toBe('commit');
});
