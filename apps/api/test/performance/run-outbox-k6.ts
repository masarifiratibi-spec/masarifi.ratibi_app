import { spawn } from 'node:child_process';

type TerminationSignal = 'SIGINT' | 'SIGTERM';
type ChildTerminator = { kill: (signal: TerminationSignal) => boolean };
type SignalProcess = {
  once: (signal: TerminationSignal, listener: () => void) => unknown;
  removeListener: (signal: TerminationSignal, listener: () => void) => unknown;
};

export function buildOutboxK6Arguments(stress: boolean): string[] {
  return stress
    ? [
        'run',
        '--summary-trend-stats=avg,min,med,max,p(90),p(95),p(99)',
        '--env',
        'MASARIFI_STRESS=1',
        '--summary-export=test/performance/artifacts/outbox-stress-summary.json',
        'test/performance/outbox-dispatch.k6.js',
      ]
    : [
        'run',
        '--summary-trend-stats=avg,min,med,max,p(90),p(95),p(99)',
        '--summary-export=test/performance/artifacts/outbox-summary.json',
        'test/performance/outbox-dispatch.k6.js',
      ];
}

export function buildOutboxK6Environment(
  databaseUrl: string,
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    !url.searchParams.has('sslmode')
  ) {
    url.searchParams.set('sslmode', 'disable');
  }
  return { ...environment, DATABASE_URL: url.toString() };
}

export function forwardTerminationSignals(
  child: ChildTerminator,
  signalProcess: SignalProcess,
): () => void {
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = (): void => {
      child.kill(signal);
    };
    signalProcess.once(signal, handler);
    return [signal, handler] as const;
  });
  return () => {
    for (const [signal, handler] of handlers) signalProcess.removeListener(signal, handler);
  };
}

function executeK6(arguments_: string[], environment: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('k6', arguments_, {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    const removeSignalHandlers = forwardTerminationSignals(child, process);
    child.once('error', () => {
      removeSignalHandlers();
      rejectRun(new Error('K6_NOT_AVAILABLE'));
    });
    child.once('exit', (code) => {
      removeSignalHandlers();
      resolveRun(code ?? 1);
    });
  });
}

async function run(): Promise<void> {
  const databaseUrl = process.env.K6_DATABASE_URL;
  if (!databaseUrl) throw new Error('K6_DATABASE_URL_REQUIRED');

  const stress = process.argv.includes('--stress') || process.env.MASARIFI_STRESS === '1';
  const exitCode = await executeK6(
    buildOutboxK6Arguments(stress),
    buildOutboxK6Environment(databaseUrl, process.env),
  );
  if (exitCode !== 0) throw new Error('OUTBOX_PERFORMANCE_FAILED');
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'OUTBOX_PERFORMANCE_FAILED'}\n`,
    );
    process.exitCode = 1;
  });
}
