import { randomUUID } from 'node:crypto';

import { Injectable, Logger, Optional, type OnModuleDestroy } from '@nestjs/common';

import { PlatformConfigService } from '../platform/config/platform-config.service';
import { SyncHandlers } from './sync.handlers';
import { ClaimedMutationExecutor } from './claimed-mutation.executor';
import { logSyncEvent, recordSyncWorker } from './sync.observability';
import { SyncRepository } from './sync.repository';
import { SyncCommandRuntime } from './sync-command.runtime';

export type SyncJob =
  'sync-mutations.retry' | 'idempotency.cleanup' | 'sync-state.cleanup' | 'conflicts.expire';

@Injectable()
export class SyncWorker implements OnModuleDestroy {
  private readonly logger = new Logger(SyncWorker.name);
  private active: Promise<void> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  private lastMaintenance = 0;
  private readonly workerId = `sync-${randomUUID()}`;

  private readonly executor: ClaimedMutationExecutor;

  constructor(
    private readonly repository: SyncRepository,
    handlers: SyncHandlers,
    private readonly config: PlatformConfigService,
    @Optional() commands?: SyncCommandRuntime,
  ) {
    this.executor = new ClaimedMutationExecutor(
      {
        workerComplete: (...args) => repository.workerComplete(...args),
        retryMutation: (...args) => repository.retryMutation(...args),
        createConflict: (...args) => repository.createConflict(...args),
        conflictTarget: (...args) =>
          commands ? commands.conflictTarget(...args) : repository.conflictTarget(...args),
      },
      handlers,
      config,
      this.workerId,
    );
  }

  runOnce(): Promise<void> {
    if (this.active) return this.active;
    const running = this.execute();
    this.active = running;
    void running
      .finally(() => {
        if (this.active === running) this.active = undefined;
      })
      .catch(() => undefined);
    return running;
  }

  async runJob(job: SyncJob): Promise<number> {
    if (job === 'sync-mutations.retry') {
      const claimed = await this.repository.claimMutations(
        this.workerId,
        this.config.getRequired('MASARIFI_SYNC_BATCH_SIZE'),
        this.config.getRequired('MASARIFI_SYNC_LEASE_SECONDS'),
      );
      for (const mutation of claimed) await this.executor.process(mutation);
      return claimed.length;
    }
    return this.repository.runMaintenance(
      job,
      this.config.getRequired('MASARIFI_SYNC_RETENTION_DAYS'),
    );
  }

  start(): void {
    if (this.stopped || this.timer) return;
    void this.runOnce().catch(() => undefined);
    this.timer = setInterval(
      () => void this.runOnce().catch(() => undefined),
      this.config.getRequired('MASARIFI_SYNC_POLL_MS'),
    );
    this.timer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.active?.catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  retryDelayMs(mutationId: string, attempt: number): number {
    return this.executor.retryDelayMs(mutationId, attempt);
  }

  private async execute(): Promise<void> {
    await this.measured('sync-mutations.retry');
    if (Date.now() - this.lastMaintenance < 60_000) return;
    for (const job of ['idempotency.cleanup', 'sync-state.cleanup', 'conflicts.expire'] as const)
      await this.measured(job);
    this.lastMaintenance = Date.now();
  }

  private async measured(job: SyncJob): Promise<void> {
    try {
      await this.runJob(job);
      recordSyncWorker(job, 'success');
      logSyncEvent(this.logger, 'worker.completed', { outcome: 'success', status: job });
    } catch (error) {
      recordSyncWorker(job, 'failure');
      logSyncEvent(this.logger, 'worker.failed', { outcome: 'failure', status: job });
      throw error;
    }
  }
}
