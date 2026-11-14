import { Module } from '@nestjs/common';

import { DatabaseModule } from '../platform/database/database.module';
import { IdentityModule, IdentityWorkerModule } from '../identity/identity.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { FinancialResetController } from './financial-reset.controller';
import { FinancialResetService } from './financial-reset.service';
import { FinancialResetWorker } from './financial-reset.worker';
import { SecurityController } from './security.controller';
import { ExportStorage } from './export-storage';
import { SecurityRepository } from './security.repository';
import { SecurityService } from './security.service';
import { SecurityWorkerService } from './security.worker';
import { TrackingPrivacyHandler } from '../tracking/tracking-privacy.handler';
import { TrackingStorage } from '../tracking/tracking.storage';
import { AiPrivacyHandler } from '../ai/ai-privacy.handler';
import { AiStorage } from '../ai/ai.storage';
import { EngagementPrivacyHandler } from '../engagement/engagement-privacy.handler';
import { SupportStorage } from '../engagement/support.storage';
import { ReportsStorage } from '../reports/reports.storage';
import { OwnerDataErasureService } from './owner-data-erasure.service';
import { ImmediateDeletionService } from './immediate-deletion.service';
import { DeletionCompletionController } from './deletion-completion.controller';

@Module({
  imports: [DatabaseModule, IdentityWorkerModule],
  providers: [
    SecurityRepository,
    ExportStorage,
    TrackingStorage,
    TrackingPrivacyHandler,
    AiStorage,
    AiPrivacyHandler,
    SupportStorage,
    EngagementPrivacyHandler,
    SecurityWorkerService,
    ReportsStorage,
    FinancialResetWorker,
    OwnerDataErasureService,
  ],
  exports: [SecurityWorkerService, FinancialResetWorker],
})
export class SecurityWorkerModule {}

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [SecurityController, DeletionCompletionController, FinancialResetController],
  providers: [
    SecurityRepository,
    SecurityService,
    AdminAuthGuard,
    ExportStorage,
    ImmediateDeletionService,
    FinancialResetService,
  ],
  exports: [SecurityRepository, SecurityService, AdminAuthGuard],
})
export class SecurityModule {}
