import type { EntryRouteInput } from './resolve-entry-route';
import { resolveEntryRoute } from './resolve-entry-route';

const deepLinkTargets: Record<string, string> = {
  home: '/(tabs)/home',
  transactions: '/(tabs)/transactions',
  add: '/(tabs)/add',
  reports: '/(tabs)/reports',
  more: '/(tabs)/more',
  accounts: '/accounts',
  assistant: '/assistant',
  tracking: '/tracking'
};

export function resolveDeepLinkEntry(
  url: string,
  state: Omit<EntryRouteInput, 'pendingDestination'>
) {
  return resolveEntryRoute({
    ...state,
    pendingDestination: parseDeepLinkDestination(url)
  });
}

export function parseDeepLinkDestination(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.search) return null;
    return (
      deepLinkTargets[parsed.hostname || parsed.pathname.replace('/', '')] ??
      null
    );
  } catch {
    return null;
  }
}
