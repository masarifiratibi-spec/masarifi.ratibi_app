import { SharedReadPool } from './shared-read';

it('keeps shared transport alive until the last reader cancels', async () => {
  const pool = new SharedReadPool();
  const first = new AbortController(),
    second = new AbortController();
  let signal!: AbortSignal;
  let release!: (value: number) => void;
  const operation = (active: AbortSignal) => {
    signal = active;
    return new Promise<number>((resolve) => {
      release = resolve;
    });
  };
  const a = pool
    .read('owner:accounts', first.signal, operation)
    .catch((error) => error);
  const b = pool.read('owner:accounts', second.signal, operation);
  await Promise.resolve();
  first.abort();
  expect(await a).toMatchObject({ code: 'provider_unavailable' });
  expect(signal.aborted).toBe(false);
  release(42);
  expect(await b).toBe(42);
});
