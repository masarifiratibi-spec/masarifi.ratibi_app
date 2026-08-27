import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureRequestDrain, drainApplication } from '../../src/platform/http/request-drain';
import { GracefulShutdown } from '../../src/platform/observability/graceful-shutdown';

let releaseRequest: () => void;
let requestStarted: () => void;

@Controller('drain-probe')
class DrainProbeController {
  @Get()
  async get(): Promise<{ status: string }> {
    requestStarted();
    await new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    return { status: 'finished' };
  }
}

describe('API graceful shutdown', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) await app.close().catch(() => undefined);
  });

  it('drains an active request before closing the API', async () => {
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const module = await Test.createTestingModule({
      controllers: [DrainProbeController],
    }).compile();
    app = module.createNestApplication();
    const shutdown = new GracefulShutdown(1_000);
    configureRequestDrain(app, shutdown);
    await app.listen(0);

    const activeRequest = request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/drain-probe')
      .then((response) => response);
    await started;

    const health = { beginShutdown: jest.fn() };
    const telemetry = {
      enabled: false,
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const draining = drainApplication(app, health, telemetry, shutdown);
    releaseRequest();

    await expect(activeRequest).resolves.toMatchObject({
      status: 200,
      body: { status: 'finished' },
    });
    await expect(draining).resolves.toEqual({ timedOut: false });
    expect(health.beginShutdown).toHaveBeenCalledTimes(1);
    expect(telemetry.shutdown).toHaveBeenCalledTimes(1);
    app = undefined;
  });

  it('returns a bounded safe 503 after shutdown starts', async () => {
    const module = await Test.createTestingModule({
      controllers: [DrainProbeController],
    }).compile();
    app = module.createNestApplication();
    const shutdown = new GracefulShutdown(1_000);
    configureRequestDrain(app, shutdown);
    await app.listen(0);
    await shutdown.shutdown(() => undefined);

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/drain-probe')
      .set('X-Request-Id', 'shutdown-request')
      .expect(503);

    expect(response.body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable',
      requestId: 'shutdown-request',
    });
    expect(response.headers['x-request-id']).toBe('shutdown-request');
  });
});
