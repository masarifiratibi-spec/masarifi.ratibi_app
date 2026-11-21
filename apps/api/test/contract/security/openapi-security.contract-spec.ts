import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Test } from '@nestjs/testing';
import { load } from 'js-yaml';

import { AppModule } from '../../../src/app.module';
import { generateOpenApi } from '../../../src/platform/http/openapi';

describe('Phase 03 OpenAPI composition', () => {
  it('composes all approved security operations without conflicts', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    await app.init();
    const fragment = load(
      readFileSync(
        resolve(__dirname, '../../../specs/003-admin-rbac-security/contracts/openapi.yaml'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    // Inspect actual controller metadata before fragment composition can fill
    // an unregistered path or replace its authentication/body contract.
    const registered = generateOpenApi(app);
    for (const [path, method, operationId] of [
      ['/api/v1/me/financial-reset', 'post', 'resetMyFinancialData'],
      ['/api/v1/me/financial-reset/state', 'get', 'getMyFinancialResetState'],
      ['/api/v1/me/financial-reset/{id}', 'get', 'getMyFinancialResetReceipt'],
    ] as const) {
      expect(registered.paths[path]?.[method]).toMatchObject({
        operationId,
        security: [{ ClerkBearer: [] }],
      });
      expect(registered.paths[path]?.[method]?.responses).toHaveProperty('200');
    }
    expect(registered.paths['/api/v1/me/financial-reset']?.post?.requestBody).toMatchObject({
      required: true,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/FinancialResetCommand' } },
      },
    });
    expect(registered.components?.schemas?.FinancialResetCommand).toEqual({
      type: 'object',
      properties: { operationId: { type: 'string', format: 'uuid' } },
      required: ['operationId'],
      additionalProperties: false,
    });
    const document = generateOpenApi(app, [fragment]);
    const approvedIds = new Set(
      Object.values(
        fragment.paths as Record<string, Record<string, { operationId?: string }>>,
      ).flatMap((path) =>
        Object.values(path).flatMap(({ operationId }) => (operationId ? [operationId] : [])),
      ),
    );
    let phase3Count = 0;
    for (const path of Object.values(document.paths)) {
      for (const method of ['get', 'post', 'patch', 'delete'] as const) {
        const operationId = path[method]?.operationId;
        if (operationId && approvedIds.has(operationId)) phase3Count += 1;
      }
    }
    expect(phase3Count).toBe(58);
    expect(document.paths['/api/v1/me/financial-reset']?.post?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'X-Financial-Generation',
        in: 'header',
        schema: { type: 'integer', minimum: 0 },
      }),
    );
    expect(
      document.paths['/api/v1/privacy/deletion-completions/{operationId}']?.get?.security,
    ).toEqual([{ DeletionCompletionReceipt: [] }]);
    await app.close();
  });
});
