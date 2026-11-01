import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { PlatformConfigService } from './platform/config/platform-config.service';
import type { PlatformEnvironment } from './platform/config/environment.types';
import { validateEnvironment } from './platform/config/environment.schema';
import { GracefulShutdown } from './platform/observability/graceful-shutdown';
import { PlatformLogger } from './platform/observability/platform-logger';
import { workerErrorFields } from './platform/observability/worker-error';
import { SecurityWorkerService } from './security/security.worker';

export function stagingPrivacyScope(
  config: Pick<
    PlatformEnvironment,
    | 'MASARIFI_STAGING_PRIVACY_OWNER_ID'
    | 'MASARIFI_RELEASE_VERSION'
    | 'SUPABASE_URL'
    | 'MASARIFI_PROCESS_KIND'
    | 'CLERK_SECRET_KEY'
  >,
) {
  if (!config.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw new Error('PRIVACY_SCOPED_TEST_CLERK_INSTANCE_REQUIRED');
  const owner = config.MASARIFI_STAGING_PRIVACY_OWNER_ID;
  if (
    !owner ||
    !/^user_[A-Za-z0-9]+$/.test(owner) ||
    owner.length > 128 ||
    !/^[a-f0-9]{40}$/.test(config.MASARIFI_RELEASE_VERSION) ||
    config.MASARIFI_PROCESS_KIND !== 'worker' ||
    config.SUPABASE_URL !== 'https://qcffvfbpzvpwcwxwjyro.supabase.co'
  )
    throw new Error('PRIVACY_SCOPED_RUNTIME_CONFIGURATION_INVALID');
  return {
    owner,
    source: config.MASARIFI_RELEASE_VERSION,
    ownerHash: createHash('sha256').update(owner).digest('hex'),
  };
}

export async function bootstrapStagingPrivacyWorker(): Promise<INestApplicationContext> {
  // Reject an unscoped or non-Staging process before constructing database clients.
  const scope = stagingPrivacyScope(validateEnvironment(process.env));
  const { PlatformConfigModule } = await import('./platform/config/platform-config.module');
  const { SecurityWorkerModule } = await import('./security/security.module');
  @Module({ imports: [PlatformConfigModule, SecurityWorkerModule] })
  class StagingPrivacyWorkerModule {}
  const app = await NestFactory.createApplicationContext(StagingPrivacyWorkerModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  const config = app.get(PlatformConfigService);
  const worker = app.get(SecurityWorkerService);
  const logger = new PlatformLogger(undefined, config.get('MASARIFI_LOG_LEVEL'));
  app.useLogger(logger);
  const pulsePath = join(tmpdir(), 'staging-privacy-health.json');
  let stopping = false;
  let inFlight: Promise<void> | undefined;
  const pulse = (state: 'checked' | 'unavailable') => {
    writeFileSync(
      `${pulsePath}.next`,
      JSON.stringify({
        source: scope.source,
        ownerHash: scope.ownerHash,
        checkedAt: new Date().toISOString(),
        state,
      }),
      { mode: 0o600 },
    );
    renameSync(`${pulsePath}.next`, pulsePath);
  };
  const tick = () => {
    if (stopping || inFlight) return;
    inFlight = worker
      .runDeletionForOwner(scope.owner)
      .then(() => {
        pulse('checked');
      })
      .catch((error: unknown) => {
        pulse('unavailable');
        logger.error('PRIVACY_SCOPED_CHECK_FAILED', workerErrorFields(error));
      })
      .finally(() => {
        inFlight = undefined;
      });
  };
  const timer = setInterval(tick, config.getRequired('MASARIFI_SECURITY_WORKER_POLL_MS'));
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    const deadlineMs = config.get('MASARIFI_SHUTDOWN_TIMEOUT_MS');
    const hardStop = setTimeout(() => process.exit(1), deadlineMs);
    hardStop.unref();
    try {
      const shutdown = await new GracefulShutdown(deadlineMs).shutdown(() => inFlight);
      if (shutdown.timedOut) process.exit(1);
      await app.close();
    } finally {
      clearTimeout(hardStop);
    }
  };
  process.once('SIGTERM', () => {
    void stop();
  });
  process.once('SIGINT', () => {
    void stop();
  });
  tick();
  logger.info('platform.started', {
    context: 'StagingPrivacyWorker',
    processKind: 'worker',
    version: scope.source,
  });
  return app;
}

if (require.main === module) {
  void bootstrapStagingPrivacyWorker().catch((error: unknown) => {
    new PlatformLogger((line) => process.stderr.write(line + '\n')).error(
      'PRIVACY_SCOPED_BOOTSTRAP_FAILED',
      workerErrorFields(error),
    );
    process.exitCode = 1;
  });
}
