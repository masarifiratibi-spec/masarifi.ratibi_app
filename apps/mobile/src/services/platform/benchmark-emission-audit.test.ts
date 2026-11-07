import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

type Observer = typeof import('./benchmark-observability');
let observer: Observer;
let restoreEnvironment: () => void;
let output: unknown[][];

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({ doNotFake: ['performance'] });
  observer = jest.requireActual<Observer>('./benchmark-observability');
  restoreEnvironment = installBenchmarkEnvironment();
  output = [];
  jest.spyOn(console, 'info').mockImplementation((...record) => {
    output.push(record);
  });
});
afterEach(() => {
  restoreEnvironment();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const response = () => new Response('{}', { status: 200 });
const audit = () => observer.readBenchmarkEmissionAudit()!;
const delivered = (prefix: string) =>
  output
    .filter(([tag]) => tag === prefix)
    .map(([, body]) => JSON.parse(body as string));

it('distinguishes an accepted sink-returned record from a silently lost collector record', async () => {
  jest.mocked(console.info).mockImplementation((...record) => {
    if (
      record[0] === 'BENCHMARK_METRIC' &&
      JSON.parse(record[1]).requestSequence === 1
    )
      return;
    output.push(record);
  });
  const original = response();
  expect(
    await observer.benchmarkFetch(async () => original, '/api/v1/accounts', {})
  ).toBe(original);
  await observer.benchmarkFetch(async () => response(), '/api/v1/accounts', {});
  expect(
    delivered('BENCHMARK_METRIC').map((event) => event.requestSequence)
  ).toEqual([2]);
  expect(audit().transports).toEqual([
    {
      requestSequence: 1,
      terminal: 'response',
      validation: 'accepted',
      sink: 'returned'
    },
    {
      requestSequence: 2,
      terminal: 'response',
      validation: 'accepted',
      sink: 'returned'
    }
  ]);
  observer.recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
  await jest.advanceTimersByTimeAsync(2000);
  expect(delivered('BENCHMARK_AUDIT')).toHaveLength(1);
  expect(delivered('BENCHMARK_AUDIT')[0]).toMatchObject({
    kind: 'emission_audit',
    requestHighWater: 2,
    emissionSequence: 4
  });
  expect(
    delivered('BENCHMARK_METRIC').map((event) => event.emissionSequence)
  ).toEqual([2, 3]);
  await jest.advanceTimersByTimeAsync(2000);
  expect(delivered('BENCHMARK_AUDIT')).toHaveLength(1);
});

it('retains a sink exception without changing the transport response', async () => {
  jest.mocked(console.info).mockImplementationOnce(() => {
    throw new Error('PRIVATE_TOKEN https://private.invalid');
  });
  const original = response();
  expect(
    await observer.benchmarkFetch(
      async () => original,
      '/api/v1/accounts/PRIVATE_OWNER',
      {}
    )
  ).toBe(original);
  expect(audit().transports[0]).toMatchObject({
    terminal: 'response',
    validation: 'accepted',
    sink: 'threw'
  });
  expect(JSON.stringify(audit())).not.toMatch(/PRIVATE|https/);
});

it.each(['metadata', 'clock'] as const)(
  'retains a fixed %s rejection without rejected input',
  async (reason) => {
    const original =
      reason === 'metadata'
        ? ({
            status: Number.NaN,
            headers: new Headers(),
            secret: 'PRIVATE'
          } as unknown as Response)
        : response();
    if (reason === 'clock')
      jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(12)
        .mockReturnValueOnce(Number.NaN)
        .mockReturnValue(20);
    expect(
      await observer.benchmarkFetch(
        async () => original,
        '/api/v1/accounts/PRIVATE',
        {}
      )
    ).toBe(original);
    expect(audit().rejections[reason]).toBe(1);
    expect(audit().transports[0]).toMatchObject({
      terminal: 'response',
      validation: reason,
      sink: 'pending'
    });
    expect(JSON.stringify(audit())).not.toMatch(/PRIVATE|NaN|secret/);
  }
);

it('separates an unresolved request from cancellation reaching its terminal callback', async () => {
  const controller = new AbortController();
  let rejectRequest!: (error: Error) => void;
  const network = new Promise<Response>((_resolve, reject) => {
    rejectRequest = reject;
  });
  const pending = observer.benchmarkFetch(() => network, '/api/v1/accounts', {
    signal: controller.signal
  });
  expect(audit().transports[0]).toMatchObject({
    terminal: 'pending',
    validation: 'pending',
    sink: 'pending'
  });
  controller.abort();
  rejectRequest(new Error('PRIVATE_CANCELLED'));
  await expect(pending).rejects.toThrow('PRIVATE_CANCELLED');
  expect(audit().transports[0]).toMatchObject({
    terminal: 'aborted',
    validation: 'accepted',
    sink: 'returned'
  });
});

it('records a transient runtime-guard failure after Benchmark admission', async () => {
  await observer.benchmarkFetch(async () => response(), '/api/v1/accounts', {});
  const expo = jest.requireMock<typeof import('expo')>('expo');
  jest.mocked(expo.requireOptionalNativeModule).mockImplementationOnce(() => {
    throw new Error('PRIVATE_RUNTIME');
  });
  expect(() =>
    observer.recordBenchmarkEvent({
      kind: 'timing',
      stage: 'http.auth',
      elapsedMs: 1
    })
  ).not.toThrow();
  expect(audit().rejections.runtime).toBe(1);
  expect(JSON.stringify(audit())).not.toContain('PRIVATE');
});

it('bounds audit entries and returns detached snapshots', async () => {
  await observer.benchmarkFetch(async () => response(), '/api/v1/accounts', {});
  const previous = audit();
  previous.transports[0]!.sink = 'threw';
  previous.rejections.metadata = 99;
  expect(audit().transports[0]!.sink).toBe('returned');
  expect(audit().rejections.metadata).toBe(0);
  for (let index = 1; index < 17; index++)
    await observer.benchmarkFetch(
      async () => response(),
      '/api/v1/accounts',
      {}
    );
  expect(audit()).toMatchObject({ requestHighWater: 17, overflowCount: 1 });
  expect(audit().transports).toHaveLength(16);
  observer.emitBenchmarkEmissionAudit();
  expect(JSON.stringify(delivered('BENCHMARK_AUDIT')[0]).length).toBeLessThan(
    3500
  );
});

it('counts budget rejection and never emits a 401st record', async () => {
  for (let index = 0; index < 400; index++)
    observer.recordBenchmarkEvent({
      kind: 'timing',
      stage: 'http.auth',
      elapsedMs: 1
    });
  await observer.benchmarkFetch(async () => response(), '/api/v1/accounts', {});
  expect(audit().rejections.budget).toBe(1);
  expect(audit().transports[0]!.validation).toBe('budget');
  observer.emitBenchmarkEmissionAudit();
  expect(output).toHaveLength(400);
});

it('keeps audit retrieval and scheduled output silent outside Benchmark', async () => {
  restoreEnvironment();
  const original = response();
  expect(
    await observer.benchmarkFetch(
      async () => original,
      '/api/v1/accounts/PRIVATE',
      {}
    )
  ).toBe(original);
  observer.recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
  observer.emitBenchmarkEmissionAudit();
  await jest.advanceTimersByTimeAsync(2000);
  expect(observer.readBenchmarkEmissionAudit()).toBeUndefined();
  expect(output).toEqual([]);
});
