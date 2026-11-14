import 'reflect-metadata';
import { Module, type OnModuleDestroy } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PlatformConfigModule } from './platform/config/platform-config.module';
import { PlatformConfigService } from './platform/config/platform-config.service';
import { GracefulShutdown } from './platform/observability/graceful-shutdown';
import { PlatformLogger } from './platform/observability/platform-logger';
import { workerErrorFields } from './platform/observability/worker-error';
import { ReportsWorkerModule } from './reports/reports.module';
import { ReportsWorker, validateRequestedPdfEmailScope } from './reports/reports.worker';

@Module({ imports: [PlatformConfigModule, ReportsWorkerModule] })
class RequestedPdfEmailWorkerModule implements OnModuleDestroy {
  private cleanup?: () => void;
  registerCleanup(cleanup: () => void) {
    this.cleanup = cleanup;
  }
  onModuleDestroy() {
    this.cleanup?.();
  }
}

export async function bootstrapReportsEmailWorker(acceptedAfter: string) {
  validateRequestedPdfEmailScope(acceptedAfter);
  const app = await NestFactory.createApplicationContext(RequestedPdfEmailWorkerModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  const logger = new PlatformLogger();
  app.useLogger(logger);
  const config = app.get(PlatformConfigService);
  const worker = app.get(ReportsWorker);
  const lifecycle: { timer?: NodeJS.Timeout; closing?: Promise<void> } = {};
  const stopping = new AbortController();
  const close = () => {
    stopping.abort();
    if (lifecycle.timer) clearInterval(lifecycle.timer);
    lifecycle.closing ??= (async () => {
      const shutdown = new GracefulShutdown(config.getRequired('MASARIFI_SHUTDOWN_TIMEOUT_MS'));
      const { timedOut } = await shutdown.shutdown(() => worker.stop());
      if (timedOut) process.exitCode = 1;
      await app.close();
    })();
    return lifecycle.closing;
  };
  const onStop = () => {
    void close().catch((error: unknown) => {
      logger.error('REPORT_EMAIL_SHUTDOWN_FAILED', workerErrorFields(error));
      process.exitCode = 1;
    });
  };
  process.once('SIGTERM', onStop);
  app.get(RequestedPdfEmailWorkerModule).registerCleanup(() => {
    stopping.abort();
    if (lifecycle.timer) clearInterval(lifecycle.timer);
    process.removeListener('SIGTERM', onStop);
  });
  try {
    // Refuse an absent scoped RPC before publishing readiness or starting a timer.
    await worker.runRequestedPdfEmailsOnce(acceptedAfter);
  } catch (error) {
    process.removeListener('SIGTERM', onStop);
    await close();
    throw error;
  }
  if (stopping.signal.aborted) {
    await lifecycle.closing;
    return app;
  }
  lifecycle.timer = setInterval(() => {
    void worker.runRequestedPdfEmailsOnce(acceptedAfter).catch((error: unknown) => {
      logger.error('REPORT_EMAIL_POLL_FAILED', workerErrorFields(error));
    });
  }, config.getRequired('MASARIFI_REPORT_POLL_MS'));
  logger.info('REPORT_EMAIL_WORKER_READY', {
    context: 'RequestedPdfEmailWorker',
    processKind: 'worker',
  });
  return app;
}

if (require.main === module)
  void bootstrapReportsEmailWorker(process.argv[2] ?? '').catch((error: unknown) => {
    new PlatformLogger().error('REPORT_EMAIL_WORKER_BOOTSTRAP_FAILED', workerErrorFields(error));
    process.exitCode = 1;
  });
