import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

interface TelemetrySdk {
  start(): void | Promise<void>;
  shutdown(): void | Promise<void>;
}

type TelemetryFactory = (endpoint: string, attributes: Record<string, string>) => TelemetrySdk;

export interface TelemetryHandle {
  enabled: boolean;
  shutdown(): Promise<void>;
}

function defaultFactory(endpoint: string, attributes: Record<string, string>): TelemetrySdk {
  return new NodeSDK({
    serviceName: attributes['service.name'],
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
    }),
  });
}

export async function startTelemetry(
  environment: Record<string, string | undefined>,
  factory: TelemetryFactory = defaultFactory,
): Promise<TelemetryHandle> {
  const endpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return { enabled: false, shutdown: () => Promise.resolve() };

  try {
    const sdk = factory(endpoint, {
      'service.name': `masarifi-${environment.MASARIFI_PROCESS_KIND ?? 'process'}`,
      'service.version': environment.MASARIFI_RELEASE_VERSION ?? 'unknown',
      'deployment.environment.name': environment.NODE_ENV ?? 'unknown',
    });
    await sdk.start();
    return {
      enabled: true,
      shutdown: async () => {
        await sdk.shutdown();
      },
    };
  } catch {
    return { enabled: false, shutdown: () => Promise.resolve() };
  }
}
