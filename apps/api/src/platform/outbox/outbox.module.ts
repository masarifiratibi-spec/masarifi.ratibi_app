import { hostname } from 'node:os';

import { Module } from '@nestjs/common';

import { PlatformConfigService } from '../config/platform-config.service';
import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcher } from './outbox-dispatcher';
import { OutboxRepository } from './outbox.repository';
import { OutboxWorkerService } from './outbox-worker.service';
import { QueuePublisher } from './queue-publisher';

@Module({
  imports: [DatabaseModule],
  providers: [
    OutboxRepository,
    QueuePublisher,
    {
      provide: OutboxDispatcher,
      inject: [OutboxRepository, QueuePublisher],
      useFactory: (repository: OutboxRepository, publisher: QueuePublisher) =>
        new OutboxDispatcher(repository, publisher),
    },
    {
      provide: OutboxWorkerService,
      inject: [OutboxRepository, OutboxDispatcher, PlatformConfigService],
      useFactory: (
        repository: OutboxRepository,
        dispatcher: OutboxDispatcher,
        config: PlatformConfigService,
      ) =>
        new OutboxWorkerService(repository, dispatcher, {
          workerId: config.get('MASARIFI_WORKER_ID') ?? `${hostname()}-${String(process.pid)}`,
          batchSize: config.get('MASARIFI_OUTBOX_BATCH_SIZE'),
          leaseSeconds: config.get('MASARIFI_OUTBOX_LEASE_SECONDS'),
          pollMs: config.get('MASARIFI_OUTBOX_POLL_MS'),
        }),
    },
  ],
  exports: [OutboxWorkerService],
})
export class OutboxModule {}
