import { AiRepository } from './ai.repository';
import { AiStorage } from './ai.storage';
import { AiWorker } from './ai.worker';
import { PlatformLogger } from '../platform/observability/platform-logger';

// A separate lifecycle: never boot the general scheduler or AiWorker's broad loop.
export class StagingVoiceWorker {
  private timer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatPromise?: Promise<Record<string, unknown>>;
  private wasEnabled = false;
  private busy = false;
  private stopping = false;
  private readonly abort = new AbortController();
  constructor(
    private readonly repository: AiRepository,
    private readonly engine: AiWorker,
    private readonly storage: AiStorage,
    private readonly epoch: string,
    private readonly workerId: string,
    private readonly sourceSha: string,
    private readonly observe: (state: Record<string, unknown>) => void = () => undefined,
  ) {}

  start(): void {
    if (this.timer || this.stopping) return;
    this.timer = setInterval(() => void this.tick(), 500);
    this.heartbeatTimer = setInterval(() => {
      void this.pulse().catch(() => this.fail());
    }, 5000);
    void this.tick();
  }
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.timer = undefined;
    this.abort.abort();
    while (this.busy) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  async tick(): Promise<void> {
    if (this.busy || this.stopping) return;
    this.busy = true;
    try {
      const state = await this.pulse();
      if (!state.enabled) return;
      if (state.mode !== 'canary' && state.mode !== 'operating')
        throw new Error('VOICE_SCOPE_INVALID');
      const claims = await this.repository.claimVoiceEpochWork(this.epoch, this.workerId, 1, 120);
      for (const claim of claims) {
        if (this.isStopping()) return;
        const succeeded = await this.engine.processVoiceClaim(claim, this.abort.signal);
        if (!succeeded && state.mode === 'canary') {
          await this.repository.closeVoiceEpoch(this.epoch, 'extraction_failed');
          return;
        }
      }
      if (this.isStopping()) return;
      if (!(await this.repository.finalizeVoiceEpoch(this.epoch, 1, state.mode === 'canary')))
        return;
      // Bounded captures are retained as acceptance evidence; ordinary retention is scoped.
      if (state.mode === 'canary') return;
      const purges = await this.repository.claimVoiceEpochPurges(this.epoch, this.workerId, 1, 120);
      for (const claim of purges) {
        try {
          await this.storage.delete(claim.storage_ref);
          await this.repository.completePurge(claim.id, claim.purge_token, true);
        } catch {
          await this.repository.completePurge(claim.id, claim.purge_token, false);
        }
      }
    } catch {
      await this.fail();
    } finally {
      this.busy = false;
    }
  }
  private pulse(): Promise<Record<string, unknown>> {
    if (!this.heartbeatPromise) {
      this.heartbeatPromise = this.repository
        .voiceEpochHeartbeat(this.epoch, this.workerId, this.sourceSha)
        .then((state) => {
          if (this.wasEnabled && !state.enabled) this.abort.abort();
          this.wasEnabled = state.enabled === true;
          this.observe({
            ...state,
            sourceSha: this.sourceSha,
            epochId: this.epoch,
            observedAt: Date.now(),
          });
          return state;
        })
        .finally(() => {
          this.heartbeatPromise = undefined;
        });
    }
    return this.heartbeatPromise;
  }
  private isStopping(): boolean {
    return this.stopping;
  }
  private async fail(): Promise<void> {
    this.abort.abort();
    new PlatformLogger().error('VOICE_SCOPED_RUNTIME_FAILED', { context: 'StagingVoiceWorker' });
    try {
      await this.repository.closeVoiceEpoch(this.epoch, 'runtime_failed');
    } catch {
      new PlatformLogger().error('VOICE_SCOPED_CLOSURE_FAILED', { context: 'StagingVoiceWorker' });
    }
  }
}
