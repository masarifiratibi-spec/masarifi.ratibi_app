import { retryDelayMs } from '../../../src/platform/outbox/retry-policy';

describe('retryDelayMs', () => {
  it('uses capped exponential backoff and injected jitter', () => {
    expect(retryDelayMs(1, 1, 300, 1_000, () => 0)).toBe(1_000);
    expect(retryDelayMs(10, 1, 300, 1_000, () => 0.999)).toBeLessThanOrEqual(300_999);
    expect(retryDelayMs(100, 1, 300, 0, () => 0.5)).toBe(300_000);
  });

  it('rejects invalid attempts and random values', () => {
    expect(() => retryDelayMs(0, 1, 300, 0, () => 0)).toThrow('OUTBOX_RETRY_INPUT_INVALID');
    expect(() => retryDelayMs(1, 1, 300, 1_000, () => 1)).toThrow('OUTBOX_RETRY_INPUT_INVALID');
  });
});
