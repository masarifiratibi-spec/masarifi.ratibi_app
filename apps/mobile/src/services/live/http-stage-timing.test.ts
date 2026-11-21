import { z } from 'zod';
import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import { configureMobileApiTokenProvider, requestJson } from './http-client';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

it('separates token acquisition, body decoding and validation without retaining the payload', async () => {
  const restore = installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  let elapsed = 100;
  const clock = jest
    .spyOn(performance, 'now')
    .mockImplementation(() => elapsed);
  configureMobileApiTokenProvider(async () => {
    elapsed += 7;
    return 'PRIVATE_TOKEN';
  });
  try {
    const schema = z.object({ state: z.string() }).transform((payload) => {
      elapsed += 17;
      return payload;
    });
    const request = async () => {
      elapsed += 11;
      return {
        ok: true,
        status: 200,
        json: async () => {
          elapsed += 13;
          return { state: 'PRIVATE_RESULT' };
        }
      } as Response;
    };
    await expect(
      requestJson('/api/v1/me', schema, {
        request,
        baseUrl: 'https://inert.invalid'
      })
    ).resolves.toEqual({ state: 'PRIVATE_RESULT' });
    const events = log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, json]) => JSON.parse(json));
    expect(
      events
        .filter((event) => event.kind === 'timing')
        .map(({ stage, elapsedMs }) => [stage, elapsedMs])
    ).toEqual([
      ['http.auth', 7],
      ['http.body', 13],
      ['http.validation', 17]
    ]);
    expect(JSON.stringify(events)).not.toMatch(/PRIVATE|inert/);
  } finally {
    restore();
    log.mockRestore();
    clock.mockRestore();
  }
});
