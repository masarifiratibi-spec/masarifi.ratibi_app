import { HttpError } from './http-client';

import type { ReadContext } from '../contracts/read-context';
export type { ReadContext } from '../contracts/read-context';

export function assertReadActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new HttpError('provider_unavailable', 503);
}

/** One deadline covers identity acquisition, transport and decoding. */
export async function withReadContext<T>(
  context: ReadContext | undefined,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  assertReadActive(context?.signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, context?.timeoutMs ?? 15_000);
  let rejectAborted!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () =>
      reject(
        new HttpError(
          'provider_unavailable',
          503,
          undefined,
          undefined,
          timedOut ? 'timeout' : undefined
        )
      );
    controller.signal.addEventListener('abort', rejectAborted, { once: true });
  });
  context?.signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (context?.signal?.aborted) cancel();
    assertReadActive(controller.signal);
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timeout);
    context?.signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectAborted);
  }
}
