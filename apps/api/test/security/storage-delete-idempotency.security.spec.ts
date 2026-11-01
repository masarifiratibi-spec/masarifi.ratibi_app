import { SupportStorage } from '../../src/engagement/support.storage';
import type { PlatformConfigService } from '../../src/platform/config/platform-config.service';
import { ReportsStorage } from '../../src/reports/reports.storage';

const config = {
  getRequired: (name: string) =>
    ({
      SUPABASE_URL: 'https://storage.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'private-service-key',
      NODE_ENV: 'test',
      MASARIFI_SUPPORT_SIGNED_URL_SECONDS: 120,
    })[name],
} as unknown as PlatformConfigService;

const adapters = [
  {
    name: 'reports',
    failure: 'REPORT_STORAGE_UNAVAILABLE',
    create: (fetcher: typeof fetch) => {
      const storage = new ReportsStorage(config, fetcher);
      const key = storage.key('99000000-0000-4000-8000-000000000001', 'private-owner', 'pdf');
      return { remove: () => storage.delete(key), read: () => storage.verify(key, 1) };
    },
  },
  {
    name: 'support',
    failure: 'SUPPORT_STORAGE_UNAVAILABLE',
    create: (fetcher: typeof fetch) => {
      const storage = new SupportStorage(config, fetcher);
      const key =
        'support/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002';
      return { remove: () => storage.delete(key), read: () => storage.read(key) };
    },
  },
];

describe.each(adapters)('$name missing-object deletion', ({ create, failure }) => {
  afterEach(() => jest.useRealTimers());

  it('accepts the actual hosted legacy HTTP400 NoSuchKey response on repeated deletion', async () => {
    // 2026-10-16 real hosted DELETE: absent objects return HTTP400 with statusCode404.
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'NoSuchKey', statusCode: '404', message: 'Object not found' }),
            { status: 400 },
          ),
        ),
      );
    const storage = create(fetcher);
    await expect(storage.remove()).resolves.toBeUndefined();
    await expect(storage.remove()).resolves.toBeUndefined();
  });

  it.each([
    [400, { code: 'NoSuchBucket', statusCode: '404' }],
    [400, { code: 'NoSuchKey', statusCode: '403' }],
    [401, { code: 'NoSuchKey', statusCode: '404' }],
  ])('keeps HTTP%s provider errors %j retryable as domain failures', async (status, payload) => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status }));
    await expect(create(fetcher).remove()).rejects.toThrow(failure);
  });

  it('preserves HTTP404 idempotency and rejects missing errors on other operations', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'NoSuchKey' }), { status: 400 }));
    const storage = create(fetcher);
    await expect(storage.remove()).resolves.toBeUndefined();
    await expect(storage.read()).rejects.toThrow(failure);
  });

  it('rejects oversized error bodies without treating their NoSuchKey prefix as success', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'NoSuchKey', message: 'x'.repeat(4096) }), {
        status: 400,
      }),
    );
    await expect(create(fetcher).remove()).rejects.toThrow(failure);
  });

  it('keeps the ten-second deadline active while an error body stalls', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>((_, input) => {
      signal = input?.signal;
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>(), { status: 400 }));
    });
    const rejected = expect(create(fetcher).remove()).rejects.toThrow(failure);
    await jest.advanceTimersByTimeAsync(9999);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signal?.aborted).toBe(true);
  });
});
