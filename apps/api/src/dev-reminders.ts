import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { DevRemindersWorker } from './engagement/dev-reminders.worker';
import { PlatformConfigModule } from './platform/config/platform-config.module';
import { PlatformConfigService } from './platform/config/platform-config.service';
import { PoolService } from './platform/database/pool.service';

@Module({ imports: [PlatformConfigModule], providers: [PoolService, DevRemindersWorker] })
class DevRemindersModule {}

export async function bootstrapDevReminders(): Promise<void> {
  const app = await NestFactory.createApplicationContext(DevRemindersModule, { logger: false });
  const config = app.get(PlatformConfigService);
  if (
    !config.get('MASARIFI_RETURN_REMINDERS_ENABLED') ||
    config.get('MASARIFI_PROCESS_KIND') !== 'worker'
  ) {
    await app.close();
    throw new Error('DEV_REMINDERS_DISABLED');
  }
  const worker = app.get(DevRemindersWorker);
  const state = { stopping: false };
  const stop = () => {
    state.stopping = true;
  };
  const stopped = () => state.stopping;
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    while (!stopped()) {
      try {
        await worker.runOnce();
      } catch {
        process.stderr.write('DEV_REMINDER_TICK_FAILED\n');
      }
      if (!stopped())
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            process.removeListener('SIGTERM', finish);
            process.removeListener('SIGINT', finish);
            resolve();
          };
          const timer = setTimeout(finish, 15_000);
          process.once('SIGTERM', finish);
          process.once('SIGINT', finish);
        });
    }
  } finally {
    await app.close();
  }
}

if (require.main === module)
  void bootstrapDevReminders().catch(() => {
    process.stderr.write('DEV_REMINDER_BOOTSTRAP_FAILED\n');
    process.exitCode = 1;
  });
