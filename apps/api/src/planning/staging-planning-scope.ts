import { isProjectRuntime } from '../platform/config/runtime-scope';
import type { PlatformConfigService } from '../platform/config/platform-config.service';

export function isStagingPlanningOwner(
  config: PlatformConfigService | undefined,
  userId: string,
): boolean {
  return (
    config?.get('MASARIFI_PROCESS_KIND') === 'api' &&
    isProjectRuntime(config) &&
    config.get('MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID') === userId
  );
}
