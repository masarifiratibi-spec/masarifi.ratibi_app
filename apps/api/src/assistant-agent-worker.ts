import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PlatformConfigModule } from './platform/config/platform-config.module';
import { DatabaseModule } from './platform/database/database.module';
import { AssistantAgentData } from './ai/assistant-agent-data';
import { AssistantAgentRepository } from './ai/assistant-agent.repository';
import { AssistantAgentWorker } from './ai/assistant-agent.worker';
import { AiRepository } from './ai/ai.repository';
import { PlatformLogger } from './platform/observability/platform-logger';
import { workerErrorFields } from './platform/observability/worker-error';

@Module({
  imports: [PlatformConfigModule, DatabaseModule],
  providers: [AssistantAgentData, AssistantAgentRepository, AssistantAgentWorker, AiRepository],
})
class AssistantAgentWorkerModule {}

export async function bootstrapAssistantAgentWorker() {
  const app = await NestFactory.createApplicationContext(AssistantAgentWorkerModule, {
    abortOnError: false,
    bufferLogs: true,
  });
  app.useLogger(new PlatformLogger());
  const worker = app.get(AssistantAgentWorker);
  process.once('SIGTERM', () => {
    void worker.stop().then(() => app.close());
  });
  worker.start();
  return app;
}
if (require.main === module)
  void bootstrapAssistantAgentWorker().catch((error: unknown) => {
    new PlatformLogger().error('ASSISTANT_AGENT_BOOTSTRAP_FAILED', workerErrorFields(error));
    process.exitCode = 1;
  });
