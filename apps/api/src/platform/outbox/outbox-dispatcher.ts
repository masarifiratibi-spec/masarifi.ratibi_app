import { Injectable } from '@nestjs/common';

import { OUTBOX_METRICS, recordPlatformMetric } from '../observability/platform-metrics';
import { buildEventEnvelope, type OutboxEnvelopeRow } from './event-envelope';
import { OutboxRepository } from './outbox.repository';
import { QueuePublisher } from './queue-publisher';
import { retryDelayMs } from './retry-policy';

export type OutboxSignalName = 'outbox.published' | 'outbox.delivery_failed';
export type OutboxSignal = (
  name: OutboxSignalName,
  fields: Record<string, string | number>,
) => void;

@Injectable()
export class OutboxDispatcher {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: QueuePublisher,
    private readonly signal: OutboxSignal = () => undefined,
    private readonly random: () => number = Math.random,
    private readonly maxAttempts = 10,
    private readonly baseRetrySeconds = 1,
    private readonly maxRetrySeconds = 300,
    private readonly jitterMs = 1_000,
  ) {}

  async dispatch(row: OutboxEnvelopeRow, workerId: string, correlationId: string): Promise<void> {
    const envelope = buildEventEnvelope(row, correlationId);
    const publicationStartedAt = Date.now();
    try {
      await this.publisher.publish(envelope);
      recordPlatformMetric(OUTBOX_METRICS.publicationDuration, Date.now() - publicationStartedAt, {
        outcome: 'accepted',
      });
    } catch {
      const attempt = row.attemptCount + 1;
      const terminal = attempt >= this.maxAttempts;
      const delay = terminal
        ? this.maxRetrySeconds * 1_000
        : retryDelayMs(
            attempt,
            this.baseRetrySeconds,
            this.maxRetrySeconds,
            this.jitterMs,
            this.random,
          );
      const code = terminal ? 'OUTBOX_DELIVERY_EXHAUSTED' : 'QUEUE_PUBLISH_FAILED';
      const retained = await this.repository.fail(
        row.id,
        workerId,
        attempt,
        code,
        new Date(Date.now() + delay),
      );
      if (terminal && retained) {
        recordPlatformMetric(OUTBOX_METRICS.deliveryFailed, 1, {
          outcome: 'exhausted',
        });
        this.signal('outbox.delivery_failed', {
          eventId: row.id,
          eventType: row.eventType,
          attempt,
          code,
        });
      } else if (retained) {
        recordPlatformMetric(OUTBOX_METRICS.retry, 1, { outcome: 'scheduled' });
      }
      recordPlatformMetric(OUTBOX_METRICS.attempt, attempt, {
        outcome: terminal ? 'exhausted' : 'retry',
      });
      return;
    }

    try {
      if (await this.repository.complete(row.id, workerId)) {
        recordPlatformMetric(OUTBOX_METRICS.published, 1, {
          outcome: 'completed',
        });
        this.signal('outbox.published', {
          eventId: row.id,
          eventType: row.eventType,
          attempt: envelope.attempt,
        });
      }
    } catch {
      // Queue acceptance succeeded; lease expiry permits safe at-least-once replay.
    }
  }
}
