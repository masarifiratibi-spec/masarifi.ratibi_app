import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import {
  measurePerformance,
  readPerformanceTimings,
  recordPerformanceTiming,
  readPerformanceSpans
} from './performance-timing';

it('retains bounded timings without recording private request data', async () => {
  const secret = { token: 'private', balance: 12345 };
  for (let i = 0; i < 70; i++) {
    expect(await measurePerformance('planning.auth', async () => secret)).toBe(
      secret
    );
  }
  const timings = readPerformanceTimings();
  expect(timings['planning.auth']).toHaveLength(50);
  expect(
    timings['planning.auth']?.every(
      (value) => Number.isFinite(value) && value >= 0
    )
  ).toBe(true);
  expect(JSON.stringify(timings)).not.toMatch(/private|token|balance/);
});

it('exposes bounded chronological spans without retaining action payloads', () => {
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  try {
    for (let i = 0; i < 210; i++) recordPerformanceTiming('planning.read', 25);
    const spans = readPerformanceSpans();
    expect(spans).toHaveLength(200);
    expect(spans[199]).toEqual({ stage: 'planning.read', startedAt: 75, endedAt: 100 });
    (spans as unknown[]).pop();
    expect(readPerformanceSpans()).toHaveLength(200);
  } finally {
    clock.mockRestore();
  }
});

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
it('exposes benchmark stage duration and process-relative event time', () => {
  const restore =
    installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  try {
    recordPerformanceTiming('startup.fonts', 25);
    expect(
      log.mock.calls
        .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
        .map(([, json]) => JSON.parse(json as string))
    ).toEqual([
      { kind: 'timing', stage: 'startup.fonts', elapsedMs: 25, atMs: 100 }
    ]);
  } finally {
    clock.mockRestore();
    log.mockRestore();
    restore();
  }
});
