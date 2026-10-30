import { SyncHandlers } from '../../../src/sync/sync.handlers';
import { normalizeRevision } from '../../../src/ledger/ledger.dto';
import type { SyncMutation } from '../../../src/sync/sync.types';

const principal = { userId: 'owner', sessionId: 'session' } as never;

describe('SyncHandlers', () => {
  it('maps only the exact legacy transaction update to the ordinary edit reason without changing raw identity', async () => {
    const payload = Object.freeze({
      title: 'Coffee',
      merchant: null,
      note: 'Legacy note',
      occurredAt: '2026-01-01T00:00:00.000Z',
      amountMinor: 2000,
    });
    const mutation: SyncMutation = Object.freeze({
      operationId: '63000000-0000-4000-8000-000000000002',
      domain: 'transactions',
      resourceType: 'transaction',
      schemaVersion: 1,
      dependsOn: [],
      operation: 'update',
      resourceId: '63000000-0000-4000-8000-000000000003',
      baseVersion: 1,
      payload,
    });
    const ledger = {
      reviseTransaction: jest.fn((input: { body: unknown }) =>
        Promise.resolve(normalizeRevision(input.body)),
      ),
    };
    const result = await new SyncHandlers({} as never, ledger as never).dispatch(
      principal,
      mutation,
      'original-request',
    );
    expect(result).toMatchObject({
      expectedVersion: 1,
      reason: 'Mobile edit',
      patch: { note: 'Legacy note' },
    });
    expect(ledger.reviseTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        principal,
        idempotencyKey: mutation.operationId,
        requestId: 'original-request',
        transactionId: mutation.resourceId,
      }),
    );
    expect(mutation.payload).toBe(payload);
    expect(payload).not.toHaveProperty('reason');
  });
  it.each([null, '', '  '])(
    'preserves present invalid reason %p for normal validation rather than replacing it',
    async (reason) => {
      const payload = {
        title: 'Coffee',
        merchant: null,
        note: 'Note',
        occurredAt: '2026-01-01T00:00:00.000Z',
        amountMinor: 2000,
        reason,
      };
      const ledger = {
        reviseTransaction: jest.fn((input: { body: unknown }) =>
          Promise.resolve(normalizeRevision(input.body)),
        ),
      };
      await expect(
        new SyncHandlers({} as never, ledger as never).dispatch(
          principal,
          {
            operationId: '63000000-0000-4000-8000-000000000002',
            domain: 'transactions',
            resourceType: 'transaction',
            schemaVersion: 1,
            dependsOn: [],
            operation: 'update',
            resourceId: '63000000-0000-4000-8000-000000000003',
            baseVersion: 1,
            payload,
          },
          'request',
        ),
      ).rejects.toThrow('VALIDATION_FAILED');
      expect(payload.reason).toBe(reason);
    },
  );
  it('does not supply a reason for unknown or incomplete legacy payload shapes', async () => {
    for (const payload of [
      { note: 'Note' },
      {
        title: 'Coffee',
        merchant: null,
        note: 'Note',
        occurredAt: '2026-01-01T00:00:00.000Z',
        amountMinor: 2000,
        unknown: 'extra',
      },
    ]) {
      const ledger = {
        reviseTransaction: jest.fn((input: { body: unknown }) =>
          Promise.resolve(normalizeRevision(input.body)),
        ),
      };
      await expect(
        new SyncHandlers({} as never, ledger as never).dispatch(
          principal,
          {
            operationId: '63000000-0000-4000-8000-000000000002',
            domain: 'transactions',
            resourceType: 'transaction',
            schemaVersion: 1,
            dependsOn: [],
            operation: 'update',
            resourceId: '63000000-0000-4000-8000-000000000003',
            baseVersion: 1,
            payload,
          },
          'request',
        ),
      ).rejects.toThrow('VALIDATION_FAILED');
    }
  });
  it('does not apply legacy mapping to another schema or resource type and preserves explicit reasons', async () => {
    const payload = {
      title: 'Coffee',
      merchant: null,
      note: 'Note',
      occurredAt: '2026-01-01T00:00:00.000Z',
      amountMinor: 2000,
    };
    const mutation = {
      operationId: '63000000-0000-4000-8000-000000000002',
      domain: 'transactions',
      resourceType: 'transaction',
      schemaVersion: 1,
      dependsOn: [],
      operation: 'update',
      resourceId: '63000000-0000-4000-8000-000000000003',
      baseVersion: 1,
      payload,
    };
    const ledger = {
      reviseTransaction: jest.fn((input: { body: unknown }) =>
        Promise.resolve(normalizeRevision(input.body)),
      ),
    };
    const handlers = new SyncHandlers({} as never, ledger as never);
    for (const patch of [{ schemaVersion: 2 }, { resourceType: 'account' }])
      await expect(
        handlers.dispatch(principal, { ...mutation, ...patch } as SyncMutation, 'request'),
      ).rejects.toThrow('VALIDATION_FAILED');
    await handlers.dispatch(
      principal,
      { ...mutation, payload: { ...payload, reason: 'Keep exact reason' } } as SyncMutation,
      'request',
    );
    expect(ledger.reviseTransaction.mock.calls.at(-1)?.[0].body).toMatchObject({
      reason: 'Keep exact reason',
    });
  });
  it('routes supported mutations through existing finance services', async () => {
    const reference = { execute: jest.fn().mockResolvedValue({ id: 'account' }) };
    let revisedInput: unknown;
    const ledger = {
      reviseTransaction: jest.fn((input: unknown) => {
        revisedInput = input;
        return Promise.resolve({ id: 'transaction' });
      }),
    };
    const handlers = new SyncHandlers(reference as never, ledger as never);
    await handlers.dispatch(
      principal,
      {
        operationId: '63000000-0000-4000-8000-000000000001',
        domain: 'accounts',
        resourceType: 'account',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'create',
        resourceId: null,
        baseVersion: null,
        payload: { name: 'Cash' },
      },
      'request',
    );
    await handlers.dispatch(
      principal,
      {
        operationId: '63000000-0000-4000-8000-000000000002',
        domain: 'transactions',
        resourceType: 'transaction',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'update',
        resourceId: '63000000-0000-4000-8000-000000000003',
        baseVersion: 2,
        payload: { reason: 'correct', title: 'Coffee' },
      },
      'request',
    );
    expect(reference.execute).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'createAccount' }),
    );
    expect(ledger.reviseTransaction).toHaveBeenCalledTimes(1);
    expect(revisedInput).toMatchObject({ body: { expectedVersion: 2 } });
  });

  it('rejects unsupported or incomplete mutations without a side effect', async () => {
    const reference = { execute: jest.fn() };
    const ledger = { reviseTransaction: jest.fn() };
    const handlers = new SyncHandlers(reference as never, ledger as never);
    await expect(
      handlers.dispatch(
        principal,
        {
          operationId: '63000000-0000-4000-8000-000000000001',
          domain: 'transactions',
          resourceType: 'transaction',
          schemaVersion: 1,
          dependsOn: [],
          operation: 'update',
          resourceId: null,
          baseVersion: null,
          payload: {},
        },
        'request',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(reference.execute).not.toHaveBeenCalled();
    expect(ledger.reviseTransaction).not.toHaveBeenCalled();
  });

  it('routes planning roots, dependents, and tombstones through the existing planning service', async () => {
    const reverseSavingsMovement = jest
      .fn<Promise<unknown>, [string, string, { body: Record<string, unknown> }]>()
      .mockResolvedValue({ id: 'movement' });
    const planning = {
      createSavingsGoal: jest.fn().mockResolvedValue({ id: 'goal' }),
      reverseSavingsMovement,
    };
    const handlers = new SyncHandlers({} as never, {} as never, planning as never);
    await handlers.dispatch(
      principal,
      {
        operationId: '63000000-0000-4000-8000-000000000011',
        domain: 'planning',
        resourceType: 'savings-goal',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'create',
        resourceId: null,
        baseVersion: null,
        payload: { name: 'Emergency', targetMinor: '100', currencyCode: 'SAR' },
      },
      'request',
    );
    await handlers.dispatch(
      principal,
      {
        operationId: '63000000-0000-4000-8000-000000000012',
        domain: 'planning',
        resourceType: 'savings-movement',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'delete',
        resourceId: '63000000-0000-4000-8000-000000000013',
        baseVersion: 2,
        payload: { goalId: '63000000-0000-4000-8000-000000000014' },
      },
      'request',
    );
    expect(planning.createSavingsGoal).toHaveBeenCalled();
    const call = reverseSavingsMovement.mock.calls[0];
    expect(call?.slice(0, 2)).toEqual([
      '63000000-0000-4000-8000-000000000014',
      '63000000-0000-4000-8000-000000000013',
    ]);
    expect(call?.[2].body).toMatchObject({ expectedVersion: 2 });
    expect(call?.[2].body).not.toHaveProperty('goalId');
  });
});
