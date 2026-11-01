import { isFixtureModeEnabled } from '@/config/demo-mode';
import type { FinancialPlanningService } from './contracts/financial-planning-service';
import type { CapabilityProviderHandle } from './contracts/capability-contract';
import { createLiveFinancialPlanningService } from './live/financial-planning-service';
import { createLiveCategoryLifecycleService } from './live/category-lifecycle-service';
import {
  financialPlanningService as fixtureFinancialPlanningService,
  createSeededFinancialPlanningService
} from './mocks/financial-planning-service';

const categories = createLiveCategoryLifecycleService();

export const financialPlanningService: CapabilityProviderHandle<FinancialPlanningService> =
  isFixtureModeEnabled()
    ? fixtureFinancialPlanningService
    : createLiveFinancialPlanningService({ categoryIds: {
        prepare: categories.prepareCategoryIds,
        toServer: categories.serverCategoryId,
        toLocal: categories.localCategoryId
      } });

export {
  createLiveFinancialPlanningService,
  createSeededFinancialPlanningService
};
