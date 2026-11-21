import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';
import { ClerkClientService } from '../../../src/identity/clerk-client.service';
import { generateOpenApi } from '../../../src/platform/http/openapi';

describe('payment and match HTTP contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkClientService)
      .useValue({
        authenticateRequest: () =>
          Promise.resolve({ isAuthenticated: false, sessionStatus: 'signed_out' }),
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  it('requires an authenticated owner for the payment history read', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/obligations/70000000-0000-4000-8000-000000000031/payments')
      .set('x-user-id', 'untrusted-owner')
      .expect(401);
  });
  it('registers payment record/reversal and bounded match decision operations', () => {
    const runtime = generateOpenApi(app);
    expect(runtime.paths['/api/v1/obligations/{obligationId}/payments']?.get?.operationId).toBe(
      'listObligationPayments',
    );
    expect(runtime.paths['/api/v1/obligations/{obligationId}/payments']?.post?.operationId).toBe(
      'allocateObligationPayment',
    );
    expect(
      runtime.paths['/api/v1/obligations/{obligationId}/payments/{paymentId}/reverse']?.post
        ?.operationId,
    ).toBe('reverseObligationPayment');
    expect(runtime.paths['/api/v1/payment-matches']?.get?.operationId).toBe('listPaymentMatches');
    expect(runtime.paths['/api/v1/payment-matches/{matchId}']?.get?.operationId).toBe(
      'getPaymentMatch',
    );
    const matchDetail = runtime.paths['/api/v1/payment-matches/{matchId}']?.get?.responses['200'];
    const serializedMatchDetail = JSON.stringify(matchDetail);
    for (const field of [
      'transaction',
      'candidate',
      'obligationVersion',
      'suggestedAllocation',
      'advisoryConfidence',
      'reasonCodes',
    ]) {
      expect(serializedMatchDetail).toContain(field);
    }
    expect(runtime.paths['/api/v1/payment-matches/{matchId}']?.patch?.operationId).toBe(
      'decidePaymentMatch',
    );
  });
});
