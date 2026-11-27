export class AiTrafficBusy extends Error {
  constructor(readonly retryAt: number) {
    super('traffic_busy');
  }
}

// One instance per adapter. The owner and endpoint keep unrelated work and cancellation available.
export class AiTrafficBackoff {
  private readonly deadlines = new Map<string, number>();

  async request(
    owner: string, method: string, path: string, signal: AbortSignal,
    checkOwner: () => Promise<void>, send: () => Promise<Response>
  ): Promise<Response> {
    const route = path.split('?')[0]!.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id');
    const key = JSON.stringify([owner, method, route]);
    const now = Date.now();
    for (const [entry, until] of this.deadlines) if (until <= now) this.deadlines.delete(entry);
    for (let attempt = 0; ; attempt++) {
      const until = this.deadlines.get(key) ?? 0;
      const wait = until - Date.now();
      if (wait > 2000) throw new AiTrafficBusy(until);
      if (wait > 0) {
        await pause(wait, signal);
        await checkOwner();
        const revised = this.deadlines.get(key) ?? 0;
        if (revised > Date.now()) throw new AiTrafficBusy(revised);
      }
      if (signal.aborted) throw new Error('operation_cancelled');
      const response = await send();
      if (response.status !== 429 || response.headers?.get('x-masarifi-ai-limit') !== 'traffic')
        return response;
      const seconds = Number(response.headers.get('Retry-After'));
      const retryAt = Date.now() + 1000 * (Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 1);
      this.deadlines.set(key, Math.max(this.deadlines.get(key) ?? 0, retryAt));
      if (attempt > 0) throw new AiTrafficBusy(retryAt);
    }
  }
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new Error('operation_cancelled'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort);
    if (signal.aborted) abort();
  });
}
