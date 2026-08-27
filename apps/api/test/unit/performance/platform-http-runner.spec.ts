import {
  buildPlatformK6Arguments,
  buildRuntimeEvidence,
} from '../../performance/run-platform-http';

describe('platform HTTP performance runner', () => {
  it('retains P99 latency in the exported k6 artifact', () => {
    expect(buildPlatformK6Arguments()).toEqual([
      'run',
      '--summary-trend-stats=avg,min,med,max,p(90),p(95),p(99)',
      '--summary-export=test/performance/artifacts/platform-http-summary.json',
      'test/performance/platform-http.k6.js',
    ]);
  });

  it('converts runtime measurements into bounded millisecond evidence', () => {
    expect(
      buildRuntimeEvidence({
        coldStartMs: 12.3456,
        durationMs: 60_000.4,
        cpuUserMicros: 2_500,
        cpuSystemMicros: 1_250,
        rssSamples: [100, 150, 125],
        eventLoopDelayP95Nanoseconds: 2_750_000,
      }),
    ).toEqual({
      coldStartMs: 12.346,
      durationMs: 60_000.4,
      cpuUserMs: 2.5,
      cpuSystemMs: 1.25,
      rssStartBytes: 100,
      rssPeakBytes: 150,
      rssEndBytes: 125,
      eventLoopDelayP95Ms: 2.75,
    });
  });
});
