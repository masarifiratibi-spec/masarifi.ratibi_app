import { assertReadActive } from './read-context';
import { HttpError } from './http-client';

interface Flight {
  controller: AbortController;
  promise: Promise<unknown>;
  readers: number;
}

/** Coalesces pending reads only; resolved data remains owned by Query. */
export class SharedReadPool {
  private readonly flights = new Map<string, Flight>();

  clear(): void {
    for (const flight of this.flights.values()) flight.controller.abort();
    this.flights.clear();
  }

  read<T>(
    key: string,
    signal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    assertReadActive(signal);
    let flight = this.flights.get(key);
    if (!flight) {
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => {
        assertReadActive(controller.signal);
        return operation(controller.signal);
      });
      flight = { controller, promise, readers: 0 };
      this.flights.set(key, flight);
      const current = flight;
      const remove = () => {
        if (this.flights.get(key) === current) this.flights.delete(key);
      };
      void promise.then(remove, remove);
    }
    const current = flight;
    current.readers++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (action: () => void) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', abort);
        current.readers--;
        if (current.readers === 0 && this.flights.get(key) === current) {
          this.flights.delete(key);
          current.controller.abort();
        }
        action();
      };
      const abort = () =>
        finish(() => reject(new HttpError('provider_unavailable', 503)));
      signal?.addEventListener('abort', abort, { once: true });
      void current.promise.then(
        (value) => finish(() => resolve(value as T)),
        (error) => finish(() => reject(error))
      );
    });
  }
}
