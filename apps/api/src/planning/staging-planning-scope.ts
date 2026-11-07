import type { PlatformConfigService } from '../platform/config/platform-config.service';

export function isStagingPlanningOwner(
  config: PlatformConfigService | undefined,
  userId: string,
): boolean {
  return (
    config?.get('MASARIFI_PROCESS_KIND') === 'api' &&
    config.get('SUPABASE_URL') === 'https://qcffvfbpzvpwcwxwjyro.supabase.co' &&
    config.get('MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID') === userId
  );
}
