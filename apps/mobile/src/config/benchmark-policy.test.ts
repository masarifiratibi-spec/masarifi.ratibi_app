import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import {
  isBenchmarkReadOnly,
  assertBenchmarkRead,
  isAppLockEnabled
} from './client-runtime';
import * as Expo from 'expo';
import { z } from 'zod';
import {
  configureMobileApiTokenProvider,
  requestJson
} from '@/services/live/http-client';
import { benchmarkEnvironment as environment } from '@/test-utils/benchmark-runtime';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
test('read-only policy binds the exact native identity and public markers', () => {
  expect(
    isAppLockEnabled(
      { ...environment, EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' },
      {
        development: false,
        nodeEnvironment: 'production',
        applicationId: 'com.masarifi.mobile.benchmark'
      }
    )
  ).toBe(true);
  expect(
    isBenchmarkReadOnly(environment, 'com.masarifi.mobile.benchmark')
  ).toBe(true);
  for (const appId of ['com.masarifi.mobile', 'com.masarifi.mobile.dev', null])
    expect(() => isBenchmarkReadOnly(environment, appId)).toThrow(/benchmark/i);
  for (const change of [
    { EXPO_PUBLIC_API_URL: environment.EXPO_PUBLIC_API_URL + '/' },
    { EXPO_PUBLIC_APP_VARIANT: undefined },
    { EXPO_PUBLIC_BENCHMARK_READ_ONLY: undefined },
    { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
    { EXPO_PUBLIC_RELEASE_CHANNEL: 'production' }
  ])
    expect(() =>
      isBenchmarkReadOnly(
        { ...environment, ...change },
        'com.masarifi.mobile.benchmark'
      )
    ).toThrow(/benchmark/i);
  expect(isBenchmarkReadOnly({}, 'com.masarifi.mobile')).toBe(false);
  jest.mocked(Expo.requireOptionalNativeModule).mockClear();
  expect(isBenchmarkReadOnly({})).toBe(false);
  expect(Expo.requireOptionalNativeModule).not.toHaveBeenCalled();
  const restoreEnvironment = installBenchmarkEnvironment();
  for (const method of [undefined, 'GET', 'HEAD'])
    expect(() => assertBenchmarkRead(method)).not.toThrow();
  for (const method of [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'TRACE',
    'get'
  ])
    expect(() => assertBenchmarkRead(method)).toThrow('benchmark_read_only');
  restoreEnvironment();
  expect(() => assertBenchmarkRead('POST')).not.toThrow();
});
test('bundled benchmark markers and native identity enforce the real transport boundary', async () => {
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]])
  );
  const native = jest.mocked(Expo.requireOptionalNativeModule);
  native.mockReturnValue({ applicationId: 'com.masarifi.mobile.benchmark' });
  const token = jest.fn(async () => 'inert-token');
  const request = jest.fn(
    async () =>
      new Response(JSON.stringify({ state: 'ready' }), { status: 200 })
  );
  configureMobileApiTokenProvider(token);
  try {
    Object.assign(process.env, environment);
    await expect(
      requestJson('/api/v1/me', z.object({ state: z.string() }), {
        method: 'POST',
        request
      })
    ).rejects.toThrow('benchmark_read_only');
    expect(token).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    await expect(
      requestJson('/api/v1/me', z.object({ state: z.string() }), { request })
    ).resolves.toEqual({ state: 'ready' });
    native.mockReturnValue({ applicationId: 'com.masarifi.mobile' });
    await expect(
      requestJson('/api/v1/me', z.unknown(), { request })
    ).rejects.toThrow('benchmark runtime identity');
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    native.mockReturnValue({ applicationId: 'com.masarifi.mobile.benchmark' });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
