import request from 'supertest';
import { hashNormalizedCommand } from '../../../src/ledger/idempotency';
import type { ReferenceOperation } from '../../../src/reference/reference.repository';

import { createReferenceE2eHarness, type ReferenceE2eHarness } from './reference-e2e-harness';

describe('category HTTP lifecycle', () => {
  let harness: ReferenceE2eHarness;
  beforeAll(async () => {
    harness = await createReferenceE2eHarness();
  });
  afterAll(async () => harness.app.close());

  it('requires authentication and idempotency before creating', async () => {
    harness.auth.user = false;
    await request(harness.server).get('/api/v1/categories').expect(401);
    harness.auth.user = true;
    await request(harness.server)
      .post('/api/v1/categories')
      .send({ labelAr: 'طعام', labelEn: 'Food' })
      .expect(400)
      .expect((response) => {
        expect((response.body as unknown as { code: unknown }).code).toBe(
          'IDEMPOTENCY_KEY_REQUIRED',
        );
      });
  });

  it('creates and archives through the canonical paths', async () => {
    await request(harness.server)
      .post('/api/v1/categories')
      .set('Idempotency-Key', 'valid-key')
      .send({ labelAr: 'طعام', labelEn: 'Food' })
      .expect(201);
    await request(harness.server)
      .get('/api/v1/categories/10000000-0000-4000-8000-000000000001/usage')
      .expect(200)
      .expect({ linkedTransactionCount: 0, version: 1 });
    await request(harness.server)
      .delete(
        '/api/v1/categories/10000000-0000-4000-8000-000000000001?expectedVersion=1&expectedLinkedTransactionCount=0',
      )
      .set('Idempotency-Key', 'valid-key')
      .expect(204);
  });

  it.each([{}, { icon: null, color: null, parentId: null }])('canonicalizes real Express 5 route params and optional category fields (%j)', async (optionalFields) => {
    let fingerprint: string | undefined;
    harness.execute.mockImplementationOnce((input: ReferenceOperation) => {
      fingerprint = hashNormalizedCommand({ operation: input.operation, body: input.body, params: input.params });
      return Promise.resolve({ id: '10000000-0000-4000-8000-000000000002', version: 1 });
    });
    await request(harness.server)
      .post('/api/v1/categories')
      .set('Idempotency-Key', 'express-params-category-key')
      .send({ labelAr: 'مجموعة اختبار', labelEn: 'Test group', ...optionalFields })
      .expect(201)
      .expect({ id: '10000000-0000-4000-8000-000000000002', version: 1 });
    expect(fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
