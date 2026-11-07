import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { PoolClient } from 'pg';
import request from 'supertest';
import {
  ClerkAuthGuard,
  type ClerkPrincipal,
  type ClerkPrincipalRequest,
} from '../../../src/identity/clerk-auth.guard';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { FinancialResetController } from '../../../src/security/financial-reset.controller';
import { FinancialResetService } from '../../../src/security/financial-reset.service';
import { SecurityRepository } from '../../../src/security/security.repository';

describe('owner financial reset routes', () => {
  const path = '/api/v1/me/financial-reset';
  const id = 'ab460621-5fba-456b-a53b-f88542a308a6';
  let app: INestApplication;
  const query = jest.fn<
    Promise<{ rows: unknown[] }>,
    [string | { text: string; values: string[] }, string[]?]
  >();
  const transaction = jest.fn(
    (_principal: ClerkPrincipal, action: (client: PoolClient) => unknown) =>
      action({ query } as unknown as PoolClient),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinancialResetController],
      providers: [
        FinancialResetService,
        { provide: SecurityRepository, useValue: { withPrincipalTransaction: transaction } },
        { provide: PlatformConfigService, useValue: { getRequired: () => 300 } },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<ClerkPrincipalRequest>();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.clerkPrincipal = {
            userId: req.headers.authorization,
            sessionId: 'session',
            factorAgeSeconds: req.header('stale') ? null : 0,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects unsigned requests, stale authentication, forged ownership and malformed operation ids before SQL', async () => {
    const http = request(app.getHttpServer() as Server);
    await http.post(path).send({ operationId: id }).expect(401);
    await http
      .post(path)
      .set('authorization', 'owner')
      .set('stale', '1')
      .send({ operationId: id })
      .expect(403);
    await http
      .post(path)
      .set('authorization', 'owner')
      .send({ operationId: id, userId: 'other' })
      .expect(400);
    await http
      .post(path)
      .set('authorization', 'owner')
      .send({ operationId: 'invalid' })
      .expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('submits the same session owner and operation id on retries', async () => {
    query.mockResolvedValue({ rows: [{ generation: '3', request_id: id, cleanup_pending: true }] });
    for (let retry = 0; retry < 2; retry++) {
      await request(app.getHttpServer() as Server)
        .post(path)
        .set('authorization', 'owner')
        .send({ operationId: id })
        .expect(200, { id, status: 'processing', generation: 3 });
    }
    const resets = query.mock.calls.filter(([sql]) => typeof sql === 'object');
    expect(resets).toHaveLength(2);
    for (const [sql] of resets) expect(sql).toMatchObject({ values: ['owner', id] });
  });

  it('reads active owner state and hides another owner’s operation', async () => {
    query.mockResolvedValueOnce({
      rows: [{ generation: '0', reset_at: null, request_id: null, cleanup_pending: false }],
    });
    await request(app.getHttpServer() as Server)
      .get(path + '/state')
      .set('authorization', 'other')
      .expect('Cache-Control', 'no-store')
      .expect(200, { generation: 0, resetAt: null, status: 'ready', requestId: null });
    query.mockResolvedValueOnce({ rows: [] });
    await request(app.getHttpServer() as Server)
      .get(path + '/' + id)
      .set('authorization', 'other')
      .expect(404);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('financial_reset_receipt'), [
      'other',
      id,
    ]);
    query.mockResolvedValueOnce({
      rows: [{ generation: '1', request_id: id, cleanup_pending: false }],
    });
    await request(app.getHttpServer() as Server)
      .get(path + '/' + id)
      .set('authorization', 'owner')
      .expect(200, { generation: 1, id, status: 'completed' });
  });
});
