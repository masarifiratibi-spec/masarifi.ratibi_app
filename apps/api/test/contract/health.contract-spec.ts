import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HealthController } from '../../src/platform/health/health.controller';
import { HealthService } from '../../src/platform/health/health.service';
import { RequestIdMiddleware } from '../../src/platform/http/request-id.middleware';

describe('health contracts', () => {
  let app: INestApplication;
  const health = {
    live: jest.fn(),
    ready: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile();
    app = module.createNestApplication();
    app.use(new RequestIdMiddleware().use);
    await app.init();
  });

  afterEach(async () => app.close());

  it('returns the exact constant liveness body and a request ID', async () => {
    health.live.mockReturnValue({
      status: 'ok',
      version: 'test',
      startedAt: '2026-08-27T00:00:00.000Z',
    });
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server).get('/health/live').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: 'test',
      startedAt: '2026-08-27T00:00:00.000Z',
    });
    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
  });

  it('returns safe readiness success', async () => {
    health.ready.mockResolvedValue({
      status: 'ready',
      checks: { database: 'up', queue: 'up' },
    });
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server).get('/health/ready').expect(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'up', queue: 'up' },
    });
  });

  it('declares cross-feature protocol support without session or financial data', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/health/compatibility').expect(200);
    expect(response.body).toEqual({
      schemaVersion: 1,
      contracts: {
        voiceSession: 2,
        voiceBatch: 3,
        voiceExtraction: 3,
        voiceWorker: 1,
        voiceConfirmation: 2,
        assistantDirect: 2,
        assistantProvider: 1,
        manualReceipt: 1,
      },
    });
    expect(Object.keys(response.body as Record<string, unknown>)).toEqual([
      'schemaVersion',
      'contracts',
    ]);
  });

  it('returns safe readiness failure without dependency details', async () => {
    health.ready.mockResolvedValue({
      status: 'not_ready',
      checks: { database: 'down', queue: 'up' },
    });
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server).get('/health/ready').expect(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { database: 'down', queue: 'up' },
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('shares an unfinished probe even when the completed-result cache is disabled', async () => {
    let finish!: (checks: { database: 'up'; queue: 'down' }) => void;
    const pending = new Promise<{ database: 'up'; queue: 'down' }>((resolve) => {
      finish = resolve;
    });
    const check = jest
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ database: 'up', queue: 'up' });
    const config = {
      get: (key: string) => (key === 'MASARIFI_READINESS_CACHE_TTL_MS' ? 0 : 1_000),
    };
    const service = new HealthService(config as never, { check } as never);
    const burst = Array.from({ length: 12 }, () => service.ready());
    expect(check).toHaveBeenCalledTimes(1);
    finish({ database: 'up', queue: 'down' });
    for (const result of await Promise.all(burst)) {
      expect(result).toEqual({ status: 'not_ready', checks: { database: 'up', queue: 'down' } });
    }
    expect((await service.ready()).status).toBe('ready');
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('keeps an outstanding probe from announcing readiness after shutdown', async () => {
    const check = jest.fn().mockResolvedValue({ database: 'up', queue: 'up' });
    const config = { get: () => 1_000 };
    const service = new HealthService(config as never, { check } as never);
    const pending = service.ready();
    service.beginShutdown();
    await expect(pending).resolves.toEqual({
      status: 'not_ready',
      checks: { database: 'down', queue: 'down' },
    });
    expect((await service.ready()).status).toBe('not_ready');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('reports not ready immediately when shutdown begins', async () => {
    const check = jest.fn().mockResolvedValue({ database: 'up', queue: 'up' });
    const config = {
      get: jest.fn((key: string) =>
        key === 'MASARIFI_READINESS_CACHE_TTL_MS'
          ? 0
          : key === 'MASARIFI_READINESS_TIMEOUT_MS'
            ? 1_000
            : 'test',
      ),
    };
    const service = new HealthService(config as never, { check } as never);

    await expect(service.ready()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up', queue: 'up' },
    });
    service.beginShutdown();
    check.mockClear();
    await expect(service.ready()).resolves.toEqual({
      status: 'not_ready',
      checks: { database: 'down', queue: 'down' },
    });
    expect(check).not.toHaveBeenCalled();
  });
});
