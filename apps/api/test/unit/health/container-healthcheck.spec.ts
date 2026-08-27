import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isLiveResponse } from '../../../src/platform/health/container-healthcheck';

describe('container healthcheck', () => {
  it('accepts only the exact successful liveness result', () => {
    expect(isLiveResponse(200, '{"status":"ok"}')).toBe(true);
    expect(isLiveResponse(503, '{"status":"ok"}')).toBe(false);
    expect(isLiveResponse(200, '{"status":"not_ready"}')).toBe(false);
    expect(isLiveResponse(200, 'not-json')).toBe(false);
  });

  it('queries liveness without probing readiness dependencies', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../src/platform/health/container-healthcheck.ts'),
      'utf8',
    );
    expect(source).toContain("path: '/health/live'");
    expect(source).not.toContain('/health/ready');
  });
});
