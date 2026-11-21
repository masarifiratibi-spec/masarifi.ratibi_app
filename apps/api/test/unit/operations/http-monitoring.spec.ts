import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readHttpMonitoring } from '../../../src/operations/http-monitoring';

it('serves only validated aggregate data for a measured range and platform', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'api-observation-'));
  const path = join(dir, 'http.json');
  const date = '2026-11-19T10:00:00.000Z';
  const now = Date.parse(date);
  try {
    expect(await readHttpMonitoring('1h', 'all', path, now)).toMatchObject({
      sample: null,
      reason: 'no_observation',
    });
    const input = {
      version: 1,
      asOf: date,
      windows: { '1h': { counts: [18, 0, 1, 1], p95Ms: 19, complete: false } },
    };
    await writeFile(path, JSON.stringify(input));
    expect(await readHttpMonitoring('1h', 'all', path, now)).toEqual({
      range: '1h',
      reason: null,
      sample: {
        observedAt: date,
        from: '2026-11-19T09:00:00.000Z',
        counts: [18, 0, 1, 1],
        p95Ms: 19,
        complete: false,
      },
    });
    expect(await readHttpMonitoring('1h', 'android', path, now)).toMatchObject({ sample: null });
    await expect(readHttpMonitoring('7d', 'all', path, now)).rejects.toThrow();
    input.windows['1h'].counts[0] = -1;
    await writeFile(path, JSON.stringify(input));
    await expect(readHttpMonitoring('1h', 'all', path, now)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
