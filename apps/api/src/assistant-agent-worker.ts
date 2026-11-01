import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PlatformConfigModule } from './platform/config/platform-config.module';
import { DatabaseModule } from './platform/database/database.module';
import { AssistantAgentData } from './ai/assistant-agent-data';
import { AssistantAgentRepository } from './ai/assistant-agent.repository';
import { AssistantAgentWorker } from './ai/assistant-agent.worker';
import { AiWorkerModule } from './ai/ai.module';
import { AiWorker } from './ai/ai.worker';
import { publishAiWorkerHealth, type AiWorkerHealthState } from './ai/ai-worker-health';
import { PlatformLogger } from './platform/observability/platform-logger';
import { workerErrorFields } from './platform/observability/worker-error';

@Module({
  imports: [PlatformConfigModule, DatabaseModule, AiWorkerModule],
  providers: [AssistantAgentData, AssistantAgentRepository, AssistantAgentWorker],
})
class AssistantAgentWorkerModule {}

export async function bootstrapAssistantAgentWorker() {
  const app = await NestFactory.createApplicationContext(AssistantAgentWorkerModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  app.useLogger(new PlatformLogger());
  const worker = app.get(AssistantAgentWorker);
  const actions = app.get(AiWorker);
  const states: Record<'agent' | 'actions', AiWorkerHealthState> = {
    agent: 'starting',
    actions: 'starting',
  };
  const observe = (name: keyof typeof states) => (state: AiWorkerHealthState) => {
    states[name] = state;
    const values = Object.values(states);
    const combined = values.includes('failed')
      ? 'failed'
      : values.includes('stopped')
        ? 'stopped'
        : values.every((value) => value === 'ready')
          ? 'ready'
          : 'starting';
    if (!publishAiWorkerHealth(combined))
      new PlatformLogger().error('AI_WORKER_HEALTH_UNAVAILABLE', { context: 'AssistantWorker' });
  };
  worker.observeHealth(observe('agent'));
  actions.observeHealth(observe('actions'));
  process.once('SIGTERM', () => {
    void Promise.all([worker.stop(), actions.stop()]).then(() => app.close());
  });
  worker.start();
  actions.start();
  return app;
}
if (require.main === module)
  void bootstrapAssistantAgentWorker().catch((error: unknown) => {
    new PlatformLogger().error('ASSISTANT_AGENT_BOOTSTRAP_FAILED', workerErrorFields(error));
    process.exitCode = 1;
  });
