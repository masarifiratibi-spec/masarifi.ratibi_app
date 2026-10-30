import * as recentAuthentication from './http-client';
import { createLiveReportsService, ReportsApiError } from './reports-service';
import { ReportsRepository } from '@/storage/reports-repository';
import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

const generatedAt = '2026-09-04T00:00:00.000Z';
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
const input = {
  kind: 'monthly' as const,
  anchorDate: '2026-08-17' as const,
  currencyCode: 'SAR',
  timeZone: 'Asia/Riyadh'
};

it('uses owner-checked cached read authentication for live reports', async () => {
  const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) =>
    skipCache ? 'write' : 'read'
  );
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 's',
      userId: 'u',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const request = jest.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) => json(summary())
  );
  const live = createLiveReportsService({
    baseUrl: 'https://inert.invalid',
    request
  });
  expect(live.metadata.availability).toBe('available');
  expect((await live.getReport(input)).summary.income.value?.minorUnits).toBe(
    10000
  );
  expect(
    new Headers(request.mock.calls[0][1]?.headers).get('authorization')
  ).toBe('Bearer read');
  expect(getToken.mock.calls).toEqual([[{ skipCache: false }]]);
});

function summary(dataState: 'complete' | 'empty' | 'partial' = 'complete') {
  return {
    metadata: {
      schemaVersion: 1,
      generatedAt,
      ledgerVersion: 7,
      reportType: 'financial_summary',
      period: 'monthly',
      range: {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        timezone: 'Asia/Riyadh'
      },
      dataState,
      evidence: [{ kind: 'ledger', version: 7, asOf: generatedAt }]
    },
    summaries: [
      {
        income: { amountMinor: 10_000, currency: 'SAR' },
        expense: { amountMinor: 4_000, currency: 'SAR' },
        netCashFlow: { amountMinor: 6_000, currency: 'SAR' },
        savingsRateBasisPoints: 6_000,
        transactionCount: 2
      }
    ],
    breakdowns: [
      {
        categoryId: '99000000-0000-4000-8000-000000000001',
        labelAr: 'طعام',
        labelEn: 'Food',
        currencyCode: 'SAR',
        expenseMinor: 4_000,
        transactionCount: 1
      }
    ]
  };
}

function service(request: jest.Mock) {
  return createLiveReportsService({
    baseUrl: 'https://api.example.test',
    token: async () => 'owner-token',
    request
  });
}

describe('live reports strict mapping', () => {
  it.each([undefined, ['99000000-0000-4000-8000-000000000001']])(
    'loads the default calendar report with account scope %p from the deployed strict contract',
    async (accountIds) => {
      const request = jest.fn(async (url: RequestInfo | URL) => {
        const allowed = new Set([
          'type',
          'period',
          'anchorDate',
          'currency',
          'accountIds'
        ]);
        const query = new URL(String(url)).searchParams;
        return [...query.keys()].every((key) => allowed.has(key))
          ? json(summary())
          : json({ code: 'validation_error' }, 400);
      });

      await expect(
        service(request).getReport({ ...input, monthStartDay: 1, accountIds })
      ).resolves.toMatchObject({
        summary: { expense: { value: { minorUnits: 4_000 } } }
      });
      expect(
        new URL(String(request.mock.calls[0][0])).searchParams.get('accountIds')
      ).toBe(accountIds?.join(',') ?? null);
    }
  );

  it('preserves custom cycle and account scope when the server rejects unsupported parameters', async () => {
    const request = jest.fn(async (_url: RequestInfo | URL) =>
      json({ code: 'validation_error' }, 400)
    );

    await expect(
      service(request).getReport({
        ...input,
        monthStartDay: 15,
        accountIds: ['account-1']
      })
    ).rejects.toBeInstanceOf(ReportsApiError);
    expect(request).toHaveBeenCalledTimes(1);
    const query = new URL(String(request.mock.calls[0][0])).searchParams;
    expect(query.get('monthStartDay')).toBe('15');
    expect(query.get('accountIds')).toBe('account-1');
  });

  it('cancels a report during authentication without sending a late request', async () => {
    let release!: (token: string) => void;
    const token = new Promise<string>((resolve) => {
      release = resolve;
    });
    const request = jest.fn();
    const reports = createLiveReportsService({
      baseUrl: 'https://inert.invalid',
      token: () => token,
      request
    });
    const controller = new AbortController();
    const outcome = reports
      .getReport(input, { signal: controller.signal })
      .catch((error: ReportsApiError) => error.code);
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      expect(await Promise.race([outcome, Promise.resolve('pending')])).toBe(
        'offline'
      );
      release('late-token');
      await Promise.resolve();
      await Promise.resolve();
      expect(request).not.toHaveBeenCalled();
    } finally {
      release('late-token');
      await outcome;
    }
  });
  it('stops waiting for authentication and never sends a request when a late token arrives', async () => {
    jest.useFakeTimers();
    try {
      let release!: (token: string) => void;
      const token = new Promise<string>((resolve) => {
        release = resolve;
      });
      const request = jest.fn();
      const reports = createLiveReportsService({
        baseUrl: 'https://api.example.test',
        token: () => token,
        request,
        requestTimeoutMs: 10
      });
      const outcome = reports.getReport(input).then(
        () => 'completed',
        (error: ReportsApiError) => error.code
      );
      await jest.advanceTimersByTimeAsync(20);
      expect(
        await Promise.race([outcome, Promise.resolve('still_pending')])
      ).toBe('offline');
      release('late-token');
      await jest.advanceTimersByTimeAsync(20);
      expect(request).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
  it('sends the exact anchor and validates the server-owned range and timezone', async () => {
    const request = jest.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => json(summary())
    );
    const reports = service(request);

    await expect(reports.getReport(input)).resolves.toMatchObject({
      period: {
        anchorDate: '2026-08-17',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        timeZone: 'Asia/Riyadh'
      },
      dataState: 'partial',
      completenessReasons: ['unsupported_by_server'],
      summary: {
        income: { status: 'available', value: { minorUnits: 10_000 } },
        obligationPayments: {
          status: 'unavailable',
          reason: 'unsupported_by_server'
        },
        largestTransaction: {
          status: 'unavailable',
          reason: 'unsupported_by_server'
        }
      },
      breakdowns: [
        {
          dimension: 'category',
          items: [
            { id: '99000000-0000-4000-8000-000000000001', transactionCount: 1 }
          ]
        }
      ]
    });
    expect(String(request.mock.calls[0]?.[0])).toContain(
      'period=monthly&anchorDate=2026-08-17&currency=SAR'
    );

    const scoped = await reports.getReport({
      ...input,
      accountIds: ['account-1']
    });
    const other = await reports.getReport({
      ...input,
      accountIds: ['account-2']
    });
    expect(
      new URL(String(request.mock.calls[1]?.[0])).searchParams.get('accountIds')
    ).toBe('account-1');
    expect(scoped.key).not.toBe(other.key);
    expect(scoped.breakdowns[0].items[0].drillDown).toMatchObject({
      filters: {
        accountIds: ['account-1'],
        categoryIds: ['99000000-0000-4000-8000-000000000001']
      }
    });
  });

  it('keeps EGP currency and the selected account scope on the export preview', async () => {
    const egp = summary();
    egp.summaries[0].income.currency = 'EGP';
    egp.summaries[0].expense.currency = 'EGP';
    egp.summaries[0].netCashFlow.currency = 'EGP';
    egp.breakdowns[0].currencyCode = 'EGP';
    const reports = service(jest.fn(async () => json(egp)));
    expect(
      (
        await reports.getReport({
          ...input,
          accountIds: ['egp-account'],
          currencyCode: 'EGP'
        })
      ).summary.expense
    ).toMatchObject({ value: { currencyCode: 'EGP', minorUnits: 4000 } });
    await expect(
      reports.previewOutput({
        ...input,
        accountIds: ['egp-account'],
        currencyCode: 'EGP',
        language: 'en',
        detailLevel: 'summary',
        recipientEmail: null
      })
    ).resolves.toMatchObject({
      accountIds: ['egp-account'],
      snapshot: { currencyCode: 'EGP' }
    });
  });

  it('preserves partial source state and rejects mismatched or unknown response data', async () => {
    const partial = service(
      jest.fn().mockResolvedValue(json(summary('partial')))
    );
    await expect(partial.getReport(input)).resolves.toMatchObject({
      dataState: 'partial',
      completenessReasons: expect.arrayContaining([
        'source_incomplete',
        'unsupported_by_server'
      ]),
      summary: {
        income: {
          status: 'incomplete',
          value: { minorUnits: 10_000 },
          reasons: ['source_incomplete']
        }
      }
    });

    const wrongZone = summary();
    wrongZone.metadata.range.timezone = 'UTC';
    await expect(
      service(jest.fn().mockResolvedValue(json(wrongZone))).getReport(input)
    ).rejects.toMatchObject({ code: 'report_timezone_unavailable' });

    const unknown = { ...summary(), extra: true };
    await expect(
      service(jest.fn().mockResolvedValue(json(unknown))).getReport(input)
    ).rejects.toMatchObject({ code: 'contract_mismatch' });

    await expect(
      service(
        jest.fn().mockResolvedValue(new Response('not-json', { status: 200 }))
      ).getReport(input)
    ).rejects.toMatchObject({ code: 'contract_mismatch' });
  });

  it('makes unsupported breakdown and schedule settings explicit while keeping drafts local', async () => {
    const repository = new ReportsRepository(false);
    const request = jest.fn().mockResolvedValue(json(summary()));
    const reports = createLiveReportsService({
      baseUrl: 'https://api.example.test',
      token: async () => 'owner-token',
      request,
      repository
    });
    await expect(
      reports.getBreakdown({ ...input, dimension: 'merchant' })
    ).rejects.toMatchObject({ code: 'report_dimension_unavailable' });
    await expect(
      reports.saveSchedule(
        {
          recipientEmail: 'owner@example.test',
          frequency: 'monthly',
          language: 'en',
          currencyCode: 'SAR',
          deliveryDay: 7,
          timeZone: 'Asia/Riyadh',
          includeAssistantSummary: true,
          detailLevel: 'detailed'
        },
        null,
        'schedule-key'
      )
    ).rejects.toMatchObject({ code: 'report_schedule_settings_unavailable' });

    const draft = {
      id: 'report_schedule' as const,
      payload: {
        recipientEmail: 'owner@example.test',
        frequency: 'monthly' as const,
        language: 'en' as const,
        currencyCode: 'SAR',
        deliveryDay: 7,
        timeZone: 'Asia/Riyadh',
        includeAssistantSummary: true,
        detailLevel: 'detailed' as const
      },
      baseVersion: null,
      status: 'editing' as const,
      updatedAt: 1
    };
    await reports.saveScheduleDraft(draft);
    await expect(reports.loadScheduleDraft()).resolves.toEqual(draft);
  });

  it('keeps delivery server-owned and fails closed for cold other-device attempts', async () => {
    const request = jest.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/reports/summary')) return json(summary());
        if (path.endsWith('/reports') && init?.method === 'POST')
          return json(
            {
              attemptId: '99000000-0000-4000-8000-000000000002',
              status: 'queued',
              ledgerVersion: 7,
              schemaVersion: 1,
              generatedAt
            },
            202
          );
        if (path.includes('/reports?'))
          return json({
            items: [
              {
                id: '99000000-0000-4000-8000-000000000003',
                reportType: 'financial_summary',
                format: 'pdf',
                delivery: 'email',
                status: 'delivered',
                metadata: {},
                requestedAt: generatedAt,
                expiresAt: '2026-09-05T00:00:00.000Z'
              }
            ],
            nextCursor: null
          });
        throw new Error(`unexpected:${path}`);
      }
    );
    const reports = service(request);
    const preview = await reports.previewOutput({
      ...input,
      language: 'en',
      detailLevel: 'summary'
    });
    await expect(
      reports.requestOutput(
        { kind: 'send_now', previewId: preview.previewId },
        'output-key'
      )
    ).resolves.toMatchObject({
      value: {
        id: '99000000-0000-4000-8000-000000000002',
        status: 'scheduled'
      }
    });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toMatchObject({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      delivery: 'email'
    });

    const cold = service(
      jest.fn().mockResolvedValue(
        json({
          items: [
            {
              id: '99000000-0000-4000-8000-000000000003',
              reportType: 'financial_summary',
              format: 'pdf',
              delivery: 'email',
              status: 'delivered',
              metadata: {},
              requestedAt: generatedAt,
              expiresAt: '2026-09-05T00:00:00.000Z'
            }
          ],
          nextCursor: null
        })
      )
    );
    await expect(cold.listAttempts()).resolves.toMatchObject({
      items: [{ status: 'sent', snapshot: null }]
    });
  });
});

it('creates and pauses a live schedule using server fields and optimistic versions', async () => {
  const row = {
    id: '99000000-0000-4000-8000-000000000051',
    version: 1,
    reportType: 'financial_summary',
    frequency: 'monthly',
    timezone: 'Asia/Riyadh',
    nextRunAt: '2026-11-01T05:00:00.000Z',
    deliveryChannel: 'email',
    recipient: 'owner@example.test',
    recipientMasked: 'o***@example.test',
    enabled: true,
    lastRunAt: null,
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
  const request = jest
    .fn()
    .mockResolvedValueOnce(json(row))
    .mockResolvedValueOnce(json({ ...row, version: 2, enabled: false }));
  const reports = service(request);
  const saved = await reports.saveSchedule(
    {
      recipientEmail: row.recipient,
      frequency: 'monthly',
      language: 'en',
      currencyCode: 'SAR',
      deliveryDay: 1,
      timeZone: row.timezone,
      includeAssistantSummary: false,
      detailLevel: 'summary'
    },
    null,
    'schedule-operation'
  );
  expect(saved.value).toMatchObject({
    id: row.id,
    status: 'active',
    version: 1
  });
  expect(JSON.parse(String(request.mock.calls[0][1].body))).toEqual({
    reportType: 'financial_summary',
    frequency: 'monthly',
    timezone: row.timezone,
    deliveryChannel: 'email',
    recipient: row.recipient,
    enabled: true
  });
  await expect(
    reports.setScheduleStatus('paused', 1, 'pause-operation')
  ).resolves.toMatchObject({ value: { status: 'paused', version: 2 } });
  expect(JSON.parse(String(request.mock.calls[1][1].body))).toEqual({
    expectedVersion: 1,
    enabled: false
  });
});

it.each(['status', 'download'] as const)('never bypasses or opens a fresh-auth prompt for an old PDF backend policy: %s', async (kind) => {
  const stepUp = jest.spyOn(recentAuthentication, 'requestRecentAuthentication').mockResolvedValue('must-not-be-requested');
  const request = jest.fn();
  if (kind === 'download') request.mockResolvedValueOnce(json(summary()));
  request.mockResolvedValueOnce(json({ code: 'RECENT_AUTH_REQUIRED' }, 403));
  try {
    const service = createLiveReportsService({ baseUrl: 'https://inert.invalid', token: async () => 'old-token', request });
    const preview = kind === 'download' ? await service.previewOutput({ ...input, language: 'en', detailLevel: 'summary' }) : null;
    const pending = preview ? service.requestOutput({ kind: 'download', previewId: preview.previewId }, 'stable-pdf-operation') : service.getAttempt('00000000-0000-4000-8000-000000000011');
    await expect(pending).rejects.toMatchObject({ code: 'report_pdf_policy_pending' });
    expect(stepUp).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(kind === 'download' ? 2 : 1);
  } finally { stepUp.mockRestore(); }
});

it.each([true, false])(
  'preserves report mutation identity through fresh-auth approval=%s',
  async (approved) => {
    const stepUp = jest
      .spyOn(recentAuthentication, 'requestRecentAuthentication')
      .mockResolvedValue(approved ? 'fresh-token' : null);
    const request = jest
      .fn()
      .mockResolvedValueOnce(json({ code: 'RECENT_AUTH_REQUIRED' }, 403))
      .mockResolvedValueOnce(
        json({
          normalizedEmail: 'owner@example.test',
          status: 'verified',
          verifiedAt: generatedAt
        })
      );
    try {
      const service = createLiveReportsService({
        baseUrl: 'https://inert.invalid',
        token: async () => 'old-token',
        request
      });
      const pending = service.verifyRecipient(
        'owner@example.test',
        'stable-operation'
      );
      if (approved) {
        await expect(pending).resolves.toMatchObject({
          value: { status: 'verified' }
        });
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[1][1]).toMatchObject({
          body: request.mock.calls[0][1].body,
          headers: {
            Authorization: 'Bearer fresh-token',
            'Idempotency-Key': 'stable-operation'
          }
        });
      } else {
        await expect(pending).rejects.toMatchObject({
          code: 'recent_auth_required'
        });
        expect(request).toHaveBeenCalledTimes(1);
      }
    } finally {
      stepUp.mockRestore();
    }
  }
);
