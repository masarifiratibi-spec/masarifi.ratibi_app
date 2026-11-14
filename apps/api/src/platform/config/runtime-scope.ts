import type { PlatformConfigService } from './platform-config.service';

type Scope = Partial<
  Record<
    | 'SUPABASE_URL'
    | 'MASARIFI_RUNTIME_SCOPE'
    | 'MASARIFI_STORAGE_PROVIDER'
    | 'MASARIFI_STORAGE_URL',
    unknown
  >
>;

export function isProjectRuntimeEnvironment(environment: Scope): boolean {
  if (environment.MASARIFI_RUNTIME_SCOPE === 'project-server') {
    if (
      environment.MASARIFI_STORAGE_PROVIDER !== 'filesystem' ||
      typeof environment.MASARIFI_STORAGE_URL !== 'string' ||
      environment.SUPABASE_URL
    )
      return false;
    try {
      const origin = new URL(environment.MASARIFI_STORAGE_URL);
      return (
        origin.protocol === 'https:' &&
        !origin.username &&
        !origin.password &&
        origin.pathname === '/' &&
        !origin.search &&
        !origin.hash
      );
    } catch {
      return false;
    }
  }
  // Compatibility during rehearsal: existing deployments remain pinned until explicitly migrated.
  return (
    (!environment.MASARIFI_RUNTIME_SCOPE ||
      environment.MASARIFI_RUNTIME_SCOPE === 'supabase-staging') &&
    environment.SUPABASE_URL === 'https://qcffvfbpzvpwcwxwjyro.supabase.co'
  );
}

export function isProjectRuntime(config: PlatformConfigService): boolean {
  return isProjectRuntimeEnvironment({
    SUPABASE_URL: config.get('SUPABASE_URL'),
    MASARIFI_RUNTIME_SCOPE: config.get('MASARIFI_RUNTIME_SCOPE'),
    MASARIFI_STORAGE_PROVIDER: config.get('MASARIFI_STORAGE_PROVIDER'),
    MASARIFI_STORAGE_URL: config.get('MASARIFI_STORAGE_URL'),
  });
}
