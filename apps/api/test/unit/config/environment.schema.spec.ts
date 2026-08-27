import { validateEnvironment } from '../../../src/platform/config/environment.schema';

const valid = {
  NODE_ENV: 'test',
  MASARIFI_PROCESS_KIND: 'api',
  MASARIFI_RELEASE_VERSION: 'test-release',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/test',
};

describe('validateEnvironment', () => {
  it('accepts the minimum valid API environment', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      NODE_ENV: 'test',
      MASARIFI_PROCESS_KIND: 'api',
      MASARIFI_RELEASE_VERSION: 'test-release',
    });
  });

  it.each(['NODE_ENV', 'MASARIFI_PROCESS_KIND', 'MASARIFI_RELEASE_VERSION', 'DATABASE_URL'])(
    'rejects missing %s without echoing values',
    (key) => {
      const candidate = { ...valid };
      Reflect.deleteProperty(candidate, key);
      expect(() => validateEnvironment(candidate)).toThrow(key);
    },
  );

  it('rejects unknown application variables', () => {
    expect(() => validateEnvironment({ ...valid, MASARIFI_UNKNOWN: 'secret-value' })).toThrow(
      'MASARIFI_UNKNOWN',
    );
  });

  it('does not echo a malformed secret', () => {
    const sentinel = 'SENTINEL_DATABASE_SECRET';
    try {
      validateEnvironment({ ...valid, DATABASE_URL: sentinel });
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(String(error)).not.toContain(sentinel);
    }
  });

  it('enforces readiness and shutdown ceilings', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        MASARIFI_READINESS_CACHE_TTL_MS: '5001',
        MASARIFI_SHUTDOWN_TIMEOUT_MS: '30001',
      }),
    ).toThrow();
  });

  it.each(['*', 'http://admin.example.test', 'https://localhost:3000'])(
    'rejects unsafe production CORS origin %s',
    (origin) => {
      expect(() =>
        validateEnvironment({
          ...valid,
          NODE_ENV: 'production',
          MASARIFI_CORS_ORIGINS: origin,
        }),
      ).toThrow('MASARIFI_CORS_ORIGINS');
    },
  );
});
