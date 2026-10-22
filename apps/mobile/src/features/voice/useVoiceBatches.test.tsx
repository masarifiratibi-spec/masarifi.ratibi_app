import React from 'react';
import { AppState } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import type {
  VoiceBatchApi,
  VoiceBatchResult
} from '@/services/live/voice-batch-api-service';
import {
  changeLocale,
  currentLocale,
  translate,
  translateDynamic
} from '@/localization/i18n';
import { VoiceBatchStatus } from './VoiceBatchStatus';
import { useVoiceBatches } from './useVoiceBatches';
import { voiceAnalysisKey } from './voice-analysis-query';
import { VoiceCaptureError } from '@/services/contracts/voice-capture-service';

jest.mock('@/services/voice-analyzer-service', () => ({
  voiceAnalyzerService: {}
}));

const capture = '11111111-1111-4111-8111-111111111111';
const session = '22222222-2222-4222-8222-222222222222';
const receipt = (status: VoiceBatchResult['status']): VoiceBatchResult => ({
  sessionId: session,
  batchId: null,
  status,
  addedCount: 0,
  transactionIds: [],
  ledgerVersion: 0
});
const empty = {
  results: [],
  pendingIds: [],
  uncertain: false,
  localFailure: false
};

function statusFixture(
  latest: VoiceBatchResult
): ReturnType<typeof useVoiceBatches> {
  return {
    ...empty,
    latest,
    submit: jest.fn(),
    recover: async () => undefined,
    cancel: async () => undefined,
    cancelIds: [],
    localFailureCode: undefined,
    rateLimited: false,
    processing: false
  };
}

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  let batches!: ReturnType<typeof useVoiceBatches>;
  let owner = 'fixture-owner';
  function Harness() {
    batches = useVoiceBatches(owner);
    return <VoiceBatchStatus batches={batches} />;
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
  return {
    client,
    get batches() {
      return batches;
    },
    setOwner(next: string) {
      owner = next;
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    },
    unmount() {
      view.unmount();
      client.clear();
    }
  };
}

it.each(['ar', 'en'] as const)(
  'explains a quota pause in %s, retains the capture, and clears it after recovery',
  async (locale) => {
    const previousLocale = currentLocale();
    changeLocale(locale);
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => empty,
      runBatch: jest
        .fn()
        .mockRejectedValue(new VoiceCaptureError('quota_exceeded')),
      pauseBatches: () => undefined
    });
    const view = mount();
    try {
      await act(async () => {});
      await act(async () => view.batches.submit(capture));
      expect(view.batches.pendingIds).toEqual([capture]);
      expect(view.batches.processing).toBe(false);
      const message =
        locale === 'ar'
          ? 'التحليل الصوتي متوقف مؤقتًا بسبب حد الاستخدام. تسجيلك محفوظ وستتم إعادة المحاولة تلقائيًا. لا تُعد تسجيله.'
          : 'Voice analysis is paused by a usage limit. Your recording is saved and will retry automatically. Do not record it again.';
      expect(screen.getByText(message)).toBeTruthy();
      expect(
        screen.queryByText(translate('voice.state.processing'))
      ).toBeNull();
      Object.assign(voiceAnalyzerService, {
        recoverBatches: async () => ({
          ...empty,
          results: [receipt('completed')],
          localSessions: { [capture]: session }
        })
      });
      await act(async () => view.batches.recover());
      expect(view.batches.pendingIds).toEqual([]);
      expect(screen.queryByText(message)).toBeNull();
    } finally {
      view.unmount();
      changeLocale(previousLocale);
    }
  }
);

it('shows a recovered quota pause and removes it when changing owner', async () => {
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => ({
      ...empty,
      pendingIds: [capture],
      rateLimitedIds: [capture],
      results: [receipt('uploading')],
      localSessions: { [capture]: session }
    }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    expect(screen.getByTestId('voice-batch-status')).toBeTruthy();
    expect(view.batches.processing).toBe(false);
    Object.assign(voiceAnalyzerService, { recoverBatches: async () => empty });
    await act(async () => view.setOwner('other-owner'));
    expect(screen.queryByTestId('voice-batch-status')).toBeNull();
    expect(view.batches.pendingIds).toEqual([]);
  } finally {
    view.unmount();
  }
});

it('keeps another fresh recording in progress while one capture is quota-paused', async () => {
  const otherCapture = '66666666-6666-4666-8666-666666666666';
  let finish!: (result: VoiceBatchResult) => void;
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => empty,
    runBatch: (id: string) =>
      id === capture
        ? Promise.reject(new VoiceCaptureError('quota_exceeded'))
        : new Promise<VoiceBatchResult>((resolve) => {
            finish = resolve;
          }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    await act(async () => view.batches.submit(capture));
    act(() => view.batches.submit(otherCapture));
    expect(view.batches.processing).toBe(true);
    expect(screen.getByText(translate('voice.state.processing'))).toBeTruthy();
    await act(async () => finish(receipt('completed')));
    expect(view.batches.processing).toBe(false);
    expect(view.batches.pendingIds).toEqual([capture]);
  } finally {
    view.unmount();
  }
});

it.each(['ar', 'en'] as const)(
  'keeps an old queued receipt recoverable without showing current analysis in %s',
  async (locale) => {
    const previousLocale = currentLocale();
    changeLocale(locale);
    const oldCapture = '66666666-6666-4666-8666-666666666666';
    const oldSession = '77777777-7777-4777-8777-777777777777';
    const queued = { ...receipt('queued'), sessionId: oldSession };
    const completed = {
      ...receipt('completed'),
      addedCount: 1,
      transactionIds: [capture],
      ledgerVersion: 10
    };
    const recover = jest.fn(async () => ({
      ...empty,
      results: [queued, completed],
      pendingIds: [oldCapture],
      localSessions: { [oldCapture]: oldSession }
    }));
    const runBatch = jest.fn(async () => receipt('completed'));
    Object.assign(voiceAnalyzerService, {
      recoverBatches: recover,
      runBatch,
      pauseBatches: () => undefined
    });
    const view = mount();
    try {
      await waitFor(() => expect(view.batches.latest).toEqual(completed));
      expect(view.batches.results).toContainEqual(queued);
      expect(view.batches.pendingIds).toEqual([oldCapture]);
      expect(view.batches.processing).toBe(false);
      expect(
        screen.queryByText(translate('voice.state.processing'))
      ).toBeNull();
      await act(async () => view.batches.recover());
      expect(recover).toHaveBeenCalledTimes(2);
      expect(view.batches.pendingIds).toEqual([oldCapture]);
      expect(runBatch).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      changeLocale(previousLocale);
    }
  }
);

it('shows a new capture until its receipt settles while preserving an older pending capture', async () => {
  const oldCapture = '66666666-6666-4666-8666-666666666666';
  const oldSession = '77777777-7777-4777-8777-777777777777';
  const queued = { ...receipt('queued'), sessionId: oldSession };
  let finish!: (result: VoiceBatchResult) => void;
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => ({
      ...empty,
      results: [queued],
      pendingIds: [oldCapture],
      localSessions: { [oldCapture]: oldSession }
    }),
    runBatch: () =>
      new Promise<VoiceBatchResult>((resolve) => {
        finish = resolve;
      }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await waitFor(() => expect(view.batches.results).toContainEqual(queued));
    act(() => view.batches.submit(capture));
    expect(view.batches.processing).toBe(true);
    expect(screen.getByText(translate('voice.state.processing'))).toBeTruthy();
    await act(async () => finish(receipt('queued')));
    expect(view.batches.processing).toBe(true);
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => ({
        ...empty,
        results: [queued, receipt('completed')],
        pendingIds: [oldCapture],
        localSessions: { [oldCapture]: oldSession, [capture]: session }
      })
    });
    await act(async () => view.batches.recover());
    expect(view.batches.pendingIds).toEqual([oldCapture]);
    expect(view.batches.results).toContainEqual(queued);
    expect(view.batches.processing).toBe(false);
    expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
  } finally {
    view.unmount();
  }
});

it('drops former-owner foreground progress and ignores its late receipt after an owner change', async () => {
  const otherCapture = '66666666-6666-4666-8666-666666666666';
  const otherSession = '77777777-7777-4777-8777-777777777777';
  const otherQueued = { ...receipt('queued'), sessionId: otherSession };
  let finish!: (result: VoiceBatchResult) => void;
  Object.assign(voiceAnalyzerService, {
    recoverBatches: jest
      .fn()
      .mockResolvedValueOnce(empty)
      .mockResolvedValue({
        ...empty,
        results: [otherQueued],
        pendingIds: [otherCapture],
        localSessions: { [otherCapture]: otherSession }
      }),
    runBatch: () =>
      new Promise<VoiceBatchResult>((resolve) => {
        finish = resolve;
      }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    act(() => view.batches.submit(capture));
    expect(view.batches.processing).toBe(true);
    await act(async () => view.setOwner('other-owner'));
    expect(view.batches.pendingIds).toEqual([otherCapture]);
    expect(view.batches.processing).toBe(false);
    await act(async () => finish(receipt('completed')));
    expect(view.batches.results).toEqual([otherQueued]);
    expect(view.batches.pendingIds).toEqual([otherCapture]);
    expect(view.batches.processing).toBe(false);
    expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
  } finally {
    view.unmount();
  }
});

it('continues polling old pending work silently after reopening the runtime', async () => {
  jest.useFakeTimers();
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  const recover = jest.fn(async () => ({
    ...empty,
    results: [receipt('queued')],
    pendingIds: [capture],
    localSessions: { [capture]: session }
  }));
  Object.assign(voiceAnalyzerService, {
    recoverBatches: recover,
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    expect(view.batches.processing).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(recover).toHaveBeenCalledTimes(2);
    expect(view.batches.pendingIds).toEqual([capture]);
    expect(view.batches.results).toEqual([receipt('queued')]);
    expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
  } finally {
    view.unmount();
    AppState.currentState = previousState;
    jest.useRealTimers();
  }
});

it('keeps an uncertain new capture visible until its authoritative receipt arrives', async () => {
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => empty,
    runBatch: jest.fn().mockRejectedValue(new Error('response lost')),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    await act(async () => view.batches.submit(capture));
    expect(view.batches.uncertain).toBe(true);
    expect(view.batches.processing).toBe(true);
    expect(screen.getByText(translate('voice.state.processing'))).toBeTruthy();
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => ({
        ...empty,
        results: [receipt('completed')],
        localSessions: { [capture]: session }
      })
    });
    await act(async () => view.batches.recover());
    expect(view.batches.processing).toBe(false);
    expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
  } finally {
    view.unmount();
  }
});

it.each(['ar', 'en'] as const)(
  'does not show recording analysis while refreshing completed historical finance in %s',
  async (locale) => {
    const previousLocale = currentLocale();
    changeLocale(locale);
    const completed = {
      ...receipt('completed'),
      addedCount: 1,
      transactionIds: [capture],
      ledgerVersion: 9
    };
    Object.assign(voiceAnalyzerService, {
      recoverBatches: jest
        .fn()
        .mockResolvedValueOnce(empty)
        .mockResolvedValue({ ...empty, results: [completed] }),
      pauseBatches: () => undefined
    });
    const view = mount();
    let finishRefresh!: () => void;
    const financeRead = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    try {
      await act(async () => {});
      jest
        .spyOn(view.client, 'invalidateQueries')
        .mockImplementation(() => financeRead);
      await act(async () => {
        await view.batches.recover();
      });
      expect(view.batches.latest).toEqual(completed);
      expect(view.batches.processing).toBe(false);
      expect(view.batches.uncertain).toBe(false);
      expect(
        screen.queryByText(translate('voice.state.processing'))
      ).toBeNull();
      await act(async () => {
        finishRefresh();
        await financeRead;
      });
      expect(view.batches.latest?.transactionIds).toEqual([capture]);
    } finally {
      finishRefresh();
      view.unmount();
      changeLocale(previousLocale);
    }
  }
);

it('keeps the authoritative receipt without announcing a saved count', async () => {
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => empty,
    runBatch: async () => ({
      ...receipt('completed'),
      addedCount: 2,
      transactionIds: [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444'
      ],
      ledgerVersion: 2
    }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    await act(async () => view.batches.submit(capture));
    expect(
      screen.queryByText(translateDynamic('voice.batch.saved', { count: 2 }))
    ).toBeNull();
    expect(view.batches.latest?.addedCount).toBe(2);
    expect(view.batches.latest?.transactionIds).toHaveLength(2);
    expect(screen.queryByText(translate('voice.batch.empty'))).toBeNull();
  } finally {
    view.unmount();
  }
});

it.each([
  { addedCount: 2, transactionIds: [capture, capture], ledgerVersion: 2 },
  {
    addedCount: 2,
    transactionIds: [capture, session, capture],
    ledgerVersion: 2
  },
  { addedCount: 1, transactionIds: [capture], ledgerVersion: 0 },
  {
    addedCount: 1,
    transactionIds: [capture],
    ledgerVersion: 1,
    analysis: {
      mode: 'analysis_only',
      persisted: false,
      events: [],
      expiresAt: new Date(Date.now() + 60000).toISOString()
    }
  }
])(
  'does not claim financial saving from an incomplete or analysis-only receipt %#',
  (fields) => {
    const latest = { ...receipt('completed'), ...fields } as VoiceBatchResult;
    render(<VoiceBatchStatus batches={statusFixture(latest)} />);
    expect(
      screen.queryByText(
        translateDynamic('voice.batch.saved', { count: latest.addedCount })
      )
    ).toBeNull();
  }
);

it('keeps a partial failure visible with its authoritative saved count', () => {
  const latest = {
    ...receipt('failed'),
    addedCount: 1,
    transactionIds: [capture],
    ledgerVersion: 1
  };
  render(<VoiceBatchStatus batches={statusFixture(latest)} />);
  expect(
    screen.queryByText(translateDynamic('voice.batch.saved', { count: 1 }))
  ).toBeNull();
  expect(
    screen.getByText(
      translateDynamic('voice.batch.partialUnknown', { count: 1 })
    )
  ).toBeTruthy();
});

it.each(['ar', 'en'] as const)(
  'does not flash historical saving messages when restoring receipts in %s',
  async (locale) => {
    const previousLocale = currentLocale();
    changeLocale(locale);
    const completed: VoiceBatchResult = {
      ...receipt('completed'),
      addedCount: 1,
      transactionIds: [capture],
      ledgerVersion: 8,
      outcomes: [
        {
          ordinal: 0,
          kind: 'expense',
          status: 'committed',
          reason: null,
          transactionId: capture
        }
      ]
    };
    const runBatch = jest.fn();
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => ({ ...empty, results: [completed] }),
      runBatch,
      pauseBatches: () => undefined
    });
    const view = mount();
    try {
      await waitFor(() => expect(view.batches.latest).toEqual(completed));
      expect(
        screen.queryByText(translateDynamic('voice.batch.saved', { count: 1 }))
      ).toBeNull();
      expect(
        screen.queryByText(
          translateDynamic('voice.batch.event.result', {
            number: 1,
            result: translateDynamic('voice.batch.event.committed')
          })
        )
      ).toBeNull();
      expect(runBatch).not.toHaveBeenCalled();
      expect(view.batches.latest?.transactionIds).toEqual([capture]);
    } finally {
      view.unmount();
      changeLocale(previousLocale);
    }
  }
);

it('summarizes skipped and committed movements without internal event widgets', () => {
  const latest: VoiceBatchResult = {
    ...receipt('completed'),
    addedCount: 1,
    transactionIds: [capture],
    ledgerVersion: 1,
    outcomes: [
      {
        ordinal: 0,
        kind: 'expense',
        status: 'committed',
        reason: null,
        transactionId: capture
      },
      {
        ordinal: 1,
        kind: 'income',
        status: 'skipped',
        reason: 'invalid_category',
        transactionId: null
      }
    ]
  };
  render(<VoiceBatchStatus batches={statusFixture(latest)} />);
  expect(
    screen.queryByText(
      translateDynamic('voice.batch.event.result', {
        number: 1,
        result: translateDynamic('voice.batch.event.committed')
      })
    )
  ).toBeNull();
  expect(
    screen.getByText(
      translateDynamic('voice.batch.partial', { saved: 1, failed: 1 })
    )
  ).toBeTruthy();
});

it('scrubs expired analysis fields from hook state and shared cache', async () => {
  jest.useFakeTimers();
  const expiresAt = new Date(Date.now() + 1000).toISOString();
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => ({
      results: [
        {
          ...receipt('completed'),
          analysis: {
            mode: 'analysis_only',
            persisted: false,
            expiresAt,
            events: [
              {
                ordinal: 0,
                kind: 'expense',
                amountMinor: 2500,
                currency: 'SAR',
                accountId: capture,
                categoryId: null,
                title: 'Private breakfast',
                merchant: null,
                occurredAt: new Date().toISOString()
              }
            ]
          }
        }
      ],
      pendingIds: [],
      uncertain: false,
      localFailure: false
    }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.batches.latest?.analysis?.events).toHaveLength(1);
    await act(async () => {
      jest.advanceTimersByTime(1001);
    });
    expect(view.batches.latest?.analysis?.events).toEqual([]);
    expect(
      view.client.getQueryData<
        import('@/services/live/voice-batch-api-service').VoiceBatchResult[]
      >(voiceAnalysisKey('fixture-owner'))?.[0]?.analysis?.events
    ).toEqual([]);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('ignores an older recovery snapshot arriving after a terminal submit receipt', async () => {
  let finishRecovery!: (
    value: Awaited<ReturnType<VoiceBatchApi['recoverBatches']>>
  ) => void;
  let finishRun!: (value: VoiceBatchResult) => void;
  const recover = jest
    .fn()
    .mockResolvedValueOnce(empty)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRecovery = resolve;
        })
    );
  Object.assign(voiceAnalyzerService, {
    recoverBatches: recover,
    runBatch: () =>
      new Promise<VoiceBatchResult>((resolve) => {
        finishRun = resolve;
      }),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await act(async () => {});
    act(() => view.batches.submit(capture));
    let recovering!: Promise<void>;
    act(() => {
      recovering = view.batches.recover();
    });
    await act(async () => finishRun(receipt('completed')));
    expect(view.batches.latest?.status).toBe('completed');
    await act(async () => {
      finishRecovery({
        results: [receipt('analyzing')],
        pendingIds: [capture],
        uncertain: false,
        localFailure: false
      });
      await recovering;
    });
    expect(view.batches.latest?.status).toBe('completed');
    expect(view.batches.processing).toBe(false);
    expect(view.batches.pendingIds).toEqual([]);
    expect(screen.queryByText(translate('voice.action.cancel'))).toBeNull();
  } finally {
    view.unmount();
  }
});

it('clears both cancellation aliases without exposing a manual cancellation control', async () => {
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => ({
      results: [receipt('analyzing')],
      pendingIds: [capture],
      uncertain: false,
      localFailure: false,
      localSessions: { [capture]: session }
    }),
    cancelBatch: jest.fn(async () => receipt('cancelled')),
    pauseBatches: () => undefined
  });
  const view = mount();
  try {
    await waitFor(() => expect(view.batches.results).toHaveLength(1));
    expect(
      screen.queryByLabelText(translate('voice.action.cancel'))
    ).toBeNull();
    await act(async () => view.batches.cancel(capture));
    await waitFor(() => expect(view.batches.latest?.status).toBe('cancelled'));
    expect(view.batches.pendingIds).toEqual([]);
    await act(async () => view.batches.recover());
    expect(view.batches.latest?.status).toBe('cancelled');
    expect(view.batches.pendingIds).toEqual([]);
  } finally {
    view.unmount();
  }
});
