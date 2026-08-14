const { createMockAssistantService } = require('./assistant-service') as {
  createMockAssistantService(input?: Record<string, unknown>): any;
};

export {};

const now = Date.UTC(2026, 0, 15, 12);
const snapshot = {
  sources: [{ kind: 'budget', id: 'budget-1', version: 2 }],
  values: [{ key: 'assistant.context.budget.remaining', minor: 15000, currency: 'SAR', status: 'available' }],
  completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: [] },
  reportReference: 'report-1'
};

describe('AssistantService action previews', () => {
  it('creates a preview without owner mutation, preserves edits/cancel input, and confirms the owner once with replay', async () => {
    const owners = {
      createGoal: jest.fn(async () => ({ value: { id: 'goal-1', version: 1 }, affectedScopes: ['planning.goals', 'assistant.context'] }))
    };
    const service = serviceWith({ owners });
    await service.setConsent(true, 1, 'consent-enable');

    const conversation = await service.createConversation({ question: 'Make me a savings plan' }, 'create-plan');
    const response = (await service.getConversation(conversation.value.id)).responses.items[0];
    const previewId = response.proposedActionIds[0];

    expect(previewId).toBeTruthy();
    expect(owners.createGoal).not.toHaveBeenCalled();
    expect(await service.getActionPreview(previewId)).toMatchObject({
      kind: 'create_goal',
      input: { amountMinor: 15000, currency: 'SAR' },
      sourceVersions: [{ id: 'budget-1', version: 2 }],
      status: 'ready'
    });

    const edited = await service.updateActionPreview(previewId, { amountMinor: 20000, currency: 'SAR' }, 1);
    expect(edited.input).toEqual({ amountMinor: 20000, currency: 'SAR' });
    const cancelled = await service.cancelAction(previewId, edited.version, 'cancel-preview');
    expect(cancelled.value).toMatchObject({ status: 'cancelled', input: { amountMinor: 20000, currency: 'SAR' } });
    expect(owners.createGoal).not.toHaveBeenCalled();

    const nextConversation = await service.createConversation({ question: 'Make me another savings plan' }, 'create-plan-2');
    const nextResponse = (await service.getConversation(nextConversation.value.id)).responses.items[0];
    const nextPreview = await service.updateActionPreview(nextResponse.proposedActionIds[0], { amountMinor: 30000, currency: 'SAR' }, 1);
    const firstConfirm = await service.confirmAction(nextPreview.id, nextPreview.version, 'confirm-preview');
    const replayConfirm = await service.confirmAction(nextPreview.id, nextPreview.version, 'confirm-preview');

    expect(firstConfirm).toEqual(replayConfirm);
    expect(firstConfirm.value).toMatchObject({ status: 'succeeded', resultReference: 'goal-1' });
    expect(owners.createGoal).toHaveBeenCalledTimes(1);
    expect(owners.createGoal).toHaveBeenCalledWith(expect.objectContaining({ targetMinor: 30000, currencyCode: 'SAR' }), 'confirm-preview');
  });

  it('replays completed and stale operations before live gates, and navigation previews call no owner', async () => {
    const permissionProvider = jest.fn(async () => true);
    const owners = { createGoal: jest.fn(async () => ({ value: { id: 'goal-1', version: 1 }, affectedScopes: [] })) };
    const service = serviceWith({ owners, permissionProvider });
    await service.setConsent(true, 1, 'consent-enable');

    const conversation = await service.createConversation({ question: 'Make me a savings plan' }, 'create-replay');
    const response = (await service.getConversation(conversation.value.id)).responses.items[0];
    const success = await service.confirmAction(response.proposedActionIds[0], 1, 'confirm-replay');
    permissionProvider.mockResolvedValue(false);
    expect(await service.confirmAction(response.proposedActionIds[0], 1, 'confirm-replay')).toEqual(success);

    const staleService = serviceWith({
      permissionProvider,
      sourceVersionProvider: jest.fn(async () => [{ id: 'budget-1', version: 3 }])
    });
    await staleService.setConsent(true, 1, 'consent-stale-replay');
    const staleConversation = await staleService.createConversation({ question: 'Make me a savings plan' }, 'create-stale-replay');
    const staleResponse = (await staleService.getConversation(staleConversation.value.id)).responses.items[0];
    permissionProvider.mockResolvedValue(true);
    const stale = await staleService.confirmAction(staleResponse.proposedActionIds[0], 1, 'confirm-stale-replay');
    permissionProvider.mockResolvedValue(false);
    expect(await staleService.confirmAction(staleResponse.proposedActionIds[0], 1, 'confirm-stale-replay')).toEqual(stale);

    const navService = serviceWith({ owners });
    await navService.setConsent(true, 1, 'consent-nav');
    const navConversation = await navService.createConversation({ question: 'Open subscriptions' }, 'create-nav');
    const navResponse = (await navService.getConversation(navConversation.value.id)).responses.items[0];
    expect((await navService.confirmAction(navResponse.proposedActionIds[0], 1, 'confirm-nav')).value).toMatchObject({
      status: 'succeeded',
      resultReference: 'subscriptions'
    });
    expect(owners.createGoal).toHaveBeenCalledTimes(1);
  });

  it('refreshes stale source versions during explicit review before confirmation', async () => {
    const owners = {
      createGoal: jest.fn(async () => ({ value: { id: 'goal-reviewed', version: 1 }, affectedScopes: [] }))
    };
    const service = serviceWith({
      owners,
      sourceVersionProvider: jest.fn(async () => [{ id: 'budget-1', version: 3 }])
    });
    await service.setConsent(true, 1, 'consent-stale-review');
    const conversation = await service.createConversation({ question: 'Make me a savings plan' }, 'create-stale-review');
    const response = (await service.getConversation(conversation.value.id)).responses.items[0];
    const previewId = response.proposedActionIds[0];

    const stale = await service.confirmAction(previewId, 1, 'confirm-stale-review');
    expect(stale.value).toMatchObject({ status: 'stale' });

    const reviewed = await service.updateActionPreview(previewId, { amountMinor: 16000, currency: 'SAR' }, stale.value.version);
    expect(reviewed).toMatchObject({ status: 'ready', sourceVersions: [{ id: 'budget-1', version: 3 }] });

    await expect(service.confirmAction(previewId, reviewed.version, 'confirm-stale-reviewed')).resolves.toMatchObject({
      value: { status: 'succeeded', resultReference: 'goal-reviewed' }
    });
    expect(owners.createGoal).toHaveBeenCalledTimes(1);
  });

  it('revalidates source versions, permission, entitlement, and offline state before owner execution', async () => {
    const owners = {
      createGoal: jest.fn(async () => ({ value: { id: 'goal-1', version: 1 }, affectedScopes: [] }))
    };
    const service = serviceWith({
      owners,
      sourceVersionProvider: jest.fn(async () => [{ id: 'budget-1', version: 3 }]),
      permissionProvider: jest.fn(async () => true),
      entitlementProvider: jest.fn(async () => true)
    });
    await service.setConsent(true, 1, 'consent-enable');
    const conversation = await service.createConversation({ question: 'Make me a savings plan' }, 'create-stale');
    const response = (await service.getConversation(conversation.value.id)).responses.items[0];
    const stale = await service.confirmAction(response.proposedActionIds[0], 1, 'confirm-stale');
    expect(stale.value).toMatchObject({ status: 'stale', resultReference: null });
    expect(owners.createGoal).not.toHaveBeenCalled();

    await expect(serviceWith({ offline: true }).confirmAction('missing', 1, 'offline-confirm')).rejects.toMatchObject({ code: 'offline' });
    await expect(serviceWith({ permissionProvider: jest.fn(async () => false) }).confirmAction('missing', 1, 'permission-confirm')).rejects.toMatchObject({ code: 'permission_required' });
    await expect(serviceWith({ entitlementProvider: jest.fn(async () => false) }).confirmAction('missing', 1, 'entitlement_required')).rejects.toMatchObject({ code: 'limit_reached' });
  });

  it('keeps failed confirmations replayable after transient owner failure without losing preview input', async () => {
    const owners = {
      createGoal: jest.fn()
        .mockRejectedValueOnce(new Error('temporary owner failure'))
        .mockResolvedValueOnce({ value: { id: 'goal-retry', version: 1 }, affectedScopes: [] })
    };
    const service = serviceWith({ owners });
    await service.setConsent(true, 1, 'consent-enable');
    const conversation = await service.createConversation({ question: 'Make me a savings plan' }, 'create-retry');
    const response = (await service.getConversation(conversation.value.id)).responses.items[0];
    const previewId = response.proposedActionIds[0];

    await expect(service.confirmAction(previewId, 1, 'confirm-retry')).rejects.toMatchObject({ code: 'representative_failure' });
    const failed = await service.getActionPreview(previewId);
    expect(failed).toMatchObject({ status: 'failed', input: { amountMinor: 15000, currency: 'SAR' } });
    expect((await service.confirmAction(previewId, failed.version, 'confirm-before-review')).value).toMatchObject({ status: 'failed' });
    const reviewed = await service.updateActionPreview(previewId, { amountMinor: 15000, currency: 'SAR' }, failed.version);
    expect((await service.confirmAction(previewId, reviewed.version, 'confirm-retry-2')).value).toMatchObject({
      status: 'succeeded',
      resultReference: 'goal-retry'
    });
    expect(owners.createGoal).toHaveBeenCalledTimes(2);
  });
});

function serviceWith(overrides: Record<string, unknown> = {}) {
  return createMockAssistantService({
    now: () => now,
    contextProvider: jest.fn(async () => ({ dataAsOf: now, period: 'monthly:2026-01-01', snapshot })),
    sourceVersionProvider: jest.fn(async () => snapshot.sources.map(({ id, version }) => ({ id, version }))),
    permissionProvider: jest.fn(async () => true),
    entitlementProvider: jest.fn(async () => true),
    ...overrides
  });
}
