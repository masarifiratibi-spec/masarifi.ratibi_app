import 'reflect-metadata';

import { ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { ClerkClientService } from '../../../src/identity/clerk-client.service';
import { IdentityController } from '../../../src/identity/identity.controller';
import { IdentityRepository } from '../../../src/identity/identity.repository';
import { IdentityService } from '../../../src/identity/identity.service';
import { PushTokenCrypto } from '../../../src/identity/push-token.crypto';
import { LedgerController } from '../../../src/ledger/ledger.controller';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { PlanningRepository } from '../../../src/planning/planning.repository';
import { PlanningService } from '../../../src/planning/planning.service';
import { validateEnvironment } from '../../../src/platform/config/environment.schema';
import type { PlatformEnvironment } from '../../../src/platform/config/environment.types';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { PoolService } from '../../../src/platform/database/pool.service';
import { SchemaCompatibilityService } from '../../../src/platform/database/schema-compatibility';
import { configureHttpSecurity } from '../../../src/platform/http/http-security';
import { configureValidation } from '../../../src/platform/http/http-validation';
import { RequestIdMiddleware } from '../../../src/platform/http/request-id.middleware';
import { RequestTimeoutInterceptor } from '../../../src/platform/http/request-timeout.interceptor';
import { SafeExceptionFilter } from '../../../src/platform/http/safe-exception.filter';
import {
  META_TOKEN_VERIFIER,
  MetaAuthGuard,
  type MetaTokenVerifier,
} from '../../../src/platform/meta/meta-auth.guard';
import { MetaController } from '../../../src/platform/meta/meta.controller';
import { MetaService } from '../../../src/platform/meta/meta.service';
import { ReferenceController } from '../../../src/reference/reference.controller';
import { ReferenceRepository } from '../../../src/reference/reference.repository';
import { ReferenceService } from '../../../src/reference/reference.service';
import { ReportsController } from '../../../src/reports/reports.controller';
import { ReportsRepository } from '../../../src/reports/reports.repository';
import { ReportsService } from '../../../src/reports/reports.service';
import { AdminAuthGuard } from '../../../src/security/admin-auth.guard';
import { SecurityRepository } from '../../../src/security/security.repository';
import { SyncController } from '../../../src/sync/sync.controller';
import { SyncHandlers } from '../../../src/sync/sync.handlers';
import { SyncRepository } from '../../../src/sync/sync.repository';
import { SyncService } from '../../../src/sync/sync.service';
import type { FixtureClerkVerifier } from './fixture-clerk-verifier';
import { qaRouteBoundary } from './qa-route-boundary';

function pushCrypto(config: PlatformConfigService): PushTokenCrypto {
  const hashKey = Buffer.from(config.getRequired('MASARIFI_PUSH_TOKEN_HASH_KEY'), 'base64url');
  const keyRing = config
    .getRequired('MASARIFI_PUSH_TOKEN_ENCRYPTION_KEYS')
    .split(',')
    .map((entry) => {
      const separator = entry.indexOf(':');
      return {
        id: entry.slice(0, separator),
        key: Buffer.from(entry.slice(separator + 1), 'base64url'),
      };
    });
  return new PushTokenCrypto(hashKey, keyRing);
}

function configureQaHttp(app: NestExpressApplication): void {
  const config = app.get(PlatformConfigService);
  app.use(app.get(RequestIdMiddleware).use);
  configureHttpSecurity(app, config);
  app.use(qaRouteBoundary);
  const syncLimit = config.get('MASARIFI_SYNC_PAYLOAD_LIMIT_BYTES');
  configureValidation(app, config.get('MASARIFI_HTTP_BODY_LIMIT_BYTES'), [], {
    '/api/v1/sync/mutations': syncLimit,
    '/api/v1/conflicts/:conflictId': syncLimit,
  });
  app.useGlobalFilters(new SafeExceptionFilter());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new RequestTimeoutInterceptor(config),
  );
}

/** Test-only DI graph: real application behavior with one external verifier replacement. */
export async function createQaApplication(
  environment: Record<string, string>,
  verifier: FixtureClerkVerifier,
): Promise<NestExpressApplication> {
  const config = new ConfigService<PlatformEnvironment, true>(validateEnvironment(environment));
  const module = await Test.createTestingModule({
    controllers: [
      IdentityController,
      ReferenceController,
      LedgerController,
      ReportsController,
      SyncController,
      MetaController,
    ],
    providers: [
      { provide: ConfigService, useValue: config },
      PlatformConfigService,
      Reflector,
      PoolService,
      SchemaCompatibilityService,
      ClerkClientService,
      ClerkAuthGuard,
      IdentityRepository,
      IdentityService,
      ReferenceService,
      ReferenceRepository,
      LedgerService,
      LedgerRepository,
      AdminAuthGuard,
      SecurityRepository,
      ReportsService,
      ReportsRepository,
      SyncService,
      SyncRepository,
      SyncHandlers,
      PlanningService,
      PlanningRepository,
      MetaService,
      MetaAuthGuard,
      RequestIdMiddleware,
      { provide: PushTokenCrypto, inject: [PlatformConfigService], useFactory: pushCrypto },
      {
        provide: META_TOKEN_VERIFIER,
        inject: [ClerkAuthGuard],
        useFactory:
          (guard: ClerkAuthGuard): MetaTokenVerifier =>
          (token) =>
            guard.verifyToken(token),
      },
    ],
  })
    .overrideProvider(ClerkClientService)
    .useValue(verifier)
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
  configureQaHttp(app);
  return app;
}
