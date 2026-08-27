import { ReadinessCache } from '../../../src/platform/health/readiness-cache';

describe('ReadinessCache', () => {
  it('returns the cached value before expiry', () => {
    const cache = new ReadinessCache<string>(5_000);
    cache.set('ready', 10_000);

    expect(cache.get(14_999)).toBe('ready');
  });

  it('expires success and failure values at the configured TTL', () => {
    const cache = new ReadinessCache<string>(5_000);
    cache.set('not_ready', 10_000);

    expect(cache.get(15_000)).toBeUndefined();
  });

  it('disables caching at zero TTL', () => {
    const cache = new ReadinessCache<string>(0);
    cache.set('ready', 10_000);

    expect(cache.get(10_000)).toBeUndefined();
  });

  it('rejects a TTL above five seconds', () => {
    expect(() => new ReadinessCache(5_001)).toThrow('READINESS_CACHE_TTL_INVALID');
  });
});
