import { NestFactory } from '@nestjs/core';
import { bootstrapReportsEmailWorker } from '../../../src/reports-email-worker';
import { ReportsWorker } from '../../../src/reports/reports.worker';
import { PlatformLogger } from '../../../src/platform/observability/platform-logger';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';

const cutoff = '2026-10-30T00:00:00.000Z';

function setup(run = jest.fn().mockResolvedValue(undefined)) {
  const worker = { runRequestedPdfEmailsOnce: run, stop: jest.fn().mockResolvedValue(undefined) };
  const config = { getRequired: () => 1000 };
  let destroy: (() => void) | undefined;
  const lifecycle = {
    registerCleanup: (cleanup: () => void) => {
      destroy = cleanup;
    },
  };
  const app = {
    useLogger: jest.fn(),
    get: (token: unknown) =>
      token === ReportsWorker ? worker : token === PlatformConfigService ? config : lifecycle,
    close: jest.fn().mockImplementation(() => {
      destroy?.();
      return Promise.resolve();
    }),
  };
  const create = jest
    .spyOn(NestFactory, 'createApplicationContext')
    .mockResolvedValue(app as never);
  let stop: (() => void) | undefined;
  jest.spyOn(process, 'once').mockImplementation((event, listener) => {
    if (event === 'SIGTERM') stop = listener as () => void;
    return process;
  });
  jest.spyOn(PlatformLogger.prototype, 'info').mockImplementation(() => undefined);
  return {
    app,
    worker,
    create,
    signal: () => {
      if (!stop) throw Error('SIGTERM handler missing');
      stop();
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('requires a fixed valid activation floor before creating an application context', async () => {
  const { create } = setup();
  await expect(bootstrapReportsEmailWorker('')).rejects.toThrow('REPORT_EMAIL_SCOPE_INVALID');
  expect(create).not.toHaveBeenCalled();
});

test('missing scoped RPC fails startup, closes the context and never schedules polling', async () => {
  const run = jest.fn().mockRejectedValue(Error('RPC absent'));
  const { app, worker } = setup(run);
  const timer = jest.spyOn(global, 'setInterval');
  await expect(bootstrapReportsEmailWorker(cutoff)).rejects.toThrow('RPC absent');
  expect(worker.stop).toHaveBeenCalledTimes(1);
  expect(app.close).toHaveBeenCalledTimes(1);
  expect(timer).not.toHaveBeenCalled();
});

test('SIGTERM during first polling drains it without starting another timer', async () => {
  let finish!: () => void;
  const first = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const { app, worker, signal } = setup(jest.fn().mockReturnValue(first));
  worker.stop.mockImplementation(async () => {
    await first;
  });
  const timer = jest.spyOn(global, 'setInterval');
  const bootstrap = bootstrapReportsEmailWorker(cutoff);
  await new Promise((resolve) => setImmediate(resolve));
  signal();
  finish();
  await bootstrap;
  expect(worker.runRequestedPdfEmailsOnce).toHaveBeenCalledTimes(1);
  expect(app.close).toHaveBeenCalledTimes(1);
  expect(timer).not.toHaveBeenCalled();
});

test('the dedicated context polls only new PDF email work and stops its owned timer', async () => {
  jest.useFakeTimers();
  const { app, worker, signal } = setup();
  await bootstrapReportsEmailWorker(cutoff);
  await jest.advanceTimersByTimeAsync(1000);
  expect(worker.runRequestedPdfEmailsOnce).toHaveBeenCalledTimes(2);
  expect(worker.runRequestedPdfEmailsOnce).toHaveBeenLastCalledWith(cutoff);
  signal();
  await jest.advanceTimersByTimeAsync(0);
  expect(worker.stop).toHaveBeenCalledTimes(1);
  expect(app.close).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('closing the application context also disposes the owned polling timer', async () => {
  jest.useFakeTimers();
  const { app } = setup();
  await bootstrapReportsEmailWorker(cutoff);
  expect(jest.getTimerCount()).toBe(1);
  await app.close();
  expect(jest.getTimerCount()).toBe(0);
});
