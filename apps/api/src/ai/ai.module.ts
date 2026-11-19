import { Module } from '@nestjs/common';
import { PlatformLogger } from '../platform/observability/platform-logger';

import { IdentityModule, IdentityWorkerModule } from '../identity/identity.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PlanningModule } from '../planning/planning.module';
import { DatabaseModule } from '../platform/database/database.module';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { SecurityModule } from '../security/security.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ReportsModule } from '../reports/reports.module';
import { AssistantFinancialTools } from './ai-financial-tools';
import { AiController } from './ai.controller';
import { AiAdminController } from './ai.admin.controller';
import { AiGateway } from './ai.gateway';
import { AiRepository } from './ai.repository';
import { AiService } from './ai.service';
import { AiStorage } from './ai.storage';
import { AiWorker } from './ai.worker';
import { AiNoStoreInterceptor } from './ai-no-store.interceptor';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    SecurityModule,
    LedgerModule,
    PlanningModule,
    TrackingModule,
    ReportsModule,
  ],
  controllers: [AiController, AiAdminController],
  providers: [AiRepository, AiStorage, AiService, AssistantFinancialTools, AiNoStoreInterceptor],
})
export class AiModule {}

@Module({
  imports: [DatabaseModule, IdentityWorkerModule],
  providers: [
    AiRepository,
    AiStorage,
    {
      provide: 'AI_GATEWAY',
      inject: [PlatformConfigService, AiRepository],
      useFactory: (config: PlatformConfigService, circuit: AiRepository) => {
        const logger = new PlatformLogger();
        return new AiGateway({
          circuit,
          apiKey: config.get('OPENROUTER_API_KEY'),
          onAttempt: (fields) => {
            logger.info('AI_PROVIDER_ATTEMPT', fields);
          },
        });
      },
    },
    AiWorker,
  ],
  exports: [AiWorker, AiRepository, AiStorage],
})
export class AiWorkerModule {}
