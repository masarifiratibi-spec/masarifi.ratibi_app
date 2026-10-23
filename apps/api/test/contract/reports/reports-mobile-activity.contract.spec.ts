import type { ExecutionContext } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../../../src/identity/clerk-auth.guard';
import { ReportsMobileActivityController } from '../../../src/reports/reports-mobile-activity.controller';
import { ReportsRepository } from '../../../src/reports/reports.repository';

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
        .send({ platform: 'ios', body: 'private content' })
        .expect(400);
      expect(repository.recordMobileActivity).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
