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
