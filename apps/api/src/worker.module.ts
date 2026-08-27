import { Module } from '@nestjs/common';

import { PlatformConfigModule } from './platform/config/platform-config.module';
import { OutboxModule } from './platform/outbox/outbox.module';

@Module({
  imports: [PlatformConfigModule, OutboxModule],
})
export class WorkerModule {}
