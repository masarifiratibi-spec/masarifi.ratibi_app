import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { load } from 'js-yaml';
import { AppModule } from '../../../src/app.module';
import { generateOpenApi } from '../../../src/platform/http/openapi';

describe('Phase 09 assistant contract', () => {
  const contract = load(
    readFileSync('specs/009-voice-openrouter-financial-assistant/contracts/openapi.yaml', 'utf8'),
  ) as { paths: Record<string, Record<string, { operationId?: string }>> };
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('keeps unique documented operations including automatic Voice batch recovery', () => {
    const operations = Object.values(contract.paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
        .map(([, value]) => value.operationId),
    );
    expect(operations).toHaveLength(54);
    expect(new Set(operations).size).toBe(54);
    const runtime = generateOpenApi(app);
    expect(runtime.paths['/api/v1/assistant/consent']?.put?.operationId).toBe(
      'grantAssistantConsent',
    );
    expect(runtime.paths['/api/v1/assistant/availability']?.get?.operationId).toBe(
      'getAssistantAvailability',
    );
    expect(runtime.paths['/api/v1/assistant/insights']?.get?.operationId).toBe(
      'listAssistantInsights',
    );
    expect(
      runtime.paths['/api/v1/assistant/conversations/{conversationId}/messages']?.post?.operationId,
    ).toBe('createAssistantMessage');
    expect(runtime.paths['/api/v1/assistant/previews/{previewId}/confirm']?.post?.operationId).toBe(
      'confirmAssistantPreview',
    );
  });
  it('uses defined authentication schemes for Voice recovery', () => {
    const document = contract as typeof contract & {
      components: { securitySchemes: Record<string, unknown> };
      security: Record<string, unknown>[];
    };
    for (const path of [
      '/api/v1/voice/batches/recovery',
      '/api/v1/voice/sessions/{sessionId}/batch',
    ]) {
      const operation = document.paths[path]?.get as { security?: Record<string, unknown>[] };
      const requirements = operation.security ?? document.security;
      expect(requirements.length).toBeGreaterThan(0);
      for (const requirement of requirements)
        for (const scheme of Object.keys(requirement))
          expect(document.components.securitySchemes).toHaveProperty(scheme);
    }
  });
});
