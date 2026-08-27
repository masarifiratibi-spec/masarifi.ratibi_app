import 'reflect-metadata';

import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { PlatformConfigService } from '../../src/platform/config/platform-config.service';
import { HealthController } from '../../src/platform/health/health.controller';
import { HealthService } from '../../src/platform/health/health.service';
import { configureHttpSecurity } from '../../src/platform/http/http-security';
import { configureValidation } from '../../src/platform/http/http-validation';
import { RequestIdMiddleware } from '../../src/platform/http/request-id.middleware';
import { RequestTimeoutInterceptor } from '../../src/platform/http/request-timeout.interceptor';
import { SafeExceptionFilter } from '../../src/platform/http/safe-exception.filter';
import { META_TOKEN_VERIFIER, MetaAuthGuard } from '../../src/platform/meta/meta-auth.guard';
import { MetaController } from '../../src/platform/meta/meta.controller';
import { MetaService } from '../../src/platform/meta/meta.service';

const executeFile = promisify(execFile);
const fixtureToken = 'signed.fixture.token';

export function buildPlatformK6Arguments(): string[] {
  return [
    'run',
    '--summary-trend-stats=avg,min,med,max,p(90),p(95),p(99)',
    '--summary-export=test/performance/artifacts/platform-http-summary.json',
    'test/performance/platform-http.k6.js',
  ];
}

type RuntimeMeasurements = {
  coldStartMs: number;
  durationMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  rssSamples: number[];
  eventLoopDelayP95Nanoseconds: number;
};

export function buildRuntimeEvidence(measurements: RuntimeMeasurements) {
  const round = (value: number): number => Number(value.toFixed(3));
  return {
    coldStartMs: round(measurements.coldStartMs),
    durationMs: round(measurements.durationMs),
    cpuUserMs: round(measurements.cpuUserMicros / 1_000),
    cpuSystemMs: round(measurements.cpuSystemMicros / 1_000),
    rssStartBytes: measurements.rssSamples[0],
    rssPeakBytes: Math.max(...measurements.rssSamples),
    rssEndBytes: measurements.rssSamples.at(-1),
    eventLoopDelayP95Ms: round(measurements.eventLoopDelayP95Nanoseconds / 1_000_000),
  };
}

async function run(): Promise<void> {
  const startedAt = performance.now();
  const cpuStartedAt = process.cpuUsage();
  const rssSamples = [process.memoryUsage().rss];
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  eventLoopDelay.enable();
  const health = {
    live: () => ({
      status: 'ok',
      version: 'performance',
      startedAt: new Date().toISOString(),
    }),
    ready: () =>
      Promise.resolve({
        status: 'ready',
        checks: { database: 'up', queue: 'up' },
      }),
  };
  const config = {
    get: (key: string): string | number | undefined =>
      ({
        MASARIFI_CORS_ORIGINS: '',
        MASARIFI_HTTP_BODY_LIMIT_BYTES: 262_144,
        MASARIFI_REQUEST_TIMEOUT_MS: 10_000,
        MASARIFI_META_MIN_MOBILE_VERSION: undefined,
        MASARIFI_META_MIN_ADMIN_VERSION: undefined,
      })[key],
  };
  const module = await Test.createTestingModule({
    controllers: [HealthController, MetaController],
    providers: [
      MetaService,
      MetaAuthGuard,
      { provide: HealthService, useValue: health },
      { provide: PlatformConfigService, useValue: config },
      {
        provide: META_TOKEN_VERIFIER,
        useValue: (token: string) => Promise.resolve(token === fixtureToken),
      },
    ],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  app.use(new RequestIdMiddleware().use);
  configureValidation(app, 262_144);
  configureHttpSecurity(app, config as never);
  app.useGlobalFilters(new SafeExceptionFilter());
  app.useGlobalInterceptors(new RequestTimeoutInterceptor(config as never));
  await app.listen(0, '127.0.0.1');
  const coldStartMs = performance.now() - startedAt;
  const memorySampler = setInterval(() => rssSamples.push(process.memoryUsage().rss), 100);

  try {
    await executeFile('k6', buildPlatformK6Arguments(), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MASARIFI_BASE_URL: await app.getUrl(),
        MASARIFI_TEST_JWT: fixtureToken,
      },
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    });
  } finally {
    clearInterval(memorySampler);
    rssSamples.push(process.memoryUsage().rss);
    eventLoopDelay.disable();
    await app.close();
    const cpu = process.cpuUsage(cpuStartedAt);
    await writeFile(
      'test/performance/artifacts/platform-runtime-summary.json',
      `${JSON.stringify(
        buildRuntimeEvidence({
          coldStartMs,
          durationMs: performance.now() - startedAt,
          cpuUserMicros: cpu.user,
          cpuSystemMicros: cpu.system,
          rssSamples,
          eventLoopDelayP95Nanoseconds: eventLoopDelay.percentile(95),
        }),
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    const message =
      code === 'ENOENT' || code === 'EPERM' ? 'K6_NOT_AVAILABLE' : 'PLATFORM_PERFORMANCE_FAILED';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
