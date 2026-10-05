import { NestFactory } from '@nestjs/core';
import { AiWorker } from '../../../src/ai/ai.worker';
import { OperationsWorker } from '../../../src/operations/operations.worker';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { bootstrapWorker } from '../../../src/worker';

jest.mock('@nestjs/core', () => ({ NestFactory: { createApplicationContext: jest.fn() } }));
jest.mock('../../../src/worker.module', () => ({ WorkerModule: class {} }));
jest.mock('../../../src/platform/observability/telemetry', () => ({
  startTelemetry: () => Promise.resolve({ shutdown: () => Promise.resolve() }),
}));
jest.mock('../../../src/platform/observability/platform-logger', () => ({
  PlatformLogger: class {
    info() {}
  },
}));

it('starts only the analysis worker from the real bootstrap selection', async () => {
  const started: string[] = [];
  const before = new Set(process.listeners('SIGTERM'));
  const app = {
    get: (token: unknown) => {
      if (token === PlatformConfigService)
        return {
          get: (key: string) =>
            key === 'MASARIFI_VOICE_ANALYSIS_ONLY'
              ? true
              : key === 'MASARIFI_SHUTDOWN_TIMEOUT_MS'
                ? 1000
                : undefined,
        };
      if (token === AiWorker)
        return { start: () => started.push('analysis'), stop: () => Promise.resolve() };
      if (token === OperationsWorker) throw new Error('GENERAL_WORKER_ACCESSED');
      throw new Error('UNEXPECTED_PROVIDER');
    },
    useLogger: () => undefined,
    close: () => Promise.resolve(),
  };
  jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app as never);
  try {
    await bootstrapWorker();
    expect(started).toEqual(['analysis']);
  } finally {
    for (const listener of process.listeners('SIGTERM'))
      if (!before.has(listener)) process.removeListener('SIGTERM', listener);
  }
});
