type ReadProvenance = { source: 'offline' | 'remote'; atMs: number };
const provenance = new WeakMap<object, ReadProvenance>();

/** Non-enumerable, ephemeral provenance never changes persisted or wire payloads. */
export function markOfflineSnapshot<T>(snapshot: T): T {
  if (typeof snapshot === 'object' && snapshot !== null)
    provenance.set(snapshot, { source: 'offline', atMs: performance.now() });
  return snapshot;
}

export function markRemoteSnapshot<T>(snapshot: T): T {
  if (typeof snapshot === 'object' && snapshot !== null)
    provenance.set(snapshot, { source: 'remote', atMs: performance.now() });
  return snapshot;
}

export function offlineSnapshot(snapshot: unknown): boolean {
  if (typeof snapshot !== 'object' || snapshot === null) return false;
  return (
    provenance.get(snapshot)?.source === 'offline' ||
    ('dataState' in snapshot && snapshot.dataState === 'offline') ||
    ('pages' in snapshot &&
      Array.isArray(snapshot.pages) &&
      snapshot.pages.some(
        (page) =>
          typeof page === 'object' &&
          page !== null &&
          provenance.get(page)?.source === 'offline'
      ))
  );
}

export function remoteSnapshotSince(snapshot: unknown, atMs: number): boolean {
  if (typeof snapshot !== 'object' || snapshot === null) return false;
  const read = provenance.get(snapshot);
  return read?.source === 'remote' && read.atMs >= atMs;
}

export function inheritReadProvenance<T>(
  snapshot: T,
  sources: readonly unknown[]
): T {
  if (sources.some(offlineSnapshot)) return markOfflineSnapshot(snapshot);
  if (typeof snapshot !== 'object' || snapshot === null || !sources.length)
    return snapshot;
  const reads = sources.map((source) =>
    typeof source === 'object' && source !== null
      ? provenance.get(source)
      : undefined
  );
  if (reads.every((read) => read?.source === 'remote'))
    provenance.set(snapshot, {
      source: 'remote',
      atMs: Math.min(...reads.map((read) => read!.atMs))
    });
  return snapshot;
}

/** An authoritative access/deletion response must never be hidden by an old snapshot. */
export function isAuthoritativeReadDenial(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    code?: unknown;
    status?: unknown;
    metadata?: { status?: unknown };
  };
  return (
    [
      'forbidden',
      'permission_required',
      'consent_required',
      'session_expired',
      'recent_auth_required',
      'not_found',
      'gone',
      'expired',
      'unauthorized'
    ].includes(String(value.code).toLowerCase()) ||
    [401, 403, 404, 410].includes(
      Number(value.status ?? value.metadata?.status)
    )
  );
}

export function hasReadableSnapshot(query: {
  data: unknown;
  isError: boolean;
  error?: unknown;
}): boolean {
  return (
    query.data !== undefined &&
    query.data !== null &&
    !(query.isError && isAuthoritativeReadDenial(query.error))
  );
}
