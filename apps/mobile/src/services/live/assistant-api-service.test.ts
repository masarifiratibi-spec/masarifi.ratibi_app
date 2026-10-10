import {
  assistantPollDelay,
  createLiveAssistantApiService
} from './assistant-api-service';
import { createMemoryAssistantJournal } from '@/storage/assistant-operation-journal';
import { samples } from '@/test-utils/assistant-action-preview-fixtures';

const id = (suffix: number) =>
  `99100000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const at = '2026-09-03T00:00:00.000Z';
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
const conversation = {
  id: id(1),
  title: 'Spend?',
  status: 'active',
  lastMessageAt: '2026-09-03T00:00:01.000Z',
  version: 2,
  createdAt: at,
  updatedAt: '2026-09-03T00:00:02.000Z'
};

it('bounds stalled authentication and ignores its late resolution without sending a question', async () => {
  jest.useFakeTimers();
  try {
    let release!: (token: string) => void;
    const token = new Promise<string>((resolve) => { release = resolve; });
    const request = jest.fn();
    const journal = createMemoryAssistantJournal();
    const service = createLiveAssistantApiService({
      baseUrl: 'https://api.test', token: () => token, request, journal,
      requestTimeoutMs: 10
    });
    const outcome = service.ask(id(1), 'Income?', 'sample-auth-timeout-key')
      .then(() => 'completed', (error: {code: string}) => error.code);
    await jest.advanceTimersByTimeAsync(20);
    expect(await Promise.race([outcome, Promise.resolve('still_pending')])).toBe('offline');
    release('late-auth-token');
    await jest.advanceTimersByTimeAsync(20);
    expect(request).not.toHaveBeenCalled();
    expect(await journal.read('inert-adapter-owner', 'question')).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('recovers the original conversation when the deployed getter serializes its bigint version as decimal text', async () => {
  const journal = createMemoryAssistantJournal();
  const key = 'sample-bigint-recovery-0001';
  await journal.reserve(
    'inert-adapter-owner',
    'question',
    { conversationId: null, question: 'Spend?' },
    key
  );
  await journal.update('inert-adapter-owner', 'question', key, {
    phase: 'created',
    conversationId: id(1)
  });
  const request = jest
    .fn()
    .mockResolvedValueOnce(json({ ...conversation, version: '2' }))
    .mockResolvedValueOnce(json({ code: 'AI_MESSAGE_NOT_FOUND' }, 404))
    .mockResolvedValueOnce(
      json({ id: id(2), status: 'completed', replayed: false }, 202)
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    journal
  });
  await expect(service.retryQuestionOperation!()).resolves.toMatchObject({
    value: { conversationId: id(1) }
  });
  expect(request.mock.calls.map((call) => call[1].method)).toEqual([
    'GET',
    'GET',
    'POST'
  ]);
  expect(request.mock.calls[2][1].headers['Idempotency-Key']).toBe(
    `${key}-message`
  );
  expect(await service.readQuestionOperation!()).toMatchObject({
    operationId: key,
    phase: 'accepted',
    messageId: id(2)
  });
});

it.each(['9007199254740993', '0', '-1', '1.5', 'invalid', null])(
  'rejects an invalid legacy conversation fence %s',
  async (version) => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(json({ ...conversation, version }));
    const service = createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    });
    await expect(service.getConversation(id(1))).rejects.toMatchObject({
      code: 'representative_failure'
    });
    expect(request).toHaveBeenCalledTimes(1);
  }
);

it.each([false, true])(
  'accepts the API replay flag (%s) without losing question identity',
  async (replayed) => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(json(conversation, 201))
      .mockResolvedValueOnce(
        json({ id: id(2), status: 'completed', replayed }, 202)
      );
    const service = createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    });
    await expect(
      service.createConversation(
        { question: 'How much did I spend?' },
        'sample-contract-key-0001'
      )
    ).resolves.toMatchObject({ value: { id: id(1) } });
    expect(await service.readQuestionOperation!()).toMatchObject({
      phase: 'accepted',
      conversationId: id(1),
      messageId: id(2),
      operationId: 'sample-contract-key-0001'
    });
  }
);

it('releases a definitively rejected creation while preserving its failed question', async () => {
  const journal = createMemoryAssistantJournal();
  const request = jest
    .fn()
    .mockResolvedValue(json({ code: 'AI_CONSENT_REQUIRED' }, 403));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    journal
  });
  await expect(
    service.createConversation(
      { question: 'Sample spending?' },
      'sample-create-key-0001'
    )
  ).rejects.toMatchObject({ code: 'consent_required' });
  expect(await service.readQuestionOperation!()).toMatchObject({
    phase: 'failed',
    question: 'Sample spending?',
    conversationId: null
  });
  await expect(
    journal.reserve(
      'inert-adapter-owner',
      'question',
      { conversationId: null, question: 'Sample income?' },
      'sample-create-key-0002'
    )
  ).resolves.toMatchObject({ phase: 'prepared' });
  expect(request).toHaveBeenCalledTimes(1);
});

it('explicitly retries an uncertain creation with the original identity and question', async () => {
  const request = jest
    .fn()
    .mockRejectedValueOnce(new Error('lost response'))
    .mockResolvedValueOnce(json(conversation, 201))
    .mockResolvedValueOnce(json({ id: id(2), status: 'queued' }, 202));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await expect(
    service.createConversation(
      { question: 'Sample original spending?' },
      'sample-original-key-0001'
    )
  ).rejects.toMatchObject({ code: 'outcome_unknown' });
  expect(await service.readQuestionOperation!()).toMatchObject({
    phase: 'prepared'
  });
  await expect(service.retryQuestionOperation!()).resolves.toMatchObject({
    value: { conversationId: id(1) }
  });
  expect(
    request.mock.calls
      .slice(0, 2)
      .map((call) => call[1].headers['Idempotency-Key'])
  ).toEqual(['sample-original-key-0001', 'sample-original-key-0001']);
  expect(JSON.parse(request.mock.calls[1][1].body).title).toBe(
    'Sample original spending?'
  );
  expect(request.mock.calls[2][1].headers['Idempotency-Key']).toBe(
    'sample-original-key-0001-message'
  );
});

function preview(status = 'validated', version = 3) {
  return {
    id: id(5),
    messageId: id(3),
    schemaVersion: 1,
    actionType: 'savings_goal.create',
    payload: { name: 'Buffer', targetMinor: '50000', currencyCode: 'SAR' },
    status,
    expiresAt: '2026-09-03T00:15:00.000Z',
    confirmedAt: status === 'executed' ? '2026-09-03T00:02:00.000Z' : null,
    executedResourceId: status === 'executed' ? id(6) : null,
    confirmationOperationId: ['executed', 'confirmed'].includes(status)
      ? id(7)
      : null,
    createdAt: at,
    updatedAt: '2026-09-03T00:00:01.000Z',
    version
  };
}

function messages(actionPreview: unknown = null) {
  return {
    items: [
      {
        id: id(3),
        conversationId: id(1),
        replyToMessageId: id(2),
        role: 'assistant',
        content: 'Safe answer',
        status: 'completed',
        failureCode: null,
        snapshot: {
          id: id(4),
          schemaVersion: 1,
          evidenceRefs: [{ kind: 'budget', alias: 'BUDGET-1', version: 8 }],
          model: 'approved-model',
          provider: 'approved-provider',
          createdAt: '2026-09-03T00:00:01.000Z'
        },
        preview: actionPreview,
        createdAt: '2026-09-03T00:00:01.000Z'
      },
      {
        id: id(2),
        conversationId: id(1),
        replyToMessageId: null,
        role: 'user',
        content: 'Spend?',
        status: 'completed',
        failureCode: null,
        snapshot: null,
        preview: null,
        createdAt: at
      }
    ],
    nextCursor: null
  };
}

const conversations = { items: [conversation], nextCursor: null };

it.each(['accepted', 'failed'] as const)(
  'retains a %s terminal question outside the current page and projects its failure',
  async (phase) => {
    const journal = createMemoryAssistantJournal();
    const operation = await journal.reserve(
      'sample-owner',
      'question',
      { question: 'Spend?', conversationId: id(1) },
      'question-original-operation-12345'
    );
    await journal.update('sample-owner', 'question', operation.operationId, {
      phase: 'accepted',
      messageId: id(2)
    });
    if (phase === 'failed')
      await journal.update('sample-owner', 'question', operation.operationId, {
        phase
      });
    const failed = {
      ...messages().items[1],
      status: 'failed',
      failureCode: 'AI_PROVIDER_TIMEOUT'
    };
    const request = jest
      .fn()
      .mockResolvedValueOnce(json(conversation))
      .mockResolvedValueOnce(json({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(json(failed));
    const service = createLiveAssistantApiService({
      baseUrl: 'https://api.example.test',
      token: async () => 'sample-token',
      request,
      journal,
      identity: async () => ({
        userId: 'sample-owner',
        token: 'sample-token',
        assertCurrent: async () => undefined
      })
    });
    const page = await service.getConversation(id(1));
    expect(page.failureCode).toBe('AI_PROVIDER_TIMEOUT');
    expect(page.userTurns).toContainEqual(
      expect.objectContaining({
        id: id(2),
        content: 'Spend?',
        status: 'failed'
      })
    );
    expect(request.mock.calls.every((call) => call[1].method === 'GET')).toBe(
      true
    );
  }
);

it('requires re-review if authoritative effect context changes before confirmation', async () => {
  const sample = samples[2];
  const effect = { ...sample.effect, budgetId: id(8) };
  const action = { ...preview(), actionType: 'budget.update', payload: effect };
  const target = { ...sample.context.target, id: id(8) };
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(action)))
    .mockResolvedValueOnce(json(target))
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(action)))
    .mockResolvedValueOnce(json({ ...target, totalMinor: '26000' }));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    now: () => Date.parse(at)
  });
  await service.getActionPreview(id(5));
  await expect(
    service.confirmAction(id(5), 3, 'confirm-reviewed-operation')
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
    'GET',
    'GET',
    'GET',
    'GET',
    'GET',
    'GET'
  ]);
});

it('loads authoritative update context with owner GETs and blocks a stale target', async () => {
  const action = {
    ...preview(),
    actionType: 'budget.update',
    payload: {
      budgetId: id(8),
      expectedVersion: 2,
      patch: { status: 'deleted' }
    }
  };
  const target = {
    id: id(8),
    version: 3,
    deletedAt: null,
    currencyCode: 'SAR'
  };
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(action)))
    .mockResolvedValueOnce(json(target));
  const value = await createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  }).getActionPreview(id(5));
  expect(request.mock.calls[2]?.[0]).toBe(
    `https://api.test/api/v1/budgets/${id(8)}`
  );
  expect(value).toMatchObject({
    confirmationAllowed: false,
    disclosure: { complete: false, reason: 'stale' }
  });
  expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
    'GET',
    'GET',
    'GET'
  ]);
});

it('preserves the original action timezone through the real message/preview mapper', async () => {
  const action = {
    ...preview(),
    actionType: 'transaction.create',
    payload: {
      amountMinor: '1250',
      currency: 'SAR',
      accountId: id(8),
      categoryId: null,
      date: '2026-10-07',
      merchant: null,
      note: null
    }
  };
  const rows = messages(action);
  Object.assign(rows.items[1]!, { actionTimezone: 'Asia/Riyadh' });
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(rows));
  const value = await createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  }).getActionPreview(id(5));
  expect(value).toMatchObject({
    effectTimezone: 'Asia/Riyadh',
    confirmationAllowed: true,
    disclosure: {
      complete: true,
      fields: expect.arrayContaining([
        expect.objectContaining({ key: 'timezone', value: 'Asia/Riyadh' })
      ])
    }
  });
});

it('backs off assistant polling without exceeding two seconds', () => {
  expect([0, 5, 10, 20, 40].map(assistantPollDelay)).toEqual([
    250, 500, 1000, 2000, 2000
  ]);
});

it('sends canonical quick-question intent without a broad client-selected context scope', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation, 201))
    .mockResolvedValueOnce(json({ id: id(2), status: 'completed' }, 202))
    .mockResolvedValueOnce(json(messages()));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await service.createConversation(
    { question: 'Spend?', intent: 'spending_summary' },
    'quick-question-operation'
  );

  expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({
    content: 'Spend?',
    intent: 'spending_summary',
    responseMode: 'async'
  });
});

it('uses authoritative owner availability and shared rolling-quota values', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(
      json({
        status: 'available',
        limit: 5,
        used: 2,
        remaining: 3,
        resetsAt: '2026-09-04T00:00:00.000Z'
      })
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await expect(service.getAvailability()).resolves.toEqual({
    status: 'available',
    remainingQuestions: 3,
    limit: 5,
    used: 2,
    resetsAt: '2026-09-04T00:00:00.000Z'
  });
  expect(request.mock.calls[0]?.[0]).toBe(
    'https://api.test/api/v1/assistant/availability'
  );
});

it('maps authoritative proactive insights without inventing financial values', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(
      json({
        items: [
          {
            id: id(10),
            signalKey: `budget:${id(11)}:85`,
            kind: 'budget_threshold',
            payload: {
              budgetName: 'Restaurants',
              currency: 'SAR',
              budgetMinor: '100000',
              spentMinor: '85000',
              remainingMinor: '15000',
              utilizationBps: 8500
            },
            sourceVersion: 12,
            status: 'active',
            expiresAt: '2026-09-17T00:00:00.000Z',
            createdAt: at
          }
        ]
      })
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await expect(service.listInsights()).resolves.toEqual([
    expect.objectContaining({
      id: id(10),
      budgetName: 'Restaurants',
      budgetMinor: 100000,
      spentMinor: 85000,
      remainingMinor: 15000,
      utilizationBps: 8500
    })
  ]);
});

it('retrieves a response on a cold service and preserves exact evidence versions', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages()));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await expect(service.getResponse(id(3))).resolves.toMatchObject({
    id: id(3),
    conversationId: id(1),
    question: 'Spend?',
    blocks: [{ key: 'Safe answer' }],
    snapshot: { sources: [{ kind: 'budget', id: 'BUDGET-1', version: 8 }] }
  });
});

it('retrieves and strictly maps a cold action preview while exposing edit as unavailable', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  const value = await service.getActionPreview(id(5));
  expect(value).toMatchObject({
    id: id(5),
    responseId: id(3),
    kind: 'create_goal',
    input: { amountMinor: 50_000, currency: 'SAR' },
    sourceVersions: [{ id: 'BUDGET-1', version: 8 }],
    status: 'ready',
    version: 3
  });
  await expect(
    service.updateActionPreview(id(5), value.input, 3)
  ).rejects.toMatchObject({ code: 'assistant_disabled' });
  expect(request).toHaveBeenCalledTimes(2);
});

it('does not return a cached preview after the authoritative owner lookup stops containing it', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())))
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages()));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await expect(service.getActionPreview(id(5))).resolves.toMatchObject({
    id: id(5)
  });
  await expect(service.getActionPreview(id(5))).rejects.toMatchObject({
    code: 'not_found'
  });
  expect(request).toHaveBeenCalledTimes(4);
});

it('sends the expected consent version and returns the authoritative next version', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(
      json({
        policyVersion: 'assistant-privacy-v1',
        granted: true,
        grantedAt: at,
        revokedAt: null,
        version: 4
      })
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });

  await expect(
    service.setConsent(true, 3, 'consent-operation')
  ).resolves.toMatchObject({
    value: { status: 'enabled', version: 4 }
  });
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
    policyVersion: 'assistant-privacy-v1',
    accepted: true,
    expectedVersion: 3
  });
});

it('re-reads the authoritative preview after confirmation instead of incrementing a cached version', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())))
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())))
    .mockResolvedValueOnce(
      json({
        sourceId: id(5),
        actionType: 'savings_goal.create',
        resourceId: id(6),
        status: 'executed',
        replayed: false
      })
    )
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview('executed', 6))));
  const service = createLiveAssistantApiService({
    now: () => Date.parse('2026-09-03T00:00:02Z'),
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await service.getActionPreview(id(5));

  await expect(
    service.confirmAction(id(5), 3, 'confirm-operation')
  ).resolves.toMatchObject({
    value: {
      id: id(5),
      status: 'succeeded',
      operationId: id(7),
      resultReference: id(6),
      version: 6
    }
  });
  expect(JSON.parse(String(request.mock.calls[4]?.[1]?.body))).toEqual({
    expectedVersion: 3
  });
  expect(request.mock.calls[4]?.[1]?.headers).toEqual(
    expect.objectContaining({ 'Idempotency-Key': 'confirm-operation' })
  );
});

it('fails explicitly on unknown owner states and maps supported transaction updates', async () => {
  const unknownConversation = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(
      json({ items: [{ ...conversation, status: 'future' }], nextCursor: null })
    );
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request: unknownConversation
    }).listConversations({})
  ).rejects.toMatchObject({ code: 'representative_failure' });

  const unsupportedPreview = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(
      json(
        messages({
          ...preview(),
          actionType: 'transaction.update',
          payload: {
            transactionId: id(8),
            expectedVersion: 1,
            reason: 'Update'
          }
        })
      )
    );
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request: unsupportedPreview
    }).getActionPreview(id(5))
  ).resolves.toMatchObject({
    kind: 'update_transaction',
    affectedDestination: { kind: 'transactions' }
  });
});

it.each([
  [
    'transaction.create',
    { amountMinor: '1250', currency: 'SAR' },
    'create_transaction'
  ],
  [
    'transaction.update',
    { transactionId: id(8), expectedVersion: 1, reason: 'Update' },
    'update_transaction'
  ],
  [
    'budget.update',
    { budgetId: id(8), expectedVersion: 1, patch: { totalMinor: '100000' } },
    'update_budget'
  ],
  [
    'savings_goal.create',
    { name: 'Buffer', targetMinor: '50000', currencyCode: 'SAR' },
    'create_goal'
  ],
  [
    'obligation.payment.record',
    { obligationId: id(8), transactionId: id(9), expectedVersion: 1 },
    'record_obligation_payment'
  ],
  [
    'tracking.review.resolve',
    { reviewId: id(8), decision: 'accept', expectedVersion: 1, edit: {} },
    'resolve_tracking_review'
  ]
] as const)(
  'maps backend action %s safely',
  async (actionType, payload, kind) => {
    const request = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(json(conversations))
      .mockResolvedValueOnce(
        json(messages({ ...preview(), actionType, payload }))
      );

    await expect(
      createLiveAssistantApiService({
        baseUrl: 'https://api.test',
        token: async () => 'owner',
        request
      }).getActionPreview(id(5))
    ).resolves.toMatchObject({ kind });
  }
);

it('stops immediately on a failed accepted user message without scanning history', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json({ id: id(2), status: 'queued' }, 202))
    .mockResolvedValueOnce(
      json({
        id: id(2),
        conversationId: id(1),
        status: 'failed',
        failureCode: 'AI_QUOTA_EXCEEDED',
        request: messages().items[1],
        response: null
      })
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    sleep: async () => {}
  });
  await expect(
    service.ask(id(1), 'Spend?', 'stable-question-operation')
  ).rejects.toMatchObject({ code: 'limit_reached' });
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1]?.[0]).toContain(`/messages/${id(2)}/result`);
});

it('returns the acknowledged conversation before waiting for its answer', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation, 201))
    .mockResolvedValueOnce(json({ id: id(2), status: 'queued' }, 202));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await expect(
    service.createConversation(
      { question: 'Spend?' },
      'stable-create-operation'
    )
  ).resolves.toMatchObject({ value: { id: id(1), lastResponseId: null } });
  expect(request).toHaveBeenCalledTimes(2);
});

it('preserves aggregate ledger evidence and its authoritative as-of time', async () => {
  const rows = messages();
  rows.items[0]!.snapshot!.evidenceRefs = [
    { kind: 'ledger', alias: 'EVIDENCE-1', version: 12, asOf: at }
  ] as never;
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(rows));
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).getResponse(id(3))
  ).resolves.toMatchObject({
    dataAsOf: Date.parse(at),
    snapshot: { sources: [{ kind: 'ledger', asOf: at }] }
  });
});

it('rejects invalid evidence identifiers rather than accepting an unsupported source', async () => {
  const rows = messages();
  rows.items[0]!.snapshot!.evidenceRefs[0]!.alias =
    'https://example.test/source';
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(rows));
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).getResponse(id(3))
  ).rejects.toMatchObject({ code: 'representative_failure' });
});

it('fetches a question across a message-page boundary without losing its reply relationship', async () => {
  const rows = messages();
  const parent = rows.items.pop();
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation))
    .mockResolvedValueOnce(json({ ...rows, nextCursor: 'older-page' }))
    .mockResolvedValueOnce(json(parent));
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).getConversation(id(1))
  ).resolves.toMatchObject({
    responses: { items: [{ question: 'Spend?' }], nextCursor: 'older-page' }
  });
  expect(request.mock.calls[2]?.[0]).toContain(`/messages/${id(2)}`);
});

it('preserves complete effect fields for a validated goal', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())));
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).getActionPreview(id(5))
  ).resolves.toMatchObject({
    effect: { name: 'Buffer', targetMinor: '50000', currencyCode: 'SAR' },
    confirmationAllowed: true
  });
});

it('blocks confirmation of an incomplete transaction effect before a write', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(
      json(
        messages({
          ...preview(),
          actionType: 'transaction.create',
          payload: { amountMinor: '1250', currency: 'SAR' }
        })
      )
    );
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).confirmAction(id(5), 3, 'confirm-operation-0001')
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(request).toHaveBeenCalledTimes(2);
});

it('reuses the first-create identity after losing its response', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValueOnce(json(conversation, 201))
    .mockResolvedValueOnce(json({ id: id(2), status: 'queued' }, 202));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await expect(
    service.createConversation(
      { question: 'Spend?' },
      'original-create-key-0001'
    )
  ).rejects.toMatchObject({ code: 'outcome_unknown' });
  await service.createConversation(
    { question: 'Spend?' },
    'replacement-key-0002'
  );
  expect(request.mock.calls[1]?.[1]?.headers).toEqual(
    expect.objectContaining({ 'Idempotency-Key': 'original-create-key-0001' })
  );
});

it('checks acceptance after a lost message response rather than submitting another message', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation, 201))
    .mockRejectedValueOnce(new Error('lost acceptance'))
    .mockResolvedValueOnce(json(conversation))
    .mockResolvedValueOnce(json({ id: id(2), status: 'processing' }));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await expect(
    service.createConversation(
      { question: 'Spend?' },
      'original-create-key-0001'
    )
  ).rejects.toMatchObject({ code: 'outcome_unknown' });
  await service.createConversation(
    { question: 'Spend?' },
    'replacement-key-0002'
  );
  expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
    'POST',
    'POST',
    'GET',
    'GET'
  ]);
  expect(request.mock.calls[3]?.[0]).toContain('/messages/acceptance');
});

it('maps estimate, period and financial values from versioned answer metadata', async () => {
  const rows = messages();
  Object.assign(rows.items[1]!, {
    metadata: {
      schemaVersion: 1,
      locale: 'en',
      timezone: 'Asia/Riyadh',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      currencies: ['SAR'],
      responseType: 'estimate',
      generatedAt: at,
      values: [
        {
          key: 'expense',
          minor: '235000',
          currency: 'SAR',
          status: 'available'
        }
      ],
      reasons: ['liquidity_incomplete']
    }
  });
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(rows));
  await expect(
    createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request
    }).getResponse(id(3))
  ).resolves.toMatchObject({
    blocks: [{ label: 'estimate' }],
    period: '2026-09-01/2026-09-30',
    snapshot: {
      values: [{ minor: 235000, exactMinor: '235000', currency: 'SAR' }]
    },
    limitations: expect.arrayContaining(['liquidity_incomplete'])
  });
});

it('reconciles accepted work outside the current history page with a direct read after restart', async () => {
  const journal = createMemoryAssistantJournal();
  const key = 'original-question-key-0001';
  await journal.reserve(
    'inert-adapter-owner',
    'question',
    { conversationId: id(1), question: 'Spend?' },
    key
  );
  await journal.update('inert-adapter-owner', 'question', key, {
    phase: 'accepted',
    messageId: id(2)
  });
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation))
    .mockResolvedValueOnce(json({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(json(messages().items[1]));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    journal
  });
  await service.getConversation(id(1));
  expect((await service.readQuestionOperation!())?.phase).toBe('completed');
  expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
    'GET',
    'GET',
    'GET'
  ]);
  expect(request.mock.calls[2]?.[0]).toContain(`/messages/${id(2)}`);
});

it('resumes a lost acceptance through reads only with its saved identity', async () => {
  const journal = createMemoryAssistantJournal();
  const key = 'original-create-key-0001';
  await journal.reserve(
    'inert-adapter-owner',
    'question',
    { conversationId: null, question: 'Spend?' },
    key
  );
  await journal.update('inert-adapter-owner', 'question', key, {
    phase: 'created',
    conversationId: id(1)
  });
  const rows = messages();
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json({ id: id(2), status: 'completed' }))
    .mockResolvedValueOnce(
      json({
        id: id(2),
        conversationId: id(1),
        status: 'completed',
        failureCode: null,
        request: rows.items[1],
        response: rows.items[0]
      })
    );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    journal
  });
  await expect(service.resumeQuestion!()).resolves.toMatchObject({
    value: { id: id(3) }
  });
  expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
    'GET',
    'GET'
  ]);
  expect(request.mock.calls[0]?.[1]?.headers).toEqual(
    expect.objectContaining({ 'Idempotency-Key': `${key}-message` })
  );
});

it.each(['failed', 'cancelled'])(
  'unlocks recovered terminal %s work without replay',
  async (status) => {
    const journal = createMemoryAssistantJournal();
    const key = 'original-create-key-0001';
    await journal.reserve(
      'inert-adapter-owner',
      'question',
      { conversationId: null, question: 'Spend?' },
      key
    );
    await journal.update('inert-adapter-owner', 'question', key, {
      phase: 'created',
      conversationId: id(1)
    });
    const request = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(json({ id: id(2), status }))
      .mockResolvedValueOnce(
        json({
          id: id(2),
          conversationId: id(1),
          status,
          failureCode: 'AI_FAILED',
          request: messages().items[1],
          response: null
        })
      );
    const service = createLiveAssistantApiService({
      baseUrl: 'https://api.test',
      token: async () => 'owner',
      request,
      journal
    });
    await expect(service.resumeQuestion!()).rejects.toMatchObject({
      code: 'assistant_disabled'
    });
    expect(await service.readQuestionOperation!()).toMatchObject({
      phase: 'failed',
      messageId: id(2)
    });
    await expect(
      journal.reserve(
        'inert-adapter-owner',
        'question',
        { conversationId: id(1), question: 'Income?' },
        'new-question-key-0002'
      )
    ).resolves.toMatchObject({ phase: 'prepared' });
    expect(request.mock.calls.map((call) => call[1]?.method)).toEqual([
      'GET',
      'GET'
    ]);
  }
);

it('retries a known rejection using the acknowledged empty conversation rather than creating another', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversation, 201))
    .mockResolvedValueOnce(json({ code: 'AI_QUOTA_EXCEEDED' }, 429))
    .mockResolvedValueOnce(json(conversation))
    .mockResolvedValueOnce(json({ code: 'AI_MESSAGE_NOT_FOUND' }, 404))
    .mockResolvedValueOnce(json({ id: id(2), status: 'queued' }, 202));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request
  });
  await expect(
    service.createConversation(
      { question: 'Spend?' },
      'original-create-key-0001'
    )
  ).rejects.toMatchObject({ code: 'limit_reached' });
  await expect(
    service.createConversation({ question: 'Income?' }, 'new-question-key-0002')
  ).resolves.toMatchObject({ value: { id: id(1) } });
  expect(
    request.mock.calls.filter(
      (call) =>
        String(call[0]).endsWith('/conversations') && call[1]?.method === 'POST'
    )
  ).toHaveLength(1);
});

it('reconciles a lost confirmation response with its original version and identity', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview())))
    .mockRejectedValueOnce(new Error('lost commit response'))
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview('confirmed', 4))))
    .mockResolvedValueOnce(
      json({
        sourceId: id(5),
        actionType: 'savings_goal.create',
        resourceId: id(6),
        status: 'executed',
        replayed: true
      })
    )
    .mockResolvedValueOnce(json(conversations))
    .mockResolvedValueOnce(json(messages(preview('executed', 6))));
  const service = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    token: async () => 'owner',
    request,
    now: () => Date.parse(at)
  });
  await expect(
    service.confirmAction(id(5), 3, 'original-confirm-key-0001')
  ).rejects.toMatchObject({ code: 'outcome_unknown' });
  await expect(
    service.confirmAction(id(5), 4, 'replacement-confirm-key-0002')
  ).resolves.toMatchObject({ value: { status: 'succeeded', version: 6 } });
  expect(request.mock.calls[5]?.[1]?.headers).toEqual(
    expect.objectContaining({ 'Idempotency-Key': 'original-confirm-key-0001' })
  );
  expect(JSON.parse(String(request.mock.calls[5]?.[1]?.body))).toEqual({
    expectedVersion: 3
  });
});
