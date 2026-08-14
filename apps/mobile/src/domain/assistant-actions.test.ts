import {
  cancelAssistantActionPreview,
  createAssistantActionPreview,
  failAssistantActionPreview,
  previewRequiresConfirmation,
  revalidateAssistantActionPreview,
  updateAssistantActionPreviewInput,
  type AssistantActionPreview
} from './assistant';

const now = Date.UTC(2026, 0, 15, 12);
const sourceVersions = [{ id: 'source-1', version: 2 }];

describe('assistant action preview domain helpers', () => {
  it('creates every supported proposal with exact destination, values, expiry, and source versions', () => {
    const cases = [
      ['create_budget', { amountMinor: 50_00, currency: 'SAR' }, { kind: 'budget', budgetId: 'draft-budget' }],
      ['adjust_budget', { amountMinor: 25_00, currency: 'SAR' }, { kind: 'budget', budgetId: 'budget-1' }],
      ['create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' }],
      ['add_reminder', { date: '2026-02-01' }, { kind: 'obligation', obligationId: 'obligation-1' }],
      ['open_transactions', {}, { kind: 'transactions' }],
      ['show_subscriptions', {}, { kind: 'subscriptions' }],
      ['link_transaction', { transactionId: 'transaction-1' }, { kind: 'obligation', obligationId: 'obligation-1' }],
      ['review_obligation', { obligationId: 'obligation-1' }, { kind: 'obligation', obligationId: 'obligation-1' }],
      ['create_plan', { amountMinor: 300_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-plan' }]
    ] as const;

    for (const [kind, input, affectedDestination] of cases) {
      const preview = createAssistantActionPreview({
        id: `preview-${kind}`,
        responseId: 'response-1',
        kind,
        input,
        affectedDestination,
        sourceVersions,
        now,
        expiresInMs: 10 * 60_000
      });

      expect(preview).toMatchObject({
        id: `preview-${kind}`,
        responseId: 'response-1',
        kind,
        input,
        affectedDestination,
        sourceVersions,
        status: 'ready',
        operationId: null,
        resultReference: null,
        safeFailure: null,
        version: 1
      });
      if (previewRequiresConfirmation(kind)) expect(preview.expiresAt).toBe(now + 10 * 60_000);
    }
  });

  it('edits only editable input and keeps destination/source disclosure current', () => {
    const preview = createPreview('create_budget', { amountMinor: 50_00, currency: 'SAR' }, { kind: 'budget', budgetId: 'draft-budget' });
    const edited = updateAssistantActionPreviewInput(preview, { amountMinor: 75_00, currency: 'SAR' });

    expect(edited).toMatchObject({
      input: { amountMinor: 75_00, currency: 'SAR' },
      affectedDestination: preview.affectedDestination,
      sourceVersions: preview.sourceVersions,
      status: 'ready',
      version: 2
    });
    expect(() => updateAssistantActionPreviewInput(createPreview('open_transactions', {}, { kind: 'transactions' }), {})).toThrow('not_editable');
  });

  it('marks stale and expired previews before execution', () => {
    const preview = createPreview('adjust_budget', { amountMinor: 25_00, currency: 'SAR' }, { kind: 'budget', budgetId: 'budget-1' });

    expect(revalidateAssistantActionPreview(preview, { now: now + 1, sourceVersions }).status).toBe('ready');
    expect(revalidateAssistantActionPreview(preview, { now: now + 1, sourceVersions: [{ id: 'source-1', version: 3 }] }).status).toBe('stale');
    expect(revalidateAssistantActionPreview(preview, { now: now + 11 * 60_000, sourceVersions }).status).toBe('expired');
  });

  it('cancels and records failed review without owner-side execution', () => {
    const preview = createPreview('create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' });

    expect(cancelAssistantActionPreview(preview)).toMatchObject({ status: 'cancelled', operationId: null, resultReference: null });
    expect(failAssistantActionPreview(preview, 'review_required')).toMatchObject({
      status: 'failed',
      safeFailure: 'review_required',
      operationId: null,
      resultReference: null
    });
  });

  it('rejects terminal preview rewrites', () => {
    const succeeded = { ...createPreview('create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' }), status: 'succeeded' as const, operationId: 'op-1', resultReference: 'goal-1', version: 2 };
    const cancelled = cancelAssistantActionPreview(createPreview('create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' }));
    const expired = revalidateAssistantActionPreview(createPreview('create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' }), { now: now + 11 * 60_000, sourceVersions });

    expect(() => cancelAssistantActionPreview(succeeded)).toThrow('invalid_transition');
    expect(() => failAssistantActionPreview(succeeded, 'review_required')).toThrow('invalid_transition');
    expect(() => revalidateAssistantActionPreview(cancelled, { now: now + 11 * 60_000, sourceVersions })).toThrow('invalid_transition');
    expect(() => revalidateAssistantActionPreview(expired, { now: now + 11 * 60_000, sourceVersions })).toThrow('invalid_transition');
  });

  it('requires explicit review before retrying failed or stale previews', () => {
    const failed = failAssistantActionPreview(createPreview('create_goal', { amountMinor: 100_00, currency: 'SAR' }, { kind: 'goal', goalId: 'draft-goal' }), 'review_required');
    const stale = revalidateAssistantActionPreview(createPreview('adjust_budget', { amountMinor: 25_00, currency: 'SAR' }, { kind: 'budget', budgetId: 'budget-1' }), {
      now,
      sourceVersions: [{ id: 'source-1', version: 3 }]
    });

    expect(updateAssistantActionPreviewInput(failed, { amountMinor: 110_00, currency: 'SAR' }, [{ id: 'source-1', version: 4 }])).toMatchObject({ status: 'ready', sourceVersions: [{ id: 'source-1', version: 4 }], version: failed.version + 1 });
    expect(updateAssistantActionPreviewInput(stale, { amountMinor: 35_00, currency: 'SAR' }, [{ id: 'source-1', version: 3 }])).toMatchObject({ status: 'ready', sourceVersions: [{ id: 'source-1', version: 3 }], version: stale.version + 1 });
  });

  it('prohibits direct-message execution for every data-changing proposal', () => {
    for (const kind of ['create_budget', 'adjust_budget', 'create_goal', 'add_reminder', 'link_transaction', 'create_plan'] as const) {
      expect(previewRequiresConfirmation(kind)).toBe(true);
    }
    for (const kind of ['open_transactions', 'show_subscriptions', 'review_obligation'] as const) {
      expect(previewRequiresConfirmation(kind)).toBe(false);
    }
  });
});

function createPreview(
  kind: Parameters<typeof createAssistantActionPreview>[0]['kind'],
  input: Parameters<typeof createAssistantActionPreview>[0]['input'],
  affectedDestination: Parameters<typeof createAssistantActionPreview>[0]['affectedDestination']
): AssistantActionPreview {
  return createAssistantActionPreview({
    id: `preview-${kind}`,
    responseId: 'response-1',
    kind,
    input,
    affectedDestination,
    sourceVersions,
    now,
    expiresInMs: 10 * 60_000
  });
}
