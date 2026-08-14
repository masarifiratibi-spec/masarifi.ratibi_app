const { createMockAssistantService } = require('./assistant-service') as {
  createMockAssistantService(input?: Record<string, unknown>): any;
};

const now = Date.UTC(2026, 0, 15, 12);

describe('AssistantService', () => {
  it('requires consent before personalized answers and replays create/ask operations', async () => {
    const contextProvider = jest.fn().mockResolvedValue(context());
    const service = createMockAssistantService({ now: () => now, contextProvider });

    expect(await service.getAvailability()).toEqual({ status: 'available', remainingQuestions: 100 });
    await expect(service.createConversation({ question: 'What changed?' }, 'create-denied')).rejects.toMatchObject({ code: 'consent_required' });
    await service.setConsent(true, 1, 'consent-enable');

    const first = await service.createConversation({ question: 'What changed?' }, 'create-1');
    const replay = await service.createConversation({ question: 'Changed text should not matter' }, 'create-1');
    expect(replay).toEqual(first);

    const answer = await service.ask(first.value.id, 'What did I spend?', 'ask-1');
    expect(await service.ask(first.value.id, 'What did I spend again?', 'ask-1')).toEqual(answer);
    expect(await service.getAvailability()).toEqual({ status: 'available', remainingQuestions: 98 });
    expect(contextProvider).toHaveBeenCalledTimes(2);
  });

  it('covers deterministic response types without inventing values outside the safe snapshot', async () => {
    const service = createMockAssistantService({ now: () => now, contextProvider: jest.fn().mockResolvedValue(context()) });
    await service.setConsent(true, 1, 'consent-enable');
    const conversation = await service.createConversation({ question: 'Start' }, 'conversation-start');

    const questions = [
      ['What did I spend?', 'direct'],
      ['Compare this month and last month', 'comparison'],
      ['Why was spending higher?', 'explanation'],
      ['How can I save more?', 'saving_suggestion'],
      ['Make me a plan', 'plan'],
      ['Analyze obligations', 'obligation_analysis'],
      ['What is my investment return?', 'insufficient_data'],
      ['Open subscriptions', 'safe_redirect']
    ] as const;

    for (const [question, responseType] of questions) {
      const result = await service.ask(conversation.value.id, question, `ask-${responseType}`);
      expect(result.value.responseType).toBe(responseType);
      expect(result.value.blocks[0].key).toBe(`assistant.answer.${responseType}`);
      expect(result.value.blocks[0].values).toEqual(expect.objectContaining({ minor: 12500, currency: 'SAR' }));
      expect(JSON.stringify(result.value.blocks)).not.toContain('999999');
      expect(result.value.snapshot.values).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'assistant.context.transaction.confirmed.total', minor: 12500, currency: 'SAR' })
      ]));
      if (responseType === 'safe_redirect') expect(result.value.limitations).toContain('educational_redirect');
      if (responseType === 'insufficient_data') expect(result.value.limitations).toContain('insufficient_data');
    }
  });

  it('keeps snapshots immutable and isolates paging, rename, delete, and feedback', async () => {
    const service = createMockAssistantService({ now: () => now, contextProvider: jest.fn().mockResolvedValue(context()) });
    await service.setConsent(true, 1, 'consent-enable');
    const first = await service.createConversation({ question: 'First' }, 'create-first');
    const second = await service.createConversation({ question: 'Second' }, 'create-second');

    expect((await service.listConversations({ pageSize: 1 })).items).toHaveLength(1);
    const renamed = await service.renameConversation(first.value.id, 'Budget help', first.value.version, 'rename-first');
    expect(renamed.value.title).toBe('Budget help');

    const response = await service.ask(first.value.id, 'What did I spend?', 'ask-first');
    expect(() => {
      (response.value.snapshot.sources as unknown[]).push({ kind: 'report', id: 'mutated', version: 1 });
    }).toThrow();
    expect(() => {
      (response.value.blocks as unknown[]).push({ label: 'fact', key: 'mutated', values: {} });
    }).toThrow();
    expect((await service.setResponseFeedback(response.value.id, 'helpful', 'feedback-first')).value.feedback).toBe('helpful');

    await service.deleteConversation(first.value.id, renamed.value.version, 'delete-first');
    await expect(service.getConversation(first.value.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.ask(first.value.id, 'Revive deleted?', 'ask-deleted')).rejects.toMatchObject({ code: 'not_found' });
    expect((await service.getConversation(second.value.id)).conversation.status).toBe('active');
  });

  it('returns safe disablement, offline, error, and limit states', async () => {
    const disabled = createMockAssistantService({ now: () => now, contextProvider: jest.fn().mockResolvedValue(context()) });
    await disabled.setConsent(true, 1, 'consent-enable');
    const conversation = await disabled.createConversation({ question: 'Start' }, 'create-disabled');
    await disabled.setConsent(false, 2, 'consent-disable');
    await expect(disabled.ask(conversation.value.id, 'Anything?', 'ask-disabled')).rejects.toMatchObject({ code: 'assistant_disabled' });

    const offline = createMockAssistantService({ offline: true, now: () => now, contextProvider: jest.fn().mockResolvedValue(context()) });
    await offline.setConsent(true, 1, 'consent-enable');
    await expect(offline.createConversation({ question: 'Start' }, 'create-offline')).rejects.toMatchObject({ code: 'offline' });

    const limited = createMockAssistantService({ remainingQuestions: 0, now: () => now, contextProvider: jest.fn().mockResolvedValue(context()) });
    await limited.setConsent(true, 1, 'consent-enable');
    expect(await limited.getAvailability()).toEqual({ status: 'limit_reached', remainingQuestions: 0 });
    await expect(limited.createConversation({ question: 'Start' }, 'create-limited')).rejects.toMatchObject({ code: 'limit_reached' });

    const failing = createMockAssistantService({ now: () => now, contextProvider: jest.fn().mockRejectedValue(new Error('raw provider')) });
    await failing.setConsent(true, 1, 'consent-enable');
    await expect(failing.createConversation({ question: 'Start' }, 'create-failing')).rejects.toMatchObject({ code: 'representative_failure' });
  });
});

function context() {
  return {
    dataAsOf: now,
    period: 'monthly:2026-01-01',
    snapshot: {
      sources: [{ kind: 'transaction', id: 'confirmed-expense', version: 3 }],
      values: [{ key: 'assistant.context.transaction.confirmed.total', minor: 12500, currency: 'SAR', status: 'available' }],
      completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: [] },
      reportReference: 'report-monthly-2026-01'
    }
  };
}
