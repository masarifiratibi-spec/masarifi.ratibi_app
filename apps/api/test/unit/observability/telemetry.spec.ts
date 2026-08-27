import { startTelemetry } from '../../../src/platform/observability/telemetry';

describe('startTelemetry', () => {
  it('stays disabled without an endpoint', async () => {
    const factory = jest.fn();
    const telemetry = await startTelemetry({}, factory);

    expect(telemetry.enabled).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  it('starts and stops an injected SDK with bounded resource attributes', async () => {
    const sdk = {
      start: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    const factory = jest.fn().mockReturnValue(sdk);
    const telemetry = await startTelemetry(
      {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.test',
        NODE_ENV: 'test',
        MASARIFI_RELEASE_VERSION: 'v1',
        MASARIFI_PROCESS_KIND: 'api',
      },
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'https://otel.example.test',
      expect.objectContaining({
        'service.name': 'masarifi-api',
        'service.version': 'v1',
        'deployment.environment.name': 'test',
      }),
    );
    expect(sdk.start).toHaveBeenCalledTimes(1);
    await telemetry.shutdown();
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });

  it('fails open when the optional exporter cannot start', async () => {
    const telemetry = await startTelemetry(
      { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.test' },
      () => ({
        start: () => Promise.reject(new Error('collector secret')),
        shutdown: jest.fn(),
      }),
    );

    expect(telemetry.enabled).toBe(false);
  });
});
