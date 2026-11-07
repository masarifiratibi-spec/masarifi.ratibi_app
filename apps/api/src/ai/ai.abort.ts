/** Bounds awaited I/O even when a test stream or transport ignores cancellation. */
export async function withAiAbort<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        abort = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}
