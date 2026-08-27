export interface ShutdownResult {
  timedOut: boolean;
}

export class GracefulShutdown {
  private active = 0;
  private stopping = false;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly timeoutMs: number) {
    if (timeoutMs < 1_000 || timeoutMs > 30_000) throw new Error('SHUTDOWN_TIMEOUT_INVALID');
  }

  beginWork(): (() => void) | null {
    if (this.stopping) return null;
    this.active += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.active -= 1;
      if (this.active === 0) {
        this.idleResolvers.splice(0).forEach((resolve) => {
          resolve();
        });
      }
    };
  }

  async shutdown(stopAccepting: () => void | Promise<void>): Promise<ShutdownResult> {
    this.stopping = true;
    let timer: NodeJS.Timeout | undefined;
    const stoppedAndDrained = Promise.resolve(stopAccepting()).then(
      () =>
        new Promise<ShutdownResult>((resolve) => {
          if (this.active === 0) {
            resolve({ timedOut: false });
            return;
          }
          this.idleResolvers.push(() => {
            resolve({ timedOut: false });
          });
        }),
    );
    const deadline = new Promise<ShutdownResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({ timedOut: true });
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([stoppedAndDrained, deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
