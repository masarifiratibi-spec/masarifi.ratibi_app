import { createLiveFinancialPlanningService } from '../live/financial-planning-service';
import { createLiveCategoryLifecycleService } from '../live/category-lifecycle-service';
const categories = createLiveCategoryLifecycleService();
export const financialPlanningService = createLiveFinancialPlanningService({
  categoryIds: {
    prepare: categories.prepareCategoryIds,
    toServer: categories.serverCategoryId,
    toLocal: categories.localCategoryId
  }
});
export { createLiveFinancialPlanningService } from '../live/financial-planning-service';
