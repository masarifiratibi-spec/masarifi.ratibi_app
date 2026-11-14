import { isFixtureModeEnabled } from '@/config/demo-mode';
import type { CapabilityProviderHandle } from './contracts/capability-contract';
import type { ReportsService } from './contracts/reports-service';
import { createLiveReportsService } from './live/reports-service';
import { reportsService as fixtureReportsService } from './mocks/reports-service';
import { ReportsRepository } from '@/storage/reports-repository';

export function selectReportsService(
  fixtureMode: boolean,
  live: CapabilityProviderHandle<ReportsService>
): CapabilityProviderHandle<ReportsService> {
  return fixtureMode ? fixtureReportsService : live;
}

export const reportsService = selectReportsService(
  isFixtureModeEnabled(),
  createLiveReportsService({
    repository: new ReportsRepository(true)
  })
);

export {
  createLiveReportsService,
  ReportsApiError
} from './live/reports-service';
