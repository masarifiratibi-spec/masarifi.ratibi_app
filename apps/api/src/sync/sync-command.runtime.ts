import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { LedgerRepository } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import { PlanningRepository } from '../planning/planning.repository';
import { PlanningService } from '../planning/planning.service';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import type { PlatformEnvironment } from '../platform/config/environment.types';
import { PoolService } from '../platform/database/pool.service';
import { ReferenceRepository } from '../reference/reference.repository';
import { ReferenceService } from '../reference/reference.service';
import { SecurityRepository } from '../security/security.repository';
import { SyncHandlers } from './sync.handlers';
import { SyncRepository } from './sync.repository';

@Injectable()
export class SyncCommandRuntime implements OnModuleDestroy {
  private command?: { pool: PoolService; handlers: SyncHandlers; repository: SyncRepository };

  constructor(private readonly config: PlatformConfigService) {
    const url = config.get('MASARIFI_SYNC_COMMAND_DATABASE_URL');
    const dedicatedAi =
      config.get('MASARIFI_AI_ASSISTANT_ONLY') || config.get('MASARIFI_VOICE_ANALYSIS_ONLY');
    if ((!url && !dedicatedAi) || (url && url === config.getRequired('DATABASE_URL')))
      throw new Error('SYNC_COMMAND_DATABASE_CONFIG_INVALID');
  }

  dispatch(...args: Parameters<SyncHandlers['dispatch']>): ReturnType<SyncHandlers['dispatch']> {
    return this.commands().handlers.dispatch(...args);
  }

  conflictTarget(
    ...args: Parameters<SyncRepository['conflictTarget']>
  ): ReturnType<SyncRepository['conflictTarget']> {
    return this.commands().repository.conflictTarget(...args);
  }

  async onModuleDestroy(): Promise<void> {
    await this.command?.pool.onModuleDestroy();
  }

  private commands() {
    if (this.command) return this.command;
    const url = this.config.getRequired('MASARIFI_SYNC_COMMAND_DATABASE_URL');
    const get = (key: keyof PlatformEnvironment) =>
      key === 'DATABASE_URL' ? url : key === 'MASARIFI_PROCESS_KIND' ? 'api' : this.config.get(key);
    const apiConfig = {
      get,
      getRequired: (key: keyof PlatformEnvironment) => {
        const selected = get(key);
        if (selected === undefined || selected === '')
          throw new Error(`Missing required environment variable: ${key}`);
        return selected;
      },
    } as PlatformConfigService;
    const pool = new PoolService(apiConfig);
    const ledger = new LedgerService(
      new LedgerRepository(pool, apiConfig),
      new SecurityRepository(pool),
      apiConfig,
    );
    this.command = {
      pool,
      handlers: new SyncHandlers(
        new ReferenceService(new ReferenceRepository(pool), ledger),
        ledger,
        new PlanningService(new PlanningRepository(pool, apiConfig)),
      ),
      repository: new SyncRepository(pool),
    };
    return this.command;
  }
}
