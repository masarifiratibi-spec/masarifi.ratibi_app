import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { StagingVoiceWorker } from './ai/staging-voice.worker';
import { PlatformConfigService } from './platform/config/platform-config.service';
import { PlatformLogger } from './platform/observability/platform-logger';
import { workerErrorFields } from './platform/observability/worker-error';
import { GracefulShutdown } from './platform/observability/graceful-shutdown';
import { startTelemetry } from './platform/observability/telemetry';

export async function bootstrapStagingVoiceWorker(): Promise<INestApplicationContext> {
  const { StagingVoiceWorkerModule } = await import('./staging-voice-worker.module');
  const app = await NestFactory.createApplicationContext(StagingVoiceWorkerModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  const config = app.get(PlatformConfigService);
  const worker = app.get(StagingVoiceWorker);
  const logger = new PlatformLogger(undefined, config.get('MASARIFI_LOG_LEVEL'));
  const telemetry = await startTelemetry(process.env);
  const shutdown = new GracefulShutdown(config.get('MASARIFI_SHUTDOWN_TIMEOUT_MS'));
  app.useLogger(logger);
  process.once('SIGTERM', () => {
    void (async () => {
      const { timedOut } = await shutdown.shutdown(() => worker.stop());
      if (timedOut) process.exitCode = 1;
      try {
        await app.close();
      } finally {
        await telemetry.shutdown();
      }
    })();
  });
  worker.start();
  logger.info('platform.started', {
    context: 'StagingVoiceWorker',
    processKind: 'worker',
    version: config.get('MASARIFI_RELEASE_VERSION'),
  });
  return app;
}
if (require.main === module) {
  void bootstrapStagingVoiceWorker().catch((error: unknown) => {
    new PlatformLogger((line) => process.stderr.write(line + '\n')).error(
      'VOICE_SCOPED_BOOTSTRAP_FAILED',
      { failureStage: 'bootstrap', ...workerErrorFields(error) },
    );
    process.exitCode = 1;
  });
}
