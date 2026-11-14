import { NestFactory } from '@nestjs/core';
import { StagingVoiceWorker } from '../../../src/ai/staging-voice.worker';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { bootstrapStagingVoiceWorker } from '../../../src/staging-voice-worker';

jest.mock('@nestjs/core', () => ({ NestFactory: { createApplicationContext: jest.fn() } }));
jest.mock('../../../src/staging-voice-worker.module', () => ({
  StagingVoiceWorkerModule: class {},
}));
jest.mock('../../../src/platform/observability/telemetry', () => ({
  startTelemetry: () => Promise.resolve({ shutdown: () => Promise.resolve() }),
}));
jest.mock('../../../src/platform/observability/platform-logger', () => ({
  PlatformLogger: class {
    info() {}
  },
}));
it('boots only the dedicated lifecycle and never resolves a broad scheduler', async () => {
  const started: string[] = [];
  const before = new Set(process.listeners('SIGTERM'));
  const app = {
    get: (token: unknown) => {
      if (token === PlatformConfigService)
        return {
          get: (key: string) => (key === 'MASARIFI_SHUTDOWN_TIMEOUT_MS' ? 1000 : undefined),
        };
      if (token === StagingVoiceWorker)
        return { start: () => started.push('voice-epoch'), stop: () => Promise.resolve() };
      throw Error('UNRELATED_WORKER_ACCESSED');
    },
    useLogger: () => undefined,
    close: () => Promise.resolve(),
  };
  jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app as never);
  try {
    await bootstrapStagingVoiceWorker();
    expect(started).toEqual(['voice-epoch']);
  } finally {
    for (const listener of process.listeners('SIGTERM'))
      if (!before.has(listener)) process.removeListener('SIGTERM', listener);
  }
});
