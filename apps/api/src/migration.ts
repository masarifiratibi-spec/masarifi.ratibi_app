import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { MigrationRunner } from './platform/database/migration-runner';

export async function runMigrations(): Promise<number> {
  const { MigrationModule } = await import('./migration.module');
  const app = await NestFactory.createApplicationContext(MigrationModule, {
    abortOnError: false,
    logger: false,
  });
  try {
    await app.get(MigrationRunner).run();
    return 0;
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void runMigrations().catch(() => {
    process.stderr.write('MIGRATION_FAILED\n');
    process.exitCode = 1;
  });
}
