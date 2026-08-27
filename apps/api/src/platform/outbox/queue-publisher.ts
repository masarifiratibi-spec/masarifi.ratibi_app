import { Injectable } from '@nestjs/common';

import { PoolService } from '../database/pool.service';
import type { EventEnvelope } from './event-envelope';

@Injectable()
export class QueuePublisher {
  constructor(private readonly database: PoolService) {}

  async publish(envelope: EventEnvelope, timeoutMs = 1_000): Promise<void> {
    try {
      await this.database.query(
        'select pgmq.send($1, $2::jsonb, $3)',
        ['platform-events', JSON.stringify(envelope), 0],
        timeoutMs,
      );
    } catch {
      throw new Error('QUEUE_PUBLISH_FAILED');
    }
  }
}
