import { AssistantAgentWorker } from '../../../src/ai/assistant-agent.worker';
import type { AssistantAgentClaim } from '../../../src/ai/assistant-agent';
import type { AssistantDataQuery, AssistantDataResult } from '../../../src/ai/assistant-agent-data';
import { AiGateway, AiGatewayError, type EffectiveAiRoute } from '../../../src/ai/ai.gateway';

const owner = 'owner-a';
const claim: AssistantAgentClaim = {
  id: 'job-a',
  userId: owner,
  claimToken: 'claim-fence-a',
  attempt: 1,
  operationId: 'operation-a',
  content: 'What was my latest expense?',
  timezone: 'Asia/Riyadh',
  contextScope: ['recent_transactions'],
  context: {},
  history: [],
};
const route: EffectiveAiRoute = {
  workload: 'financial_assistant',
  primary: { modelId: 'model-a', provider: 'provider-a' },
  fallbacks: [],
  providerAllowlist: ['provider-a'],
  zdrRequired: true,
  maxPrice: { prompt: '1', completion: '1' },
  limits: { inputTokens: 32000, outputTokens: 4096, timeoutMs: 60000 },
  prompt: { template: 'configured-template', schemaVersion: 1 },
  safetyRules: [],
};
const snapshot: AssistantDataResult = {
  observedAt: '2026-10-16T09:00:00Z',
  ledgerVersion: 17,
  aliases: [],
  data: {
    period: { startDate: '2026-10-01', endDate: '2026-10-16' },
    latest: { amountMinor: '300', currency: 'SAR', kind: 'expense' },
  },
};
const receipt = {
  model: 'model-a',
  provider: 'provider-a',
  generationId: 'generation-a',
  usage: { inputTokens: 50, outputTokens: 20, cost: 0.001 },
  latencyMs: 15,
  fallbackUsed: false,
};

function fixture(overrides: Record<string, unknown> = {}) {
  const settings: Record<string, unknown> = {
    MASARIFI_ASSISTANT_AGENT_ENABLED: true,
    MASARIFI_AI_ASSISTANT_ONLY: true,
    SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
    OPENROUTER_API_KEY: 'unit-key-never-used',
    ...overrides,
  };
  const jobs = {
    claim: jest.fn((requestedOwner: string): Promise<AssistantAgentClaim | null> => {
      if (requestedOwner !== owner) throw new Error('OWNER_SCOPE_INVALID');
      return Promise.resolve(claim);
    }),
    finish: jest.fn(() => Promise.resolve(true)),
    fail: jest.fn(() => Promise.resolve(true)),
    receipt: jest.fn(() => Promise.resolve(true)),
    uncertainDispatch: jest.fn(() => Promise.resolve(true)),
    authorizeDispatch: jest.fn((dispatchClaim: AssistantAgentClaim) => {
      if (dispatchClaim.id !== claim.id || dispatchClaim.claimToken !== claim.claimToken)
        throw new Error('DISPATCH_FENCE_INVALID');
      return Promise.resolve();
    }),
  };
  const data = {
    read: jest.fn((jobId: string, claimToken: string, query: AssistantDataQuery) => {
      if (jobId !== claim.id || claimToken !== claim.claimToken)
        throw new Error('DATA_FENCE_INVALID');
      if (!['overview', 'transactions'].includes(query.tool)) throw new Error('UNEXPECTED_READ');
      return Promise.resolve(snapshot);
    }),
  };
  const routes = {
    getRoute: jest.fn((workload: string): Promise<EffectiveAiRoute | null> => {
      if (workload !== 'financial_assistant') throw new Error('WORKLOAD_INVALID');
      return Promise.resolve(route);
    }),
  };
  const worker = new AssistantAgentWorker(
    jobs as never,
    data as never,
    routes as never,
    { get: (key: string) => settings[key], getRequired: () => owner } as never,
  );
  return { worker, jobs, data, routes };
}

it.each([
  { MASARIFI_ASSISTANT_AGENT_ENABLED: false },
  { MASARIFI_AI_ASSISTANT_ONLY: false },
  { SUPABASE_URL: 'https://other-project.supabase.co' },
  { SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co.evil.test' },
])('rejects worker start outside the enabled isolated staging scope: %j', async (settings) => {
  const f = fixture(settings);
  const model = jest
    .spyOn(AiGateway.prototype, 'complete')
    .mockRejectedValue(new Error('UNEXPECTED_MODEL_DISPATCH'));
  try {
    expect(() => {
      f.worker.start();
    }).toThrow('ASSISTANT_SCOPE_INVALID');
  } finally {
    await f.worker.stop();
  }
  expect(f.jobs.claim).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
});

it('does not read owner data or dispatch a model when the queue is empty', async () => {
  const f = fixture();
  f.jobs.claim.mockResolvedValue(null);
  const model = jest
    .spyOn(AiGateway.prototype, 'complete')
    .mockRejectedValue(new Error('UNEXPECTED_MODEL_DISPATCH'));
  await f.worker.runOnce();
  expect(f.jobs.claim).toHaveBeenCalledWith(owner);
  expect(f.data.read).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  expect(f.jobs.finish).not.toHaveBeenCalled();
});

it('writes safe round and attempt diagnostics through the real gateway and logger', async () => {
  const f = fixture();
  f.jobs.claim.mockResolvedValue({
    ...claim,
    attempt: 2,
    content: 'PRIVATE QUESTION',
    history: [{ role: 'user', content: 'PRIVATE HISTORY' }],
  });
  f.data.read.mockResolvedValue({
    ...snapshot,
    data: { ...snapshot.data, title: 'PRIVATE LEDGER' },
  });
  f.routes.getRoute.mockResolvedValue({
    ...route,
    safetyRules: [
      {
        key: 'input',
        type: 'input_block',
        configuration: { denyControl: true, denyBidiControls: true, maxUtf8Bytes: 8192 },
      },
      {
        key: 'output',
        type: 'output_block',
        configuration: {
          forbiddenKeys: ['tool', 'tools', 'sql', 'url', 'callback', 'authorization', 'secret'],
        },
      },
      { key: 'actions', type: 'action_allowlist', configuration: {} },
      { key: 'evidence', type: 'evidence_limit', configuration: {} },
    ],
  });
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 'PRIVATE GENERATION',
        model: 'model-a',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                status: 'answer',
                answer: 'Verified movement.',
                queries: [],
                responseType: 'fact',
                scope: 'all_history',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  );
  const lines: string[] = [];
  jest.spyOn(process.stdout, 'write').mockImplementation((line) => {
    lines.push(String(line));
    return true;
  });
  await f.worker.runOnce();
  const records = lines
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((record) => record.message === 'ASSISTANT_AGENT_STAGE');
  expect(records).toEqual([
    expect.objectContaining({
      eventName: 'assistant.agent.overview_read',
      state: 'completed',
      round: 0,
      attempt: 2,
      readCount: 1,
      durationMs: expect.any(Number) as number,
    }),
    expect.objectContaining({
      eventName: 'assistant.agent.model',
      state: 'completed',
      round: 1,
      attempt: 2,
      readCount: 1,
      code: 'answer',
      durationMs: expect.any(Number) as number,
    }),
    expect.objectContaining({
      eventName: 'assistant.agent.grounding',
      state: 'completed',
      round: 1,
      attempt: 2,
      readCount: 1,
      durationMs: expect.any(Number) as number,
    }),
  ]);
  expect(JSON.stringify(records)).not.toMatch(
    /PRIVATE|owner-a|job-a|claim-fence|operation-a|provider-a|model-a/u,
  );
  for (const record of records) {
    expect(Object.keys(record).sort()).toEqual([
      'attempt',
      ...(record.eventName === 'assistant.agent.model' ? ['code'] : []),
      'durationMs',
      'eventName',
      'level',
      'message',
      'readCount',
      'round',
      'state',
      'timestamp',
    ]);
  }
  expect(f.jobs.finish).toHaveBeenCalledWith(
    expect.objectContaining({ id: claim.id }),
    expect.objectContaining({ content: 'Verified movement.' }),
  );
});

it('finishes only the configured owner claim using fenced reads and a grounded model answer', async () => {
  const f = fixture();
  let round = 0;
  jest.spyOn(AiGateway.prototype, 'complete').mockImplementation(async (input) => {
    await input.beforeDispatch?.(input.route.primary);
    await input.onReceipt?.(receipt);
    const payload = JSON.parse(String(input.userContent)) as {
      dataAlreadyRead: Array<{ data: { latest: { amountMinor: { value: string; ref: string } } } }>;
    };
    if (round++ === 0)
      return {
        ...receipt,
        value: input.parse({
          status: 'query',
          answer: '',
          responseType: 'fact',
          scope: 'all_history',
          queries: [
            {
              tool: 'transactions',
              kind: 'expense',
              startDate: null,
              endDate: null,
              currency: null,
              minAmountMinor: null,
              maxAmountMinor: null,
              account: null,
              category: null,
              search: null,
              sort: 'latest',
              limit: 1,
              offset: 0,
            },
          ],
        }),
      };
    const amount = payload.dataAlreadyRead.at(-1)?.data.latest.amountMinor;
    if (!amount) throw new Error('OWNER_FACT_MISSING');
    return {
      ...receipt,
      value: input.parse({
        status: 'answer',
        answer: `Latest expense: ${amount.ref}.`,
        responseType: 'fact',
        scope: 'all_history',
        queries: [],
      }),
    };
  });
  await f.worker.runOnce();
  expect(f.jobs.claim).toHaveBeenCalledWith(owner);
  expect(f.data.read.mock.calls).toEqual([
    ['job-a', 'claim-fence-a', { tool: 'overview' }],
    [
      'job-a',
      'claim-fence-a',
      expect.objectContaining({ tool: 'transactions', kind: 'expense', sort: 'latest', limit: 1 }),
    ],
  ]);
  expect(f.jobs.authorizeDispatch.mock.calls).toEqual([
    [claim, route],
    [claim, route],
  ]);
  expect(f.jobs.finish).toHaveBeenCalledWith(
    claim,
    expect.objectContaining({
      content: 'Latest expense: 3 SAR.',
      model: 'model-a',
      provider: 'provider-a',
      evidence: [
        expect.objectContaining({ version: 17 }),
        expect.objectContaining({ version: 17 }),
      ],
      metadata: expect.objectContaining({ scope: 'all_history' }) as unknown,
    }),
  );
  expect(f.jobs.fail).not.toHaveBeenCalled();
  expect(f.jobs.receipt).toHaveBeenCalledTimes(2);
});

it('rejects a claim for a different owner before reading data or invoking the model', async () => {
  const f = fixture();
  const otherClaim = { ...claim, userId: 'owner-b' };
  f.jobs.claim.mockResolvedValue(otherClaim);
  const model = jest
    .spyOn(AiGateway.prototype, 'complete')
    .mockRejectedValue(new Error('UNEXPECTED_MODEL_DISPATCH'));
  await f.worker.runOnce();
  expect(f.jobs.fail).toHaveBeenCalledWith(otherClaim, 'ASSISTANT_SCOPE_INVALID', false);
  expect(f.data.read).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  expect(f.jobs.finish).not.toHaveBeenCalled();
});

it('never finishes or dispatches when the fenced data read is rejected', async () => {
  const f = fixture();
  f.data.read.mockRejectedValue(new Error('ASSISTANT_DATA_FENCE_INVALID'));
  const model = jest
    .spyOn(AiGateway.prototype, 'complete')
    .mockRejectedValue(new Error('UNEXPECTED_MODEL_DISPATCH'));
  await f.worker.runOnce();
  expect(f.jobs.fail).toHaveBeenCalledWith(claim, 'ASSISTANT_DATA_FENCE_INVALID', false);
  expect(model).not.toHaveBeenCalled();
  expect(f.jobs.finish).not.toHaveBeenCalled();
});

it('records a retryable model failure without publishing an answer', async () => {
  const f = fixture();
  jest
    .spyOn(AiGateway.prototype, 'complete')
    .mockRejectedValue(new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true));
  await f.worker.runOnce();
  expect(f.jobs.fail).toHaveBeenCalledWith(claim, 'AI_TEMPORARILY_UNAVAILABLE', true);
  expect(f.jobs.finish).not.toHaveBeenCalled();
});

it('does not dispatch or finish after the claim loses dispatch authorization', async () => {
  const f = fixture();
  f.jobs.authorizeDispatch.mockRejectedValue(new Error('ASSISTANT_DISPATCH_FORBIDDEN'));
  const dispatched: string[] = [];
  jest.spyOn(AiGateway.prototype, 'complete').mockImplementation(async (input) => {
    await input.beforeDispatch?.(input.route.primary);
    dispatched.push('provider-request');
    return {
      ...receipt,
      value: input.parse({
        status: 'answer',
        answer: 'No verified data.',
        responseType: 'missing',
        scope: 'all_history',
        queries: [],
      }),
    };
  });
  await f.worker.runOnce();
  expect(dispatched).toEqual([]);
  expect(f.jobs.fail).toHaveBeenCalledWith(claim, 'ASSISTANT_DISPATCH_FORBIDDEN', false);
  expect(f.jobs.finish).not.toHaveBeenCalled();
});

it('aborts an in-flight model request during stop without publishing a late answer', async () => {
  const f = fixture();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | undefined;
  jest.spyOn(AiGateway.prototype, 'complete').mockImplementation(
    (input) =>
      new Promise((_resolve, reject) => {
        signal = input.signal;
        input.signal?.addEventListener(
          'abort',
          () => {
            reject(new AiGatewayError('AI_WORK_CANCELLED'));
          },
          { once: true },
        );
        started();
      }),
  );
  const running = f.worker.runOnce();
  await ready;
  await f.worker.stop();
  await running;
  expect(signal?.aborted).toBe(true);
  expect(f.jobs.fail).toHaveBeenCalledWith(claim, 'AI_WORK_CANCELLED', false);
  expect(f.jobs.finish).not.toHaveBeenCalled();
});
