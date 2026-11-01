import { aiRequestPrincipal } from '../../../src/ai/ai.controller';
import { adminPage } from '../../../src/ai/ai.dto';
it.each([undefined, 'https://admin.example'])(
  'classifies native AI context without changing principal authority (origin %s)',
  (origin) => {
    const original = {
      userId: 'user',
      sessionId: 'session',
      factorAgeSeconds: 450,
      mfaAgeSeconds: 20,
    };
    const principal = aiRequestPrincipal({
      clerkPrincipal: original,
      headers: { ...(origin ? { origin } : {}), 'x-masarifi-platform': 'android' },
    });
    expect(principal).toEqual({ ...original, nativeRequest: !origin });
    expect(original).not.toHaveProperty('nativeRequest');
  },
);
it('normalizes filter scope and rejects unsupported or malformed filters', () => {
  expect(
    adminPage({ search: ' bank ', platform: 'all', period: '7d' }, 'overview').filters,
  ).toEqual({ period: '7d', search: 'bank' });
  for (const query of [
    { plan: 'premium' },
    { platform: 'desktop' },
    { period: '365d' },
    { providerId: 'AIP-fake' },
  ])
    expect(() => adminPage(query, 'overview')).toThrow();
});

it('rejects invalid calendar dates before SQL and normalizes UUID filter scope', () => {
  expect(() => adminPage({ dateFrom: '2026-02-31' }, 'usage')).toThrow();
  expect(
    adminPage({ providerId: '990A0000-0000-4000-8000-000000000001' }, 'usage').filters.providerId,
  ).toBe('990a0000-0000-4000-8000-000000000001');
});
