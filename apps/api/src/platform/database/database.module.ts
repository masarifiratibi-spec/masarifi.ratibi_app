import { Module } from '@nestjs/common';

import { PoolService } from './pool.service';
import { SchemaCompatibilityService } from './schema-compatibility';

@Module({
  providers: [PoolService, SchemaCompatibilityService],
  exports: [PoolService, SchemaCompatibilityService],
})
export class DatabaseModule {}
