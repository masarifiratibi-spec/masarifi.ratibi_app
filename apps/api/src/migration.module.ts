import { Module } from '@nestjs/common';

import { PlatformConfigModule } from './platform/config/platform-config.module';
import { DatabaseModule } from './platform/database/database.module';
import { MigrationRunner } from './platform/database/migration-runner';

@Module({
  imports: [PlatformConfigModule, DatabaseModule],
  providers: [MigrationRunner],
})
export class MigrationModule {}
