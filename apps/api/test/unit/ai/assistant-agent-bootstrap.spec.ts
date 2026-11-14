import { NestFactory } from '@nestjs/core';
import { bootstrapAssistantAgentWorker } from '../../../src/assistant-agent-worker';
import { AssistantAgentWorker } from '../../../src/ai/assistant-agent.worker';
import { AiWorker } from '../../../src/ai/ai.worker';
import * as health from '../../../src/ai/ai-worker-health';

afterEach(() => jest.restoreAllMocks());

function fixture() {
  let shutdown: (() => void) | undefined;
  const agent = {
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    observeHealth: jest.fn((observer: (state: health.AiWorkerHealthState) => void) => {
      void observer;
    }),
  };
  const actions = {
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    observeHealth: jest.fn((observer: (state: health.AiWorkerHealthState) => void) => {
      void observer;
    }),
  };
  const app = {
    useLogger: jest.fn(),
    get: jest.fn((token: unknown) => {
      if (token === AssistantAgentWorker) return agent;
      if (token === AiWorker) return actions;
      throw Error('Unexpected worker dependency');
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app as never);
  jest.spyOn(process, 'once').mockImplementation((event, listener) => {
    if (event !== 'SIGTERM') throw Error('Unexpected process listener');
    shutdown = listener as () => void;
    return process;
  });
  return { agent, actions, app, shutdown: () => shutdown?.() };
}

it('starts the existing action processor alongside the read agent after the agent scope guard passes', async () => {
  const { agent, actions } = fixture();
  await bootstrapAssistantAgentWorker();
  expect(agent.start).toHaveBeenCalledTimes(1);
  expect(actions.start).toHaveBeenCalledTimes(1);
  expect(agent.start.mock.invocationCallOrder[0]).toBeLessThan(
    actions.start.mock.invocationCallOrder[0] ?? 0,
  );
});

it('keeps the shared worker unhealthy when the action loop fails while the read agent stays ready', async () => {
  const publish = jest.spyOn(health, 'publishAiWorkerHealth').mockReturnValue(true);
  const { agent, actions } = fixture();
  await bootstrapAssistantAgentWorker();
  expect(actions.observeHealth).toHaveBeenCalledTimes(1);
  expect(agent.observeHealth).toHaveBeenCalledTimes(1);
  const onActions = actions.observeHealth.mock.calls[0]?.[0];
  const onAgent = agent.observeHealth.mock.calls[0]?.[0];
  if (!onActions || !onAgent) throw Error('Both worker health observers are required');
  onActions('ready');
  onAgent('ready');
  expect(publish).toHaveBeenLastCalledWith('ready');
  onActions('failed');
  onAgent('ready');
  expect(publish).toHaveBeenLastCalledWith('failed');
  onActions('ready');
  expect(publish).toHaveBeenLastCalledWith('ready');
  onAgent('stopped');
  onActions('ready');
  expect(publish).toHaveBeenLastCalledWith('stopped');
});

it('stops both processors before closing their shared context', async () => {
  const { agent, actions, app, shutdown } = fixture();
  let finishActions: (() => void) | undefined;
  actions.stop.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishActions = resolve;
      }),
  );
  await bootstrapAssistantAgentWorker();
  shutdown();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(agent.stop).toHaveBeenCalledTimes(1);
  expect(actions.stop).toHaveBeenCalledTimes(1);
  expect(app.close).not.toHaveBeenCalled();
  finishActions?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(app.close).toHaveBeenCalledTimes(1);
});

it('does not start action processing when the existing assistant scope guard rejects startup', async () => {
  const { agent, actions } = fixture();
  agent.start.mockImplementation(() => {
    throw Error('ASSISTANT_SCOPE_INVALID');
  });
  await expect(bootstrapAssistantAgentWorker()).rejects.toThrow('ASSISTANT_SCOPE_INVALID');
  expect(actions.start).not.toHaveBeenCalled();
});
