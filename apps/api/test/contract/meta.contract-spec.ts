import type { INestApplication, Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import Ajv from 'ajv';

import { PlatformConfigService } from '../../src/platform/config/platform-config.service';
import { RequestIdMiddleware } from '../../src/platform/http/request-id.middleware';
import { META_TOKEN_VERIFIER, MetaAuthGuard } from '../../src/platform/meta/meta-auth.guard';
import { MetaController } from '../../src/platform/meta/meta.controller';
import { MetaService } from '../../src/platform/meta/meta.service';
import { PoolService } from '../../src/platform/database/pool.service';

describe('meta contract', () => {
  it('publishes a strict nullable update contract with no arbitrary store URL or contradictory state', () => {
    const document = load(
      readFileSync(
        'specs/013-performance-caching-observability-operations/contracts/openapi.yaml',
        'utf8',
      ),
    ) as {
      paths: Record<
        string,
        {
          get: {
            security: unknown[];
            responses: Record<string, { content: Record<string, { schema: object }> }>;
          };
        }
      >;
    };
    const operation = document.paths['/api/v1/meta/mobile-update'];
    if (!operation) throw new Error('MOBILE_UPDATE_CONTRACT_MISSING');
    expect(operation.get.security).toEqual([]);
    const response = operation.get.responses['200'];
    if (!response?.content['application/json']) throw new Error('MOBILE_UPDATE_SCHEMA_MISSING');
    const validate = new Ajv({ strict: false }).compile(
      response.content['application/json'].schema,
    );
    const disabled = {
      schemaVersion: 1,
      enabled: false,
      release: null,
      storeUrl: 'https://play.google.com/store/apps/details?id=com.masarifi.mobile',
    };
    expect(validate(disabled)).toBe(true);
    expect(
      validate({ ...disabled, enabled: true, release: { version: '1.0.1', versionCode: 140 } }),
    ).toBe(true);
    for (const value of [
      { ...disabled, storeUrl: 'https://example.test' },
      { ...disabled, enabled: true },
      { ...disabled, release: { version: '1.0.1', versionCode: 140 } },
      { ...disabled, extra: true },
    ])
      expect(validate(value)).toBe(false);
  });
  async function createApp(
    verifier?: (token: string) => Promise<boolean>,
    socialLinks?: Record<'instagram' | 'tiktok' | 'snapchat', string>,
    updateConfig: Record<string, unknown> = {},
  ): Promise<INestApplication> {
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            MASARIFI_META_MIN_MOBILE_VERSION: undefined,
            MASARIFI_META_MIN_ADMIN_VERSION: undefined,
            MASARIFI_AI_PROVIDER_ENABLED: false,
            ...updateConfig,
          })[key],
      ),
    };
    const providers: Provider[] = [
      MetaService,
      MetaAuthGuard,
      { provide: PlatformConfigService, useValue: config },
    ];
    if (verifier) providers.push({ provide: META_TOKEN_VERIFIER, useValue: verifier });
    if (socialLinks)
      providers.push({
        provide: PoolService,
        useValue: {
          withClient: (run: (client: { query: (sql: string) => Promise<unknown> }) => unknown) =>
            run({
              query: (sql: string) =>
                Promise.resolve({
                  rows: sql.includes('read_social_media_links') ? [{ value: socialLinks }] : [],
                }),
            }),
        },
      });
    const module = await Test.createTestingModule({
      controllers: [MetaController],
      providers,
    }).compile();
    const app = module.createNestApplication();
    app.use(new RequestIdMiddleware().use);
    await app.init();
    return app;
  }

  it('returns 401 without a bearer token', async () => {
    const app = await createApp();
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/meta')
      .expect(401);
    await app.close();
  });

  it.each([
    [{}, { enabled: false, release: null }],
    [
      {
        MASARIFI_ANDROID_UPDATE_PUBLISHED: true,
        MASARIFI_ANDROID_LATEST_VERSION: 'invalid',
        MASARIFI_ANDROID_LATEST_VERSION_CODE: 140,
      },
      { enabled: false, release: null },
    ],
    [
      {
        MASARIFI_ANDROID_UPDATE_PUBLISHED: true,
        MASARIFI_ANDROID_LATEST_VERSION: '1.0.1',
        MASARIFI_ANDROID_LATEST_VERSION_CODE: 140,
      },
      { enabled: true, release: { version: '1.0.1', versionCode: 140 } },
    ],
  ])(
    'serves the separate public update policy without authentication or stale caching',
    async (config, expected) => {
      const app = await createApp(undefined, undefined, config);
      try {
        const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
          .get('/api/v1/meta/mobile-update')
          .expect(200);
        expect(response.body).toEqual({
          schemaVersion: 1,
          ...expected,
          storeUrl: 'https://play.google.com/store/apps/details?id=com.masarifi.mobile',
        });
        expect(response.headers['cache-control']).toBe('public, no-store');
      } finally {
        await app.close();
      }
    },
  );

  it('authenticates social media reads and returns only the configured accounts without caching', async () => {
    const links = { instagram: 'https://instagram.com/masarifi', tiktok: '', snapchat: '' };
    const app = await createApp(
      (token) => Promise.resolve(token === 'signed.fixture.token'),
      links,
    );
    try {
      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/api/v1/meta/social-media')
        .expect(401);
      const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/api/v1/meta/social-media')
        .set('Authorization', 'Bearer signed.fixture.token')
        .expect(200);
      expect(response.body).toEqual(links);
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally {
      await app.close();
    }
  });

  it('fails closed when the production verifier is unavailable', async () => {
    const app = await createApp();
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/meta')
      .set('Authorization', 'Bearer signed.fixture.token')
      .expect(503);
    await app.close();
  });

  it('returns the exact safe schema only after verifier approval', async () => {
    const verifier = jest.fn().mockResolvedValue(true);
    const app = await createApp(verifier);
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/meta')
      .set('Authorization', 'Bearer signed.fixture.token')
      .expect(200);

    expect(verifier).toHaveBeenCalledWith('signed.fixture.token');
    const body = response.body as Awaited<ReturnType<MetaService['get']>>;
    expect(body).toEqual({
      apiVersion: 'v1',
      serverTime: body.serverTime,
      minMobileVersion: null,
      minAdminVersion: null,
      capabilities: {
        coreFinanceAvailable: true,
        billingAvailable: false,
        paidEntitlement: false,
        checkoutAvailable: false,
        subscriptionManagementAvailable: false,
        promotionsAvailable: false,
        aiAvailable: false,
        aiAllowancePerRolling24Hours: 5,
      },
      maintenance: { active: false, scopes: [], message: null },
      featureFlags: {},
      configurationVersion: 1,
    });
    expect(body.serverTime).toMatch(/Z$/);
    expect(response.headers['cache-control']).toBe('private, max-age=30');
    expect(response.headers.etag).toMatch(/^"[0-9a-f]{64}"$/u);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(50_000);
    await app.close();
  });
});
