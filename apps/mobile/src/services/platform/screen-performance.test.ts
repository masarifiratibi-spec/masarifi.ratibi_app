import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import { beginScreenNavigation, mountScreenTrace } from './screen-performance';
import { recordBenchmarkEvent } from './benchmark-observability';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

it('correlates a measured tap with only fixed route and readiness fields', () => {
  const restore = installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  try {
    beginScreenNavigation('/accounts');
    clock.mockReturnValue(130);
    const trace = mountScreenTrace('accounts');
    trace.layout(100, 100);
    trace.observe('cached');
    trace.frame();
    const events = log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, event]) => JSON.parse(event));
    expect(events.map((event) => event.phase)).toEqual([
      'start',
      'visible',
      'cached',
      'interactive'
    ]);
    expect(new Set(events.map((event) => event.navigationSequence)).size).toBe(
      1
    );
    expect(events[3]).toMatchObject({
      route: 'accounts',
      origin: 'tap',
      elapsedMs: 30,
      freshness: 'cached'
    });
    expect(Object.keys(events[3]).sort()).toEqual([
      'atMs',
      'elapsedMs',
      'freshness',
      'kind',
      'navigationSequence',
      'origin',
      'phase',
      'route'
    ]);
  } finally {
    restore();
    log.mockRestore();
    clock.mockRestore();
  }
});

it('drops forged routes and extra sensitive fields from the diagnostic boundary', () => {
  const restore = installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(200);
  try {
    const event = {
      kind: 'screen',
      route: 'accounts',
      phase: 'visible',
      origin: 'mount',
      freshness: 'pending',
      navigationSequence: 1,
      elapsedMs: 0,
      token: 'PRIVATE'
    };
    recordBenchmarkEvent(event as never);
    recordBenchmarkEvent({ ...event, route: '/accounts/PRIVATE' } as never);
    const events = log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, json]) => JSON.parse(json));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/PRIVATE|token/);
  } finally {
    restore();
    log.mockRestore();
    clock.mockRestore();
  }
});

it('retains superseded and expired taps instead of replacing them with faster mount durations', () => {
  const restore = installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  try {
    beginScreenNavigation('/accounts');
    clock.mockReturnValue(120);
    beginScreenNavigation('/reports');
    clock.mockReturnValue(31_000);
    mountScreenTrace('reports').finish();
    const events = log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, json]) => JSON.parse(json));
    expect(
      events.map(({ route, phase, origin }) => [route, phase, origin])
    ).toEqual([
      ['accounts', 'start', 'tap'],
      ['accounts', 'aborted', 'tap'],
      ['reports', 'start', 'tap'],
      ['reports', 'aborted', 'tap'],
      ['reports', 'start', 'mount'],
      ['reports', 'aborted', 'mount']
    ]);
    expect(events[3].elapsedMs).toBe(30_880);
  } finally {
    restore();
    log.mockRestore();
    clock.mockRestore();
  }
});
