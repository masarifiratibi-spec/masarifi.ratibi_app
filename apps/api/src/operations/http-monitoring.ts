import { open } from 'node:fs/promises';

type Range = '1h' | '24h' | '7d' | '30d';
type Window = { counts: number[]; p95Ms: number | null; complete: boolean };
const hours = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 };
const snapshotPath = '/run/masarifi/metrics/http.json';

function isWindow(value: unknown): value is Window {
  if (!value || typeof value !== 'object') return false;
  const w = value as Partial<Window>;
  if (
    typeof w.complete !== 'boolean' ||
    !Array.isArray(w.counts) ||
    w.counts.length !== 4 ||
    !w.counts.every((n) => Number.isSafeInteger(n) && n >= 0)
  )
    return false;
  const count = w.counts.reduce((a, b) => a + b, 0);
  return (
    Number.isSafeInteger(count) &&
    (count === 0
      ? w.p95Ms === null
      : typeof w.p95Ms === 'number' && Number.isSafeInteger(w.p95Ms) && w.p95Ms >= 0)
  );
}

// Only aggregate output is mounted into the API; the raw journals stay on the host.
export async function readHttpMonitoring(
  range: Range,
  platform: string,
  path = snapshotPath,
  now = Date.now(),
) {
  if (platform !== 'all') return { range, reason: 'platform_unavailable', sample: null };
  let file;
  try {
    file = await open(path, 'r');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT')
      return { range, reason: 'no_observation', sample: null };
    throw err;
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > 8192)
      throw new Error('INVALID_METRICS_SNAPSHOT');
    const data = JSON.parse(await file.readFile('utf8')) as {
      version?: number;
      asOf?: string;
      windows?: Partial<Record<Range, unknown>>;
    };
    const end = typeof data.asOf === 'string' ? Date.parse(data.asOf) : NaN;
    const window = data.windows?.[range];
    if (data.version !== 1 || !Number.isFinite(end) || end > now || !isWindow(window))
      throw new Error('INVALID_METRICS_SNAPSHOT');
    return {
      range,
      reason: null,
      sample: {
        observedAt: new Date(end).toISOString(),
        from: new Date(end - hours[range] * 3600000).toISOString(),
        complete: window.complete,
        counts: window.counts,
        p95Ms: window.p95Ms,
      },
    };
  } finally {
    await file.close();
  }
}
