jest.mock('../../../src/platform/observability/platform-metrics', () => ({
  LEDGER_METRICS: {
    command: 'masarifi_ledger_command_total',
    commandDuration: 'masarifi_ledger_command_duration_ms',
    read: 'masarifi_ledger_read_total',
    readDuration: 'masarifi_ledger_read_duration_ms',
    readResultCount: 'masarifi_ledger_read_result_count',
    payloadBytes: 'masarifi_ledger_payload_bytes',
    idempotency: 'masarifi_ledger_idempotency_total',
    idempotencyReplay: 'masarifi_ledger_idempotency_replay_total',
    conflict: 'masarifi_ledger_conflict_total',
  },
  recordPlatformMetric: jest.fn(),
}));

import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { recordPlatformMetric } from '../../../src/platform/observability/platform-metrics';

const input = {
  operation: 'createTransaction',
  scope: 'ledger.transaction.create',
  principal: { userId: 'metrics-user', sessionId: 'session', factorAgeSeconds: 0 },
  command: { fixed: 'command' },
  idempotencyKey: 'metrics-key-1',
  requestId: 'metrics-request',
  status: 201,
};

function repositoryWithClaim(outcome: 'replay' | 'hash_mismatch'): LedgerRepository {
  const client = {
    query: jest.fn((sql: string) => {
      if (sql.startsWith('select * from private.claim_idempotency_key'))
        return Promise.resolve({
          rows: [
            {
              outcome,
              response_status: outcome === 'replay' ? 201 : null,
              response_body: outcome === 'replay' ? { replayed: true } : null,
              retry_after_seconds: null,
            },
          ],
        });
      return Promise.resolve({ rows: [] });
    }),
  };
  return new LedgerRepository({
    withClient: (action: (value: unknown) => unknown) => action(client),
  } as never);
}

function repositoryWithLookup(outcome: 'replay' | 'hash_mismatch'): LedgerRepository {
  const client = {
    query: jest.fn((sql: string) => {
      if (sql.startsWith('select * from private.lookup_idempotency_key'))
        return Promise.resolve({
          rows: [
            {
              outcome,
              response_status: outcome === 'replay' ? 201 : null,
              response_body: outcome === 'replay' ? { replayed: true } : null,
              retry_after_seconds: null,
            },
          ],
        });
      return Promise.resolve({ rows: [] });
    }),
  };
  return new LedgerRepository({
    withClient: (action: (value: unknown) => unknown) => action(client),
  } as never);
}

describe('ledger command metrics', () => {
  beforeEach(() => jest.mocked(recordPlatformMetric).mockClear());

  it('records a fixed-scope replay, command outcome, and duration without IDs or money', async () => {
    await expect(repositoryWithClaim('replay').mutate(input)).resolves.toEqual({ replayed: true });
    expect(recordPlatformMetric).toHaveBeenCalledWith(
      'masarifi_ledger_idempotency_replay_total',
      1,
      { scope: input.scope },
    );
    expect(recordPlatformMetric).toHaveBeenCalledWith('masarifi_ledger_command_total', 1, {
      operation: input.operation,
      outcome: 'replay',
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith(
      'masarifi_ledger_command_duration_ms',
      expect.any(Number),
      { operation: input.operation },
    );
  });

  it('records only the stable conflict reason for a reused key', async () => {
    await expect(repositoryWithClaim('hash_mismatch').mutate(input)).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith('masarifi_ledger_conflict_total', 1, {
      operation: input.operation,
      reason: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(JSON.stringify(jest.mocked(recordPlatformMetric).mock.calls)).not.toMatch(
      /metrics-user|metrics-request|metrics-key-1|fixed/i,
    );
  });

  it('records a completed preflight replay as the command outcome', async () => {
    await expect(repositoryWithLookup('replay').replayCompleted(input)).resolves.toEqual({
      replayed: true,
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith('masarifi_ledger_command_total', 1, {
      operation: input.operation,
      outcome: 'replay',
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith(
      'masarifi_ledger_command_duration_ms',
      expect.any(Number),
      { operation: input.operation },
    );
  });

  it('records bounded list outcome, duration, result count, and payload bytes', async () => {
    const client = {
      query: jest.fn((sql: string) =>
        Promise.resolve({ rows: sql.includes('from public.transactions t') ? [] : [] }),
      ),
    };
    const repository = new LedgerRepository({
      withClient: (action: (value: unknown) => unknown) => action(client),
    } as never);
    await expect(
      repository.listTransactions(input.principal, {}, input.requestId),
    ).resolves.toMatchObject({ items: [], ledgerVersion: 0 });
    expect(recordPlatformMetric).toHaveBeenCalledWith('masarifi_ledger_read_total', 1, {
      operation: 'list_transactions',
      outcome: 'success',
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith('masarifi_ledger_read_result_count', 0, {
      operation: 'list_transactions',
    });
    expect(recordPlatformMetric).toHaveBeenCalledWith(
      'masarifi_ledger_payload_bytes',
      expect.any(Number),
      { operation: 'list_transactions' },
    );
  });
});

describe('unavailable ledger diagnostics', () => {
  let lines: string[];
  beforeEach(() => {
    lines = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
  });

  it.each([
    ['42883', '42883'],
    ['secret-owner@example.test', 'UNKNOWN'],
    [undefined, 'UNKNOWN'],
  ])('logs only a validated SQLSTATE for lookup failure %s', async (code, expectedCode) => {
    const failure = Object.assign(new Error('private SQL and financial payload'), {
      code,
      detail: 'owner@example.test credential and transaction amount',
    });
    const repository = new LedgerRepository({
      withClient: () => Promise.reject(failure),
    } as never);
    await expect(repository.replayCompleted(input)).rejects.toMatchObject({
      response: { code: 'LEDGER_UNAVAILABLE' },
      status: 503,
    });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines.join(''))).toMatchObject({
      level: 'error',
      message: 'LEDGER_UNAVAILABLE',
      eventName: 'ledger.database.failure',
      context: input.operation,
      state: 'lookup',
      code: expectedCode,
    });
    expect(lines.join('')).not.toMatch(
      /owner@|credential|payload|metrics-user|metrics-key|private SQL/,
    );
  });

  it('identifies account creation and preserves its unavailable result', async () => {
    const repository = new LedgerRepository({
      withClient: () => Promise.reject(Object.assign(new Error('private data'), { code: 'XX000' })),
    } as never);
    await expect(
      repository.createAccount({ ...input, operation: 'createAccount' } as never, {} as never),
    ).rejects.toMatchObject({ response: { code: 'LEDGER_UNAVAILABLE' }, status: 503 });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines.join(''))).toMatchObject({
      message: 'LEDGER_UNAVAILABLE',
      eventName: 'ledger.database.failure',
      context: 'createAccountOpening',
      state: 'command',
      code: 'XX000',
    });
  });

  it('keeps permission failures denied without logging them as unavailable', async () => {
    const repository = new LedgerRepository({
      withClient: () =>
        Promise.reject(Object.assign(new Error('FINANCIAL_ACCESS_DENIED'), { code: '42501' })),
    } as never);
    await expect(repository.replayCompleted(input)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
      status: 403,
    });
    expect(lines).toEqual([]);
  });
});
