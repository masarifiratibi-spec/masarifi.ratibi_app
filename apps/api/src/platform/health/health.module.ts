import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessDependencies } from './readiness-dependencies';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService, ReadinessDependencies],
  exports: [HealthService],
})
export class HealthModule {}
