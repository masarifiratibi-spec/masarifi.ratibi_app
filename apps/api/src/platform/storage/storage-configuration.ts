import type { PlatformConfigService } from '../config/platform-config.service';
import { logContext } from '../observability/log-context';

export function correlatedStorageFetch(fetcher: typeof fetch): typeof fetch {
  return function (this: unknown, input, init) {
    const requestId = logContext.getStore()?.requestId;
    if (!requestId) return fetcher.call(this, input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set('x-request-id', requestId);
    return fetcher.call(this, input, { ...init, headers });
  };
}

export function storageConfiguration(config: PlatformConfigService): {
  origin: URL;
  credential: string;
} {
  const local = config.getRequired('MASARIFI_STORAGE_PROVIDER') === 'filesystem';
  return {
    origin: new URL(config.getRequired(local ? 'MASARIFI_STORAGE_URL' : 'SUPABASE_URL')),
    credential: config.getRequired(
      local ? 'MASARIFI_STORAGE_SERVICE_KEY' : 'SUPABASE_SERVICE_ROLE_KEY',
    ),
  };
}
