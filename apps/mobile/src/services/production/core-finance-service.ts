import { createLiveCoreFinanceService } from '../core-finance-runtime';
import type { CategoryLifecycleService } from '../contracts/core-finance-service';
export { createLiveCoreFinanceService } from '../core-finance-runtime';
export const coreFinanceService = createLiveCoreFinanceService();
export const categoryLifecycleService: CategoryLifecycleService = {
  getCategoryUsage: (id) => coreFinanceService.getCategoryUsage(id),
  async setCategoryStatus(id, status, preview) {
    return {
      affectedScopes: (
        await coreFinanceService.setCategoryStatus(id, status, preview)
      ).affectedScopes
    };
  },
  async mergeCategory(source, target, preview) {
    return {
      affectedScopes: (
        await coreFinanceService.mergeCategory(source, target, preview)
      ).affectedScopes
    };
  }
};
