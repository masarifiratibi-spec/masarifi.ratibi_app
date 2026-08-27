import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { configureHttpSecurity } from '../../src/platform/http/http-security';

@Controller('probe')
class ProbeController {
  @Get()
  get(): object {
    return { ok: true };
  }
}

describe('HTTP security contract', () => {
  async function createApp(origins: string): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    const app = module.createNestApplication<NestExpressApplication>();
    configureHttpSecurity(app, { get: () => origins } as never);
    await app.init();
    return app;
  }

  it('allows only exact configured origins and emits Helmet headers', async () => {
    const app = await createApp('https://admin.example.test');
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const allowed = await request(server)
      .get('/probe')
      .set('Origin', 'https://admin.example.test')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://admin.example.test');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');

    const denied = await request(server)
      .get('/probe')
      .set('Origin', 'https://admin.example.test.evil.test')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('rejects a credentialed wildcard configuration', async () => {
    await expect(createApp('*')).rejects.toThrow('CORS_ORIGIN_INVALID');
  });

  it('does not expose Swagger UI', async () => {
    const app = await createApp('https://admin.example.test');
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/docs')
      .expect(404);
    await app.close();
  });
});
