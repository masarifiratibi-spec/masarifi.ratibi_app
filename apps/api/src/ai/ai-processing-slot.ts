import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PlatformLogger } from '../platform/observability/platform-logger';
import { AiGatewayError } from './ai.gateway';
import { aiTrafficMode } from './ai-traffic';
import type { AiRepository } from './ai.repository';

export async function withProcessingSlot<T>(
  store: Pick<AiRepository, 'startProcessing' | 'endProcessing'>,
  owner: string,
  signal: AbortSignal,
  run: () => Promise<T>,
): Promise<T> {
  const mode = aiTrafficMode();
  if (mode === 'off') return run();
  const token = randomUUID();
  const deadline = Date.now() + 5_000;
  let acquired = false;
  try {
    for (;;) {
      signal.throwIfAborted();
      try {
        acquired = await store.startProcessing(token, owner);
      } catch {
        new PlatformLogger().warn('AI_PROCESSING_STORE_UNAVAILABLE', { state: mode });
        if (mode === 'enforce') throw new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
        break;
      }
      if (acquired) break;
      if (mode === 'shadow' || Date.now() >= deadline) {
        new PlatformLogger().warn('AI_PROCESSING_LIMITED', { state: mode });
        if (mode === 'enforce') throw new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
        break;
      }
      await delay(250, undefined, { signal });
    }
    signal.throwIfAborted();
    return await run();
  } finally {
    if (acquired)
      await store.endProcessing(token).catch(() => {
        new PlatformLogger().warn('AI_PROCESSING_RELEASE_FAILED', { state: mode });
      });
  }
}
