import { openDatabase } from '@/storage/database';
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoiceBatches } from '@/features/voice/useVoiceBatches';
import { VoiceBatchStatus } from '@/features/voice/VoiceBatchStatus';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import { changeLocale, translate } from '@/localization/i18n';
import { HomeSummary } from '@/features/home/HomeSummary';
import { renderWithProviders } from '@/test-utils/render';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { useAppShellStore } from '@/state/app-shell';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import {
  loadVoiceBatches,
  saveVoiceBatch
} from '@/storage/voice-batch-journal';
import {
  createVoiceBatchApi,
  VoiceBatchLocalTerminalError,
  type VoiceBatchResult
} from './voice-batch-api-service';

jest.mock('@/storage/database', () => ({ openDatabase: jest.fn() }));
// Wire the real API to its application adapter boundary; no batch behavior is mocked.
jest.mock('@/services/voice-analyzer-service', () => ({
  voiceAnalyzerService: {}
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '11111111-1111-4111-8111-111111111111'
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/platform/voice-recorder-service', () => ({
  voiceRecorderService: {
    getPermission: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    duration: () => 0
  }
}));
jest.mock('@/services/engagement-service', () => ({ notificationService: {} }));
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run(...parameters: (string | number)[]): { changes: number };
      all(): { payload: string }[];
    };
  };
}>('node:sqlite');
const owner = 'fixture-owner';
const audio = {
  uri: 'file://fixture.m4a',
  durationMs: 3000,
  contentType: 'audio/m4a' as const,
  recordedAt: Date.now()
};
let db: InstanceType<typeof DatabaseSync>;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE voice_batch_operations(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL)'
  );
  jest.mocked(openDatabase).mockResolvedValue({
    runAsync: async (sql: string, ...parameters: (string | number)[]) =>
      db.prepare(sql).run(...parameters),
    getAllAsync: async (sql: string) => db.prepare(sql).all()
  } as never);
});
afterEach(() => db.close());

function fixture(
  createResponse: () => Promise<Response>,
  removeAudio = async (_uri: string) => {},
  serverResult?: VoiceBatchResult,
  resolveOwner: () => Promise<string> = async () => owner
) {
  const calls: {
    url: string;
    method?: string;
    body?: BodyInit | null;
    key?: string;
  }[] = [];
  const request = (async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body,
      key: (init?.headers as Record<string, string>)?.['idempotency-key']
    });
    if (url === audio.uri)
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16)
      } as Response;
    if (String(url).includes('/recovery'))
      return { ok: true, json: async () => ({ items: [] }) } as Response;
    if (init?.method === 'POST' && String(url).endsWith('/voice/sessions'))
      return createResponse();
    if (
      init?.method === 'GET' &&
      String(url).endsWith('/batch') &&
      serverResult
    )
      return { ok: true, json: async () => serverResult } as Response;
    throw new Error('Unexpected upload/process/result dispatch');
  }) as typeof fetch;
  const api = createVoiceBatchApi({
    baseUrl: 'https://fixture.test',
    owner: resolveOwner,
    token: async () => 'fixture-token',
    request,
    removeAudio
  });
  return { api, calls };
}
const unavailable = () =>
  Promise.resolve({
    ok: false,
    status: 503,
    json: async () => ({ code: 'VOICE_AUTOMATIC_UNAVAILABLE' })
  } as Response);

it.each(['FORBIDDEN', 'malformed'] as const)(
  'does not label a %s 403 as a canary rejection or recreate its retired capture',
  async (code) => {
    const { api, calls } = fixture(
      async () =>
        ({
          ok: false,
          status: 403,
          json: async () => {
            if (code === 'malformed') throw new SyntaxError('invalid response');
            return { code };
          }
        }) as Response
    );
    const id = await api.queueBatch(audio, 'en', 0);
    await expect(api.runBatch(id)).rejects.toMatchObject({
      code: 'analysis_failed'
    });
    await expect(api.runBatch(id)).rejects.toMatchObject({
      code: 'analysis_failed'
    });
    const row = (await loadVoiceBatches(owner))[0]!;
    expect(row.phase).toBe('failed');
    expect(row.failureCode).toBeUndefined();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(
      calls.some(
        (call) => call.method === 'PUT' || call.url.endsWith('/process')
      )
    ).toBe(false);
  }
);

it.each(['en', 'ar'] as const)(
  'reproduces hosted generic rejection versus precise rejection through the real Home capture flow in %s',
  async (locale) => {
    for (const code of [
      'AI_UNAVAILABLE',
      'VOICE_AUTOMATIC_UNAVAILABLE',
      'VOICE_CANARY_RESTRICTED'
    ]) {
      jest.clearAllMocks();
      db.exec('DELETE FROM voice_batch_operations');
      useVoiceCaptureStore.getState().reset();
      useAppShellStore.setState({
        session: { ...authenticatedSession, userId: owner }
      });
      const { api, calls } = fixture(
        async () =>
          ({
            ok: false,
            status: code === 'VOICE_CANARY_RESTRICTED' ? 403 : 503,
            json: async () => ({ code })
          }) as Response
      );
      Object.assign(voiceAnalyzerService, api, { metadata: { kind: 'live' } });
      changeLocale(locale);
      jest
        .mocked(voiceRecorderService.getPermission)
        .mockResolvedValue('granted');
      const start = jest
        .mocked(voiceRecorderService.start)
        .mockResolvedValue({ id: 'native-a', startedAt: Date.now() });
      jest.mocked(voiceRecorderService.stop).mockResolvedValue(audio);
      const view = renderWithProviders(
        React.createElement(HomeSummary, {
          summary: {
            totalBalanceMinor: 0,
            currencyCode: 'SAR',
            isEstimated: false,
            components: [],
            excludedAccountIds: [],
            periodIncomeMinor: 0,
            periodExpenseMinor: 0,
            activeAccountCount: 0,
            recentTransactions: [],
            reviewCount: 0,
            pendingSyncCount: 0,
            dataState: 'ready'
          }
        })
      );
      try {
        fireEvent.press(screen.getByTestId('home-quick-action-voice'));
        await waitFor(() =>
          expect(useVoiceCaptureStore.getState().state).toBe('recording')
        );
        fireEvent.press(screen.getByTestId('home-inline-voice-recording'));
        await waitFor(() =>
          expect(
            screen.getByText(
              translate(
                code === 'AI_UNAVAILABLE'
                  ? 'voice.state.processing'
                  : code === 'VOICE_CANARY_RESTRICTED'
                    ? 'voice.batch.restricted'
                    : 'voice.batch.failed'
              )
            )
          ).toBeTruthy()
        );
        expect(useVoiceCaptureStore.getState().state).toBe('ready');
        if (code === 'AI_UNAVAILABLE')
          expect(
            screen.getByTestId('home-voice-processing-inline')
          ).toBeTruthy();
        else
          expect(
            screen.queryByTestId('home-voice-processing-inline')
          ).toBeNull();
        expect(screen.queryByTestId('home-voice-review')).toBeNull();
        expect(screen.queryByText(translate('voice.batch.empty'))).toBeNull();
        const row = (await loadVoiceBatches(owner))[0]!;
        expect(row).toMatchObject({
          sessionId: null,
          phase: code === 'AI_UNAVAILABLE' ? 'captured' : 'failed'
        });
        if (code === 'AI_UNAVAILABLE')
          expect(row.audioReference).toBe(audio.uri);
        if (code === 'VOICE_CANARY_RESTRICTED') {
          expect(row.failureCode).toBe('voice_canary_restricted');
          const cold = fixture(unavailable).api;
          await expect(cold.recoverBatches()).resolves.toMatchObject({
            localFailure: true,
            localFailureCode: 'voice_canary_restricted',
            pendingIds: []
          });
        }
        expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
        expect(
          calls.some(
            (call) => call.method === 'PUT' || call.url.endsWith('/process')
          )
        ).toBe(false);
        fireEvent.press(screen.getByTestId('home-quick-action-voice'));
        await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
        expect(useVoiceCaptureStore.getState().state).toBe('recording');
      } finally {
        view.unmount();
        await act(async () => {});
        jest.restoreAllMocks();
      }
    }
  },
  15000
);

it.each(['completed', 'failed', 'cancelled'] as const)(
  'publishes and durably retires a server %s receipt before stuck native deletion',
  async (status) => {
    jest.useFakeTimers();
    const receipt = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      batchId: null,
      status,
      transactionIds: [],
      addedCount: 0,
      ledgerVersion: 0
    };
    const { api } = fixture(
      async () =>
        ({
          ok: true,
          json: async () => ({
            session: { id: receipt.sessionId, version: 1 },
            upload: { path: '/unused' }
          })
        }) as Response,
      () => new Promise<void>(() => {}),
      receipt
    );
    try {
      const id = await api.queueBatch(audio, 'en', -180);
      const outcome = Promise.race([
        api.runBatch(id),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve('blocked by cleanup'), 1)
        )
      ]);
      await jest.advanceTimersByTimeAsync(1);
      expect(await outcome).toEqual(receipt);
      expect((await loadVoiceBatches(owner))[0]).toMatchObject({
        phase: status,
        audioReference: audio.uri,
        createBody: null,
        processBody: null
      });
      api.pauseBatches();
      await jest.advanceTimersByTimeAsync(10000);
    } finally {
      jest.useRealTimers();
    }
  }
);

it('keeps a rejected server-terminal cleanup owned without resurrecting executable journal state', async () => {
  const receipt = {
    sessionId: '22222222-2222-4222-8222-222222222222',
    batchId: null,
    status: 'failed' as const,
    transactionIds: [],
    addedCount: 0,
    ledgerVersion: 0
  };
  const { api } = fixture(
    async () =>
      ({
        ok: true,
        json: async () => ({
          session: { id: receipt.sessionId, version: 1 },
          upload: { path: '/unused' }
        })
      }) as Response,
    async () => {
      throw new Error('native deletion failed');
    },
    receipt
  );
  const id = await api.queueBatch(audio, 'en', -180);
  expect(await api.runBatch(id)).toEqual(receipt);
  expect((await loadVoiceBatches(owner))[0]).toMatchObject({
    phase: 'failed',
    audioReference: audio.uri,
    createBody: null,
    processBody: null
  });
});

it('reports the initial create rejection through the real hook before native cleanup settles', async () => {
  let releaseCleanup!: () => void;
  const cleanup = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  let cleanupCalls = 0;
  const { api, calls } = fixture(unavailable, () => {
    cleanupCalls++;
    return cleanup;
  });
  Object.assign(voiceAnalyzerService, api);
  changeLocale('en');
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  let batches!: ReturnType<typeof useVoiceBatches>;
  function Harness() {
    batches = useVoiceBatches(owner);
    return React.createElement(VoiceBatchStatus, { batches });
  }
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Harness)
    )
  );
  try {
    await act(async () => {});
    const id = await api.queueBatch(audio, 'en', -180);
    act(() => batches.submit(id));
    await waitFor(() => expect(batches.localFailure).toBe(true));
    expect(batches.pendingIds).toEqual([]);
    expect(batches.processing).toBe(false);
    expect(batches.uncertain).toBe(false);
    expect(screen.getByText(translate('voice.batch.failed'))).toBeTruthy();
    expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
    expect(screen.queryByText(translate('voice.action.cancel'))).toBeNull();
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: audio.uri,
      createBody: null,
      processBody: null
    });
    await act(async () => {
      await batches.recover();
    });
    expect(batches.pendingIds).toEqual([]);
    expect(batches.processing).toBe(false);
    expect(cleanupCalls).toBe(1);
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  } finally {
    await act(async () => {
      releaseCleanup();
    });
    await waitFor(async () =>
      expect((await loadVoiceBatches(owner))[0]?.audioReference).toBeNull()
    );
    view.unmount();
    client.clear();
  }
});

it('retires an exact pre-create unavailability response durably and reports local failure', async () => {
  const { api, calls } = fixture(unavailable);
  const id = await api.queueBatch(audio, 'en', -180);
  await expect(api.runBatch(id)).rejects.toMatchObject({ phase: 'failed' });
  await waitFor(async () =>
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      id,
      phase: 'failed',
      sessionId: null,
      audioReference: null,
      createBody: null,
      processBody: null
    })
  );
  expect(await api.recoverBatches()).toEqual({
    results: [],
    uncertain: false,
    pendingIds: [],
    localFailure: true
  });
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
});

it('bounds background deletion, ignores a late completion after pause and retries only cleanup', async () => {
  jest.useFakeTimers();
  try {
    let releaseFirst!: () => void;
    let cleanups = 0;
    const { api, calls } = fixture(unavailable, () => {
      cleanups++;
      return cleanups === 1
        ? new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
        : Promise.resolve();
    });
    const id = await api.queueBatch(audio, 'en', -180);
    await expect(api.runBatch(id)).rejects.toMatchObject({ phase: 'failed' });
    await api.recoverBatches();
    expect(cleanups).toBe(1);
    await jest.advanceTimersByTimeAsync(10000);
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: audio.uri,
      createBody: null,
      processBody: null
    });
    api.pauseBatches();
    releaseFirst();
    await jest.advanceTimersByTimeAsync(0);
    expect((await loadVoiceBatches(owner))[0]?.audioReference).toBe(audio.uri);
    await api.recoverBatches();
    await jest.advanceTimersByTimeAsync(0);
    expect(cleanups).toBe(2);
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: null
    });
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});

it('fences deletion when pause occurs during the asynchronous owner check', async () => {
  let holdOwner = false;
  let resolveOwner: ((value: string) => void) | undefined;
  const remove = jest.fn(async () => {
    holdOwner = true;
  });
  const { api } = fixture(unavailable, remove, undefined, () =>
    holdOwner
      ? new Promise((resolve) => {
          resolveOwner = resolve;
        })
      : Promise.resolve(owner)
  );
  const id = await api.queueBatch(audio, 'en', -180);
  await expect(api.runBatch(id)).rejects.toBeInstanceOf(
    VoiceBatchLocalTerminalError
  );
  await waitFor(() => expect(resolveOwner).toBeDefined());
  api.pauseBatches();
  holdOwner = false;
  resolveOwner!(owner);
  for (let n = 0; n < 30; n++) await Promise.resolve();
  expect(
    (await loadVoiceBatches(owner)).find((value) => value.id === id)
      ?.audioReference
  ).toBe(audio.uri);
});

it('fences native cleanup completion when the owner epoch changes before its timeout', async () => {
  jest.useFakeTimers();
  try {
    let release!: () => void;
    let cleanups = 0;
    const { api } = fixture(unavailable, () => {
      cleanups++;
      return cleanups === 1
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : Promise.resolve();
    });
    const id = await api.queueBatch(audio, 'en', -180);
    await expect(api.runBatch(id)).rejects.toMatchObject({ phase: 'failed' });
    api.pauseBatches();
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: audio.uri
    });
    await expect(api.runBatch(id)).rejects.toMatchObject({ phase: 'failed' });
    await jest.advanceTimersByTimeAsync(0);
    expect(cleanups).toBe(2);
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: null
    });
  } finally {
    jest.useRealTimers();
  }
});

it('keeps pending controls and server receipts available while terminal audio deletion is stuck', async () => {
  jest.useFakeTimers();
  try {
    const { api } = fixture(unavailable);
    const id = await api.queueBatch(audio, 'en', -180);
    const operation = (await loadVoiceBatches(owner))[0]!;
    await saveVoiceBatch(owner, { ...operation, revision: 1, phase: 'failed' });
    const pendingId = '33333333-3333-4333-8333-333333333333';
    await saveVoiceBatch(owner, {
      ...operation,
      id: pendingId,
      recordedAt: Date.now() + 1
    });
    const sessionId = '22222222-2222-4222-8222-222222222222';
    const transactionId = '44444444-4444-4444-8444-444444444444';
    const receipt = {
      sessionId,
      batchId: null,
      status: 'completed',
      transactionIds: [transactionId],
      addedCount: 1,
      ledgerVersion: 1
    };
    const recovery = createVoiceBatchApi({
      baseUrl: 'https://fixture.test',
      owner: async () => owner,
      token: async () => 'fixture-token',
      removeAudio: () => new Promise(() => {}),
      request: (async (url) =>
        String(url).includes('/recovery')
          ? ({
              ok: true,
              json: async () => ({
                items: [{ ...receipt, createdAt: '2026-10-04T12:00:00Z' }]
              })
            } as Response)
          : Promise.reject(new Error('offline'))) as typeof fetch
    });
    let pendingControls: string[] = [];
    const outcome = Promise.race([
      recovery.recoverBatches((ids) => {
        pendingControls = ids;
      }),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('blocked by cleanup'), 1)
      )
    ]);
    await jest.advanceTimersByTimeAsync(1);
    expect(await outcome).toMatchObject({
      results: [receipt],
      pendingIds: [pendingId]
    });
    expect(pendingControls).toEqual([pendingId]);
    expect(
      (await loadVoiceBatches(owner)).find((row) => row.id === id)
    ).toMatchObject({ phase: 'failed', audioReference: audio.uri });
    recovery.pauseBatches();
  } finally {
    jest.useRealTimers();
  }
});

it('persists failure before deleting audio and never resurrects it after cleanup failure', async () => {
  let cleanupFails = true;
  let serviceAvailable = false;
  const { api, calls } = fixture(
    () => {
      if (serviceAvailable) throw new Error('Failed capture was resubmitted');
      return unavailable();
    },
    async () => {
      expect((await loadVoiceBatches(owner))[0]).toMatchObject({
        phase: 'failed',
        createBody: null,
        processBody: null
      });
      if (cleanupFails) throw new Error('native deletion failed');
    }
  );
  const id = await api.queueBatch(audio, 'ar', -180);
  await expect(api.runBatch(id)).rejects.toBeInstanceOf(
    VoiceBatchLocalTerminalError
  );
  expect((await loadVoiceBatches(owner))[0]).toMatchObject({
    phase: 'failed',
    audioReference: audio.uri,
    createBody: null,
    processBody: null
  });
  serviceAvailable = true;
  await expect(api.runBatch(id)).rejects.toMatchObject({ phase: 'failed' });
  expect(await api.recoverBatches()).toMatchObject({
    pendingIds: [],
    uncertain: false,
    localFailure: true
  });
  cleanupFails = false;
  expect(await api.recoverBatches()).toMatchObject({
    pendingIds: [],
    localFailure: true
  });
  await waitFor(async () => {
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'failed',
      audioReference: null
    });
  });
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
});

it.each([
  ['generic 503', 503, { code: 'SERVICE_UNAVAILABLE' }],
  ['ambiguous AI error', 503, { code: 'AI_UNAVAILABLE' }],
  ['invalid body', 503, null],
  ['wrong status', 500, { code: 'VOICE_AUTOMATIC_UNAVAILABLE' }],
  ['unapproved code', 503, { code: 'VOICE_AUTOMATIC_UNAVAILABLE_suffix' }]
])(
  'preserves immutable identity and audio after %s',
  async (_name, status, body) => {
    const { api, calls } = fixture(
      async () => ({ ok: false, status, json: async () => body }) as Response
    );
    const id = await api.queueBatch(audio, 'en', -180);
    await expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
      VoiceBatchLocalTerminalError
    );
    const first = (await loadVoiceBatches(owner))[0];
    await expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
      VoiceBatchLocalTerminalError
    );
    expect((await loadVoiceBatches(owner))[0]).toEqual(first);
    expect(first).toMatchObject({
      id,
      phase: 'captured',
      audioReference: audio.uri,
      sessionId: null
    });
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]).toEqual(posts[0]);
  }
);

it.each(['lost response', 'invalid JSON'])(
  'keeps a possibly accepted create recoverable after %s',
  async (failure) => {
    const { api } = fixture(async () => {
      if (failure === 'lost response') throw new Error('connection lost');
      return {
        ok: false,
        status: 503,
        json: async () => {
          throw new SyntaxError('invalid json');
        }
      } as unknown as Response;
    });
    const id = await api.queueBatch(audio, 'en', -180);
    await expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
      VoiceBatchLocalTerminalError
    );
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'captured',
      audioReference: audio.uri,
      sessionId: null,
      createBody: expect.any(Object)
    });
  }
);

it.each(['generic 503', 'lost response'])(
  'reconciles an accepted create using the same identity after %s',
  async (failure) => {
    const sessionId = '22222222-2222-4222-8222-222222222222';
    const receipt = {
      sessionId,
      batchId: null,
      status: 'completed',
      transactionIds: ['44444444-4444-4444-8444-444444444444'],
      addedCount: 1,
      ledgerVersion: 2
    };
    const creates: { body: unknown; key: string }[] = [];
    const unexpected: string[] = [];
    const api = createVoiceBatchApi({
      baseUrl: 'https://fixture.test',
      owner: async () => owner,
      token: async () => 'fixture-token',
      removeAudio: async () => {},
      request: (async (url, init) => {
        if (url === audio.uri)
          return {
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(16)
          } as Response;
        if (
          init?.method === 'POST' &&
          String(url).endsWith('/voice/sessions')
        ) {
          creates.push({
            body: init.body,
            key: (init.headers as Record<string, string>)['idempotency-key']!
          });
          if (creates.length === 1) {
            if (failure === 'lost response')
              throw new Error('connection lost after commit');
            return {
              ok: false,
              status: 503,
              json: async () => ({ code: 'AI_UNAVAILABLE' })
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({
              session: { id: sessionId, version: 1 },
              upload: { path: '/unused' }
            })
          } as Response;
        }
        if (
          init?.method === 'GET' &&
          String(url).endsWith('/' + sessionId + '/batch')
        )
          return { ok: true, json: async () => receipt } as Response;
        unexpected.push(String(url));
        throw new Error('Unexpected upload/process');
      }) as typeof fetch
    });
    const id = await api.queueBatch(audio, 'en', -180);
    await expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
      VoiceBatchLocalTerminalError
    );
    expect(await api.runBatch(id)).toEqual(receipt);
    expect(creates).toHaveLength(2);
    expect(creates[1]).toEqual(creates[0]);
    expect(unexpected).toEqual([]);
    await waitFor(async () =>
      expect((await loadVoiceBatches(owner))[0]).toMatchObject({
        phase: 'completed',
        sessionId,
        audioReference: null,
        createBody: null,
        processBody: null
      })
    );
  }
);

it('does not treat the same error on process as a definitive pre-create rejection', async () => {
  const { api } = fixture(unavailable);
  const id = await api.queueBatch(audio, 'en', -180);
  const operation = (await loadVoiceBatches(owner))[0]!;
  const sessionId = '22222222-2222-4222-8222-222222222222';
  await saveVoiceBatch(owner, {
    ...operation,
    revision: 1,
    phase: 'uploaded',
    sessionId,
    version: 2,
    createBody: {},
    processBody: { uploadCompleted: true }
  });
  const transport = createVoiceBatchApi({
    baseUrl: 'https://fixture.test',
    owner: async () => owner,
    token: async () => 'fixture-token',
    request: (async (_url, init) =>
      init?.method === 'POST'
        ? unavailable()
        : ({
            ok: true,
            json: async () => ({
              sessionId,
              batchId: null,
              status: 'uploading',
              transactionIds: [],
              addedCount: 0,
              ledgerVersion: 0
            })
          } as Response)) as typeof fetch
  });
  await expect(transport.runBatch(id)).rejects.not.toBeInstanceOf(
    VoiceBatchLocalTerminalError
  );
  expect((await loadVoiceBatches(owner))[0]).toMatchObject({
    phase: 'uploaded',
    sessionId,
    audioReference: audio.uri,
    processBody: { uploadCompleted: true }
  });
});

it('bounds unavailable-body parsing and keeps ownership after a timeout', async () => {
  jest.useFakeTimers();
  try {
    const { api } = fixture(
      async () =>
        ({
          ok: false,
          status: 503,
          json: () => new Promise(() => {})
        }) as Response
    );
    const id = await api.queueBatch(audio, 'en', -180);
    const pending = expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
      VoiceBatchLocalTerminalError
    );
    await jest.advanceTimersByTimeAsync(10001);
    await pending;
    expect((await loadVoiceBatches(owner))[0]).toMatchObject({
      phase: 'captured',
      audioReference: audio.uri
    });
  } finally {
    jest.useRealTimers();
  }
});

it('fences a delayed rejection body after the owner binding is paused', async () => {
  let parsed!: (value: unknown) => void;
  let parsing!: () => void;
  const started = new Promise<void>((resolve) => {
    parsing = resolve;
  });
  const { api } = fixture(
    async () =>
      ({
        ok: false,
        status: 503,
        json: () => {
          parsing();
          return new Promise((resolve) => {
            parsed = resolve;
          });
        }
      }) as Response
  );
  const id = await api.queueBatch(audio, 'en', -180);
  const pending = expect(api.runBatch(id)).rejects.not.toBeInstanceOf(
    VoiceBatchLocalTerminalError
  );
  // Old code does not parse; a bounded microtask race makes this regression fail promptly.
  await Promise.race([started, pending]);
  expect(parsed).toBeDefined();
  api.pauseBatches();
  parsed({ code: 'VOICE_AUTOMATIC_UNAVAILABLE' });
  await pending;
  expect((await loadVoiceBatches(owner))[0]).toMatchObject({
    phase: 'captured',
    audioReference: audio.uri
  });
});
