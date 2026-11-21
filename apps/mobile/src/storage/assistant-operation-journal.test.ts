import { AssistantOperationJournal } from './assistant-operation-journal';

it('persists immutable identity before dispatch and reuses it after a restart', async () => {
  const storage = new Map<string, string>();
  const store = {
    read: async (key: string) => storage.get(key) ?? null,
    write: async (key: string, value: string) => {
      storage.set(key, value);
    }
  };
  const first = new AssistantOperationJournal(store);
  await first.reserve(
    'owner',
    'question',
    { question: 'sample', conversationId: null },
    'original-operation-0001'
  );
  const restart = new AssistantOperationJournal(store);
  expect(
    (
      await restart.reserve(
        'owner',
        'question',
        { question: 'sample', conversationId: null },
        'replacement-operation'
      )
    ).operationId
  ).toBe('original-operation-0001');
  await expect(
    restart.reserve(
      'owner',
      'question',
      { question: 'different', conversationId: null },
      'other-operation-0002'
    )
  ).rejects.toThrow('operation_unresolved');
  expect(await restart.read('other-owner', 'question')).toBeNull();
});

it('rejects corrupt records without replacing uncertain work', async () => {
  const journal = new AssistantOperationJournal({
    read: async () => '{bad',
    write: jest.fn()
  });
  await expect(journal.read('owner', 'question')).rejects.toThrow(
    'operation_journal_corrupt'
  );
});

it('serializes concurrent reservations and binds updates to the saved operation', async () => {
  let payload: string | null = null;
  const journal = new AssistantOperationJournal({
    read: async () => payload,
    write: async (_key, value) => {
      payload = value;
    }
  });
  const [one, two] = await Promise.all(
    ['operation-00000001', 'operation-00000002'].map((key) =>
      journal.reserve(
        'owner',
        'question',
        { question: 'sample', conversationId: null },
        key
      )
    )
  );
  expect(one.operationId).toBe(two.operationId);
  await expect(
    journal.update('owner', 'question', 'incorrect-operation', {
      phase: 'accepted'
    })
  ).rejects.toThrow('operation_conflict');
});

it('does not change acknowledged identities or regress terminal work', async () => {
  let payload: string | null = null;
  const journal = new AssistantOperationJournal({
    read: async () => payload,
    write: async (_key, value) => {
      payload = value;
    }
  });
  const operation = await journal.reserve(
    'owner',
    'question',
    { question: 'sample' },
    'operation-00000001'
  );
  await journal.update('owner', 'question', operation.operationId, {
    phase: 'accepted',
    conversationId: 'conversation',
    messageId: 'message'
  });
  await expect(
    journal.update('owner', 'question', operation.operationId, {
      messageId: 'different'
    })
  ).rejects.toThrow('operation_conflict');
  await journal.update('owner', 'question', operation.operationId, {
    phase: 'completed'
  });
  await expect(
    journal.update('owner', 'question', operation.operationId, {
      phase: 'accepted'
    })
  ).rejects.toThrow('operation_conflict');
});
