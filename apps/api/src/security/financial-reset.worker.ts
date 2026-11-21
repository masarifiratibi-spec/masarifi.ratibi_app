import { Injectable } from '@nestjs/common';
import { AiStorage } from '../ai/ai.storage';
import { ReportsStorage } from '../reports/reports.storage';
import { TrackingStorage } from '../tracking/tracking.storage';
import { ExportStorage } from './export-storage';
import { SecurityRepository } from './security.repository';

interface PendingObject {
  owner_id: string;
  request_id: string;
  kind: 'voice' | 'report' | 'tracking' | 'export';
  storage_ref: string;
}

@Injectable()
export class FinancialResetWorker {
  constructor(
    private readonly repository: SecurityRepository,
    private readonly voice: AiStorage,
    private readonly report: ReportsStorage,
    private readonly tracking: TrackingStorage,
    private readonly exports: ExportStorage,
  ) {}

  async run(owner: string | null = null): Promise<number> {
    const batch = await this.repository.withWorkerTransaction(
      async (client) =>
        (
          await client.query<PendingObject>(
            'select * from private.list_pending_financial_reset_objects(16,$1)',
            [owner],
          )
        ).rows,
    );
    const storage = {
      voice: this.voice,
      report: this.report,
      tracking: this.tracking,
      export: this.exports,
    };
    let failed = false;
    for (const object of batch) {
      try {
        await storage[object.kind].delete(object.storage_ref);
        await this.repository.withWorkerTransaction(async (client) => {
          await client.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify({ role: 'worker', sub: object.owner_id }),
          ]);
          await client.query('select private.complete_financial_reset_object($1,$2::uuid,$3,$4)', [
            object.owner_id,
            object.request_id,
            object.kind,
            object.storage_ref,
          ]);
        });
      } catch {
        // Other owners can progress during a storage outage. Unacknowledged objects remain retryable.
        failed = true;
      }
    }
    if (failed) throw new Error('FINANCIAL_RESET_CLEANUP_UNAVAILABLE');
    return batch.length;
  }
}
