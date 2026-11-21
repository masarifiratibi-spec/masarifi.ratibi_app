import { createHash } from 'node:crypto';

import { HttpException } from '@nestjs/common';

import { PlatformConfigService } from '../platform/config/platform-config.service';
import { SyncHandlers } from './sync.handlers';
import { recordSyncConflict, recordSyncRetry } from './sync.observability';
import { SyncRepository, type ClaimedMutation } from './sync.repository';

type ClaimedMutationRepository = Pick<
  SyncRepository,
  'workerComplete' | 'retryMutation' | 'createConflict' | 'conflictTarget'
>;

/** Processes only a supplied claim; construction never claims or starts jobs. */
export class ClaimedMutationExecutor {
  constructor(
    private readonly repository: ClaimedMutationRepository,
    private readonly handlers: SyncHandlers,
    private readonly config: PlatformConfigService,
    private readonly workerId: string,
  ) {}
  retryDelayMs(mutationId: string, attempt: number): number {
    const base = this.config.getRequired('MASARIFI_SYNC_RETRY_BASE_SECONDS') * 1000;
    const maximum = this.config.getRequired('MASARIFI_SYNC_RETRY_MAX_SECONDS') * 1000;
    const jitterMaximum = this.config.getRequired('MASARIFI_SYNC_RETRY_JITTER_MS');
    const exponential = Math.min(maximum, base * 2 ** Math.max(0, attempt - 1));
    const jitter =
      jitterMaximum === 0
        ? 0
        : createHash('sha256').update(mutationId).digest().readUInt32BE(0) % (jitterMaximum + 1);
    return Math.min(maximum, exponential + jitter);
  }

  // Preserve the worker's existing completion/conflict/retry ordering in one shared path.
  async process(claimed: ClaimedMutation): Promise<void> {
    const authenticatedAt = claimed.authenticatedAt ? Date.parse(claimed.authenticatedAt) : NaN;
    const principal = {
      userId: claimed.userId,
      sessionId: `sync-worker:${this.workerId}`,
      factorAgeSeconds:
        Number.isFinite(authenticatedAt) && authenticatedAt <= Date.now()
          ? Math.ceil((Date.now() - authenticatedAt) / 1000)
          : null,
    };
    try {
      const result = await this.handlers.dispatch(
        principal,
        claimed.mutation,
        claimed.mutation.operationId,
      );
      await this.repository.workerComplete(
        claimed.id,
        claimed.leaseToken,
        'applied',
        this.result(result),
        null,
      );
    } catch (error) {
      const code = this.errorCode(error);
      if (
        code === 'VERSION_CONFLICT' &&
        claimed.mutation.domain === 'transactions' &&
        claimed.mutation.resourceId &&
        claimed.mutation.baseVersion !== null
      ) {
        const target = await this.repository.conflictTarget(principal, claimed.mutation.resourceId);
        if (target) {
          await this.repository.createConflict(
            claimed.userId,
            {
              mutationId: claimed.id,
              transactionId: claimed.mutation.resourceId,
              serverVersion: target.version,
              clientVersion: claimed.mutation.baseVersion,
              fields: Object.keys(claimed.mutation.payload).sort(),
              serverSnapshot: target.snapshot,
              clientSnapshot: claimed.mutation.payload,
            },
            claimed.leaseToken,
          );
          recordSyncConflict('created');
          return;
        }
      }
      if (this.permanent(code)) {
        await this.repository.workerComplete(claimed.id, claimed.leaseToken, 'rejected', null, {
          code,
        });
        recordSyncRetry('rejected');
        return;
      }
      if (claimed.attemptCount >= this.config.getRequired('MASARIFI_SYNC_MAX_ATTEMPTS')) {
        await this.repository.workerComplete(claimed.id, claimed.leaseToken, 'rejected', null, {
          code: 'SYNC_RETRY_EXHAUSTED',
          cause: code,
        });
        recordSyncRetry('exhausted');
        return;
      }
      await this.repository.retryMutation(
        claimed.id,
        claimed.leaseToken,
        new Date(Date.now() + this.retryDelayMs(claimed.id, claimed.attemptCount)),
        code,
      );
      recordSyncRetry('scheduled');
    }
  }

  private result(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { accepted: true };
  }

  private permanent(code: string): boolean {
    return [
      'VALIDATION_FAILED',
      'AUTH_TOKEN_INVALID',
      'RECENT_AUTH_REQUIRED',
      'PROFILE_INACTIVE',
      'DEVICE_NOT_FOUND',
      'SYNC_OPERATION_UNSUPPORTED',
      'TRANSACTION_NOT_FOUND',
      'NOT_FOUND',
      'TRANSACTION_INELIGIBLE',
      'ACCOUNT_INVALID',
      'CATEGORY_INVALID',
      'PLANNING_VERSION_CONFLICT',
    ].includes(code);
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object') {
        const code: unknown = (response as Record<string, unknown>).code;
        if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(code)) return code;
      }
    }
    if (error instanceof Error) {
      const code = error.message.match(/[A-Z][A-Z0-9_]{2,63}/)?.[0];
      if (code) return code;
    }
    return 'SYNC_MUTATION_FAILED';
  }
}
