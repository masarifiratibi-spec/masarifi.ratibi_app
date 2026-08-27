export function retryDelayMs(
  attempt: number,
  baseSeconds: number,
  maxSeconds: number,
  jitterMs: number,
  random: () => number = Math.random,
): number {
  const randomValue = random();
  if (
    !Number.isSafeInteger(attempt) ||
    attempt < 1 ||
    !Number.isSafeInteger(baseSeconds) ||
    baseSeconds < 1 ||
    !Number.isSafeInteger(maxSeconds) ||
    maxSeconds < baseSeconds ||
    !Number.isSafeInteger(jitterMs) ||
    jitterMs < 0 ||
    randomValue < 0 ||
    randomValue >= 1
  ) {
    throw new Error('OUTBOX_RETRY_INPUT_INVALID');
  }
  const exponentialSeconds = baseSeconds * 2 ** Math.min(attempt - 1, 30);
  return Math.min(maxSeconds, exponentialSeconds) * 1_000 + Math.floor(randomValue * jitterMs);
}
