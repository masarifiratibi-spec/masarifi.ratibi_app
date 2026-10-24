import { Platform } from 'react-native';
import { isDemoModeEnabled, isFixtureModeEnabled } from '@/config/demo-mode';
import {
  createDefaultAccount,
  createDefaultCategories,
  createDemoAccounts,
  createDemoTransactions,
  legacyFixtureAccounts,
  legacyFixtureTransactions
} from '@/domain/core-finance-seeds';
import type { Locale } from '@/domain/foundation';
import type { CategoryLifecycleService } from '@/services/contracts/core-finance-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  createLocalCoreFinanceService as createMockCoreFinanceService,
  createLiveCoreFinanceService
} from '../core-finance-runtime';
export {
  createLocalCoreFinanceService as createMockCoreFinanceService,
  createLiveCoreFinanceService
} from '../core-finance-runtime';
export function createSeededCoreFinanceService() {
  return createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: legacyFixtureAccounts,
      categories: createDefaultCategories(),
      transactions: legacyFixtureTransactions
    }),
    { persistent: Platform.OS !== 'web' && process.env.NODE_ENV !== 'test' }
  );
}

let demoCoreFinanceRepository: CoreFinanceRepository | null = null;

export function createProductionCoreFinanceService(locale: Locale = 'ar') {
  const demo = isDemoModeEnabled();
  if (!isFixtureModeEnabled(process.env.NODE_ENV, demo))
    return createLiveCoreFinanceService();
  const repository = demo
    ? createDemoCoreFinanceRepository(locale)
    : new CoreFinanceRepository({
        accounts: [createDefaultAccount()],
        categories: createDefaultCategories(),
        cleanupLegacyFixtures: true
      });
  if (demo) demoCoreFinanceRepository = repository;
  const fixture = createMockCoreFinanceService(repository, {
    persistent: Platform.OS !== 'web' && process.env.NODE_ENV !== 'test',
    registerForReset: true
  });
  return fixture;
}

export function createDemoCoreFinanceService(locale: Locale = 'ar') {
  return createMockCoreFinanceService(createDemoCoreFinanceRepository(locale), {
    persistent: Platform.OS !== 'web' && process.env.NODE_ENV !== 'test'
  });
}

function createDemoCoreFinanceRepository(locale: Locale) {
  const now = Date.now();
  return new CoreFinanceRepository({
    accounts: createDemoAccounts(now, locale),
    categories: createDefaultCategories(),
    transactions: createDemoTransactions(now, locale),
    replaceEmptyDefaultLedger: true
  });
}

export const coreFinanceService = createProductionCoreFinanceService();
export const categoryLifecycleService: CategoryLifecycleService = {
  getCategoryUsage: (id) => coreFinanceService.getCategoryUsage(id),
  async setCategoryStatus(id, status, preview) {
    const result = await coreFinanceService.setCategoryStatus(
      id,
      status,
      preview
    );
    return { affectedScopes: result.affectedScopes };
  },
  async mergeCategory(sourceId, targetId, preview) {
    const result = await coreFinanceService.mergeCategory(
      sourceId,
      targetId,
      preview
    );
    return { affectedScopes: result.affectedScopes };
  }
};

export function relocalizeDemoCoreFinanceRepository(locale: Locale): void {
  const now = Date.now();
  demoCoreFinanceRepository?.relocalizeDemoFixtures({
    accounts: createDemoAccounts(now, locale),
    transactions: createDemoTransactions(now, locale)
  });
}
