import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { QueueHealthIndicator } from './queue-health.indicator';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService, QueueHealthIndicator],
  exports: [HealthService],
})
export class HealthModule {}
