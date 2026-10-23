import type { ExecutionContext } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../../../src/identity/clerk-auth.guard';
import { ReportsMobileActivityController } from '../../../src/reports/reports-mobile-activity.controller';
import { ReportsRepository } from '../../../src/reports/reports.repository';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { generateOpenApi } from '../../../src/platform/http/openapi';

describe('native activity admission', () => {
  it('accepts authenticated native signals and rejects web origins and content', async () => {
    const repository = { recordMobileActivity: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      controllers: [ReportsMobileActivityController],
      providers: [{ provide: ReportsRepository, useValue: repository }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<ClerkPrincipalRequest>().clerkPrincipal = {
            userId: 'customer',
            sessionId: 'native',
            factorAgeSeconds: 0,
          };
          return true;
        },
      })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    const server = app.getHttpServer() as Server;
    try {
      const fragment = load(
        readFileSync(
          resolve(
            __dirname,
            '../../../specs/010-reports-analytics-exports-email/contracts/openapi.yaml',
          ),
          'utf8',
        ),
      ) as Record<string, unknown>;
      const operation = generateOpenApi(app, [fragment]).paths['/api/v1/me/mobile-activity']?.post;
      expect(operation).toMatchObject({
        operationId: 'recordMobileActivity',
        security: [{ ClerkBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['platform'],
                properties: { platform: { type: 'string', enum: ['ios', 'android'] } },
              },
            },
          },
        },
      });
      expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
        '204',
        '400',
        '401',
        '403',
        '429',
        '503',
      ]);
      await request(server)
        .post('/api/v1/me/mobile-activity')
        .send({ platform: 'ios' })
        .expect(204);
      await request(server)
        .post('/api/v1/me/mobile-activity')
        .set('Origin', 'https://admin.example')
        .send({ platform: 'ios' })
        .expect(403);
      await request(server)
        .post('/api/v1/me/mobile-activity')
        .send({ platform: 'web' })
        .expect(400);
      await request(server)
        .post('/api/v1/me/mobile-activity')
        .send({ platform: ['ios'] })
        .expect(400);
      await request(server)
        .post('/api/v1/me/mobile-activity')
        .send({ platform: 'ios', body: 'private content' })
        .expect(400);
      expect(repository.recordMobileActivity).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
