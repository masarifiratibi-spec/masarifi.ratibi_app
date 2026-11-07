export async function isMissingStorageObject(
  response: Response,
  signal: AbortSignal,
): Promise<boolean> {
  if (response.status === 404) return true;
  if (response.status !== 400 || !response.body) return false;

  // Hosted Storage can return legacy HTTP400 for a missing object, identified only by NoSuchKey.
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 4096) {
        cancel();
        return false;
      }
      chunks.push(next.value);
    }
    if (signal.aborted) return false;
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return false;
    }
    return (
      payload !== null &&
      typeof payload === 'object' &&
      'code' in payload &&
      payload.code === 'NoSuchKey' &&
      (!('statusCode' in payload) || payload.statusCode === 404 || payload.statusCode === '404')
    );
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
