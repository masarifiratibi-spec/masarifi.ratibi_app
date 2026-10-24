import { HttpException, Injectable, type OnModuleDestroy } from '@nestjs/common';

import { AiPrivacyHandler } from '../ai/ai-privacy.handler';
import { AiStorage } from '../ai/ai.storage';
import { EngagementPrivacyHandler } from '../engagement/engagement-privacy.handler';
import { SupportStorage } from '../engagement/support.storage';
import { ClerkClientService } from '../identity/clerk-client.service';
import { IdentityPrivacyHandler } from '../identity/identity-privacy.handler';
import type { PlatformEnvironment } from '../platform/config/environment.types';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { PoolService } from '../platform/database/pool.service';
import { ReportsStorage } from '../reports/reports.storage';
import { TrackingPrivacyHandler } from '../tracking/tracking-privacy.handler';
import { TrackingStorage } from '../tracking/tracking.storage';
import { ExportStorage } from './export-storage';
import { OwnerDataErasureService } from './owner-data-erasure.service';
import { SecurityRepository } from './security.repository';
import { SecurityWorkerService } from './security.worker';

@Injectable()
export class ImmediateDeletionService implements OnModuleDestroy {
  private readonly pool?: PoolService;
  private readonly repository?: SecurityRepository;
  private readonly worker?: SecurityWorkerService;

  constructor(config: PlatformConfigService, clerk: ClerkClientService) {
    if (config.getRequired('MASARIFI_DELETION_COOLING_OFF_HOURS') !== 0) return;
    // Every deletion handler uses its own worker credential; ordinary API connections stay API-only.
    this.pool = new PoolService({
      get: (key: keyof PlatformEnvironment) =>
        key === 'DATABASE_URL'
          ? config.getRequired('MASARIFI_PRIVACY_DATABASE_URL')
          : key === 'MASARIFI_PROCESS_KIND'
            ? 'worker'
            : config.get(key),
    } as PlatformConfigService);
    this.repository = new SecurityRepository(this.pool);
    const exports = new ExportStorage(config);
    const support = new SupportStorage(config);
    const erasure = new OwnerDataErasureService(
      this.pool,
      new ReportsStorage(config),
      exports,
      support,
    );
    this.worker = new SecurityWorkerService(
      this.repository,
      exports,
      new IdentityPrivacyHandler(this.pool, clerk),
      new TrackingPrivacyHandler(this.pool, new TrackingStorage(config)),
      new AiPrivacyHandler(this.pool, new AiStorage(config)),
      new EngagementPrivacyHandler(this.pool, support),
      config,
      erasure,
    );
  }

  runDeletionRequestForOwner(userId: string, requestId: string): Promise<unknown> {
    if (!this.worker) throw new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
    return this.worker.runDeletionRequestForOwner(userId, requestId);
  }

  getCompletion(operationId: string, tokenHash: string, networkHash: string) {
    if (!this.repository) throw new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
    return this.repository.getDeletionCompletion(operationId, tokenHash, networkHash);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.onModuleDestroy();
  }
}
