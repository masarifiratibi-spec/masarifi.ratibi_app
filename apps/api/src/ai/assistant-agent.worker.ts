import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { PlatformLogger } from '../platform/observability/platform-logger';
import { workerErrorFields } from '../platform/observability/worker-error';
import { AiGateway, AiGatewayError } from './ai.gateway';
import { AiRepository } from './ai.repository';
import { AssistantAgentData } from './assistant-agent-data';
import { AssistantAgentRepository } from './assistant-agent.repository';
import { AssistantAgent } from './assistant-agent';
import { publishAiWorkerHealth } from './ai-worker-health';

@Injectable()
export class AssistantAgentWorker implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private controller?: AbortController;
  private readonly logger = new PlatformLogger();

  constructor(
    private readonly jobs: AssistantAgentRepository,
    private readonly data: AssistantAgentData,
    private readonly routes: AiRepository,
    private readonly config: PlatformConfigService,
  ) {}

  start(): void {
    if (this.timer) return;
    if (
      (!this.config.get('MASARIFI_ASSISTANT_AGENT_ENABLED') &&
        !this.config.get('MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED')) ||
      !this.config.get('MASARIFI_AI_ASSISTANT_ONLY') ||
      this.config.get('SUPABASE_URL') !== 'https://qcffvfbpzvpwcwxwjyro.supabase.co'
    )
      throw Error('ASSISTANT_SCOPE_INVALID');
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 500);
    void this.runOnce();
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.controller = new AbortController();
    const deadline = setTimeout(() => this.controller?.abort(), 150000);
    try {
      const publicAgent = this.config.get('MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED');
      const owner = publicAgent
        ? null
        : this.config.getRequired('MASARIFI_ASSISTANT_AGENT_OWNER_ID');
      const claim = owner === null ? await this.jobs.claimNext() : await this.jobs.claim(owner);
      publishAiWorkerHealth('ready');
      if (!claim) return;
      const started = Date.now();
      try {
        if (owner !== null && claim.userId !== owner) throw Error('ASSISTANT_SCOPE_INVALID');
        const route = await this.routes.getRoute('financial_assistant');
        if (!route) throw new AiGatewayError('AI_UNAVAILABLE');
        const agent = new AssistantAgent(
          this.data,
          new AiGateway({ apiKey: this.config.get('OPENROUTER_API_KEY'), assistantRecovery: true }),
          async (receipt) => {
            await this.jobs.receipt(claim, receipt);
          },
          async () => {
            await this.jobs.uncertainDispatch(claim);
          },
          async () => {
            await this.jobs.authorizeDispatch(claim, route);
          },
          (diagnostic) => {
            this.logger.info('ASSISTANT_AGENT_STAGE', {
              eventName: `assistant.agent.${diagnostic.stage}`,
              state: diagnostic.state,
              attempt: claim.attempt,
              round: diagnostic.round,
              readCount: diagnostic.readCount,
              durationMs: diagnostic.durationMs,
              ...(diagnostic.decision ? { code: diagnostic.decision } : {}),
            });
          },
        );
        const answer = await agent.run(claim, route, this.controller.signal);
        this.controller.signal.throwIfAborted();
        await this.jobs.finish(claim, answer);
        this.logger.info('ASSISTANT_AGENT_FINISHED', {
          state: 'completed',
          durationMs: Date.now() - started,
        });
      } catch (error) {
        const code =
          error instanceof AiGatewayError
            ? error.code
            : error instanceof Error && /^[A-Z][A-Z_]{1,79}$/.test(error.message)
              ? error.message
              : 'AI_TEMPORARILY_UNAVAILABLE';
        const retry =
          error instanceof AiGatewayError ? error.retryable : code === 'AI_TEMPORARILY_UNAVAILABLE';
        await this.jobs.fail(claim, code, retry);
        this.logger.error('ASSISTANT_AGENT_FAILED', {
          code,
          durationMs: Date.now() - started,
          ...(error instanceof AiGatewayError ? error.diagnostic : {}),
          ...workerErrorFields(error),
        });
      }
    } catch (error) {
      publishAiWorkerHealth('failed');
      this.logger.error('ASSISTANT_AGENT_POLL_FAILED', workerErrorFields(error));
    } finally {
      clearTimeout(deadline);
      this.controller = undefined;
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.controller?.abort();
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 10));
    publishAiWorkerHealth('stopped');
  }
  async onModuleDestroy() {
    await this.stop();
  }
}
