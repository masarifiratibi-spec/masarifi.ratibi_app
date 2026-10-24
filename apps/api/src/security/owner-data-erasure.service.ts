import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { PoolService } from '../platform/database/pool.service';
import { ReportsStorage } from '../reports/reports.storage';
import { SupportStorage } from '../engagement/support.storage';
import { ExportStorage } from './export-storage';
import type { DeletionOutcome, PrivacyEvidence } from './privacy-handlers';

/** Complements domain handlers; Clerk deletion remains the final worker step. */
@Injectable()
export class OwnerDataErasureService {
  constructor(
    private readonly pool: PoolService,
    private readonly reports: ReportsStorage,
    private readonly exports: ExportStorage,
    private readonly support: SupportStorage,
  ) {}

  async prepare(evidence: PrivacyEvidence): Promise<void> {
    await this.worker(async (client) => {
      await client.query('select private.prepare_account_owner_erasure($1::uuid,$2)', [
        evidence.requestId,
        evidence.userId,
      ]);
    });
  }

  async purgeDueUploads(): Promise<void> {
    const owners = await this.worker(
      async (client) =>
        (
          await client.query<{ user_id: string }>(
            'select * from private.list_due_account_upload_erasure_owners(16)',
          )
        ).rows,
    );
    for (const owner of owners) await this.purgeOutstandingUploads(owner.user_id);
  }

  async purgeOutstandingUploads(userId: string): Promise<void> {
    const claims = await this.worker(
      async (client) =>
        (
          await client.query<{ id: string; storage_ref: string; lease_token: string }>(
            'select * from private.claim_account_upload_erasure($1,16)',
            [userId],
          )
        ).rows,
    );
    for (const claim of claims) {
      await this.support.delete(claim.storage_ref);
      await this.worker(async (client) => {
        await client.query('select private.complete_account_upload_erasure($1,$2::uuid,$3::uuid)', [
          userId,
          claim.id,
          claim.lease_token,
        ]);
      });
    }
  }

  async erase(evidence: PrivacyEvidence): Promise<DeletionOutcome> {
    const deletedCount = await this.worker(async (client) => {
      // The database takes the report worker's existing advisory lock before listing objects.
      const objects = await client.query<{
        kind: 'report' | 'export' | 'support';
        storage_ref: string;
      }>('select * from private.lock_account_erasure_objects($1::uuid,$2)', [
        evidence.requestId,
        evidence.userId,
      ]);
      for (const object of objects.rows) {
        if (object.kind === 'report') await this.reports.delete(object.storage_ref);
        else if (object.kind === 'export') await this.exports.delete(object.storage_ref);
        else await this.support.delete(object.storage_ref);
      }
      const result = await client.query<{ result: number }>(
        'select private.erase_account_owner_payload($1::uuid,$2) result',
        [evidence.requestId, evidence.userId],
      );
      const count = Number(result.rows[0]?.result);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('ERASURE_OUTCOME_INVALID');
      return count;
    });
    return { deletedCount, anonymizedCount: 0, retainedCount: 0, policyIds: [] };
  }

  private worker<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ role: 'worker' }),
        ]);
        await client.query('set local role masarifi_worker');
        const value = await action(client);
        await client.query('commit');
        return value;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}
