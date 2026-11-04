import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TrackingController } from '../../../src/tracking/tracking.controller';
import { TrackingService } from '../../../src/tracking/tracking.service';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import type { Server } from 'node:http';

const principal = {
  userId: 'production-http-owner',
  sessionId: 'production-http-session',
  factorAgeSeconds: 0,
};
const deviceId = 'aaaaaaaa-1111-4111-8111-111111111111';
const notificationDeviceId = 'bbbbbbbb-2222-4222-8222-222222222222';
const input = {
  expectedVersion: 0,
  deviceRegistration: {
    deviceFingerprint: 'synthetic-http-device',
    platform: 'android',
    appVersion: '1.0.0',
  },
  sources: { smsEnabled: false, notificationEnabled: false },
};

describe('PUT production installation consent', () => {
  let app: INestApplication<Server>;
  let commandOwners: unknown[][];
  beforeAll(async () => {
    commandOwners = [];
    const repository = new TrackingRepository({
      withClient: async (run: (client: unknown) => Promise<unknown>) =>
        run({
          query: (sql: string, values: unknown[]) => {
            if (sql.includes('configure_tracking_installation')) commandOwners.push(values);
            return Promise.resolve({
              rows: sql.includes(' result')
                ? [
                    {
                      result: {
                        installation: {
                          version: 1,
                          generation: 'cccccccc-3333-4333-8333-333333333333',
                        },
                        keywords: [],
                        senders: [],
                      },
                    },
                  ]
                : [],
            });
          },
        }),
    } as never);
    const service = new TrackingService(
      repository,
      {} as never,
      {} as never,
      { registerDevice: () => Promise.resolve({ device: { id: notificationDeviceId } }) } as never,
      { get: () => false } as never,
    );
    const module = await Test.createTestingModule({
      controllers: [TrackingController],
      providers: [{ provide: TrackingService, useValue: service }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp(): {
            getRequest(): { headers: Record<string, string>; clerkPrincipal?: typeof principal };
          };
        }) {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer synthetic-http-session')
            throw new UnauthorizedException();
          req.clerkPrincipal = principal;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    await app.init();
  });
  afterAll(async () => app.close());
  it('is authenticated under the existing controller guard', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/tracking/installations/${deviceId}`)
      .send(input)
      .expect(401);
    expect(commandOwners).toEqual([]);
  });
  it('handles explicit consent with the principal owner and a server-resolved registered device', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/tracking/installations/${deviceId}`)
      .set('Authorization', 'Bearer synthetic-http-session')
      .send(input)
      .expect(200);
    const body = response.body as { installation: { version: number }; configurationHash: string };
    expect(body.installation.version).toBe(1);
    expect(commandOwners.at(-1)?.slice(0, 4)).toEqual([
      principal.userId,
      deviceId,
      notificationDeviceId,
      0,
    ]);
    expect(body.configurationHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects caller ownership before any configuration command', async () => {
    const before = commandOwners.length;
    await request(app.getHttpServer())
      .put(`/api/v1/tracking/installations/${deviceId}`)
      .set('Authorization', 'Bearer synthetic-http-session')
      .send({ ...input, ownerId: 'foreign-owner' })
      .expect(400);
    expect(commandOwners).toHaveLength(before);
  });
  it('documents explicit consent without caller authority and returns a versioned receipt', () => {
    const spec = load(
      readFileSync('specs/008-tracking-imports-deduplication/contracts/openapi.yaml', 'utf8'),
    ) as {
      paths: Record<string, { put?: unknown }>;
      components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
    };
    expect(spec.paths['/api/v1/tracking/installations/{deviceId}']?.put).toMatchObject({
      operationId: 'configureTrackingInstallation',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true },
    });
    expect(spec.components.schemas.TrackingInstallationConsent).toMatchObject({
      additionalProperties: false,
      required: ['expectedVersion', 'deviceRegistration', 'sources'],
    });
    expect(spec.components.schemas.TrackingInstallationConsent?.properties).not.toHaveProperty(
      'ownerId',
    );
    expect(spec.components.schemas.TrackingInstallationReceipt).toMatchObject({
      additionalProperties: false,
    });
    expect(spec.components.schemas.TrackingInstallationReceipt).toHaveProperty(
      'required',
      expect.arrayContaining(['version', 'generation', 'sources', 'sessionBinding']),
    );
  });
});
