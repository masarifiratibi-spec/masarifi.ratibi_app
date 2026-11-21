import { isDemoModeEnabled } from '@/config/demo-mode';
import type { Locale } from '@/domain/foundation';

export async function synchronizeClientDemoLocale(
  locale: Locale,
  now = Date.now()
): Promise<boolean> {
  if (!isDemoModeEnabled()) return false;
  // Keep Metro's synchronous module loading behind the demo-only boundary.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { seedClientDemoData } = require('@/storage/client-demo-seeder') as typeof import('@/storage/client-demo-seeder');
  const changed = await seedClientDemoData({ locale, now });
  const [coreFinance, financialPlanning, automaticTracking] = await Promise.all([
    import('./core-finance-service'),
    import('./financial-planning-service'),
    import('./automatic-tracking-service')
  ]);
  coreFinance.relocalizeDemoCoreFinanceRepository(locale);
  financialPlanning.relocalizeDemoFinancialPlanningRepository(locale);
  automaticTracking.relocalizeDemoAutomaticTrackingRepository(locale);
  return changed;
}
