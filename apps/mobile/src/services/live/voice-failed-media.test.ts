import { createVoiceBatchApi } from './voice-batch-api-service';
import {
  loadVoiceBatches,
  saveVoiceBatch,
  type VoiceBatchOperation
} from '@/storage/voice-batch-journal';
import { waitFor } from '@testing-library/react-native';

jest.mock('@/storage/voice-batch-journal', () => ({
  loadVoiceBatches: jest.fn(),
  saveVoiceBatch: jest.fn(),
  pruneVoiceBatches: jest.fn()
}));

it.each([false, true, 'deadline'] as const)(
  'retains failed audio until its original deadline, expired=%s',
  async (timing) => {
    const expired = timing === true;
    if (timing === 'deadline') jest.useFakeTimers();
    let operation: VoiceBatchOperation = {
      id: '11111111-1111-4111-8111-111111111111',
      revision: 3,
      phase: 'processing',
      audioReference: 'file://failed.m4a',
      locale: 'ar',
      durationMs: 1000,
      recordedAt: Date.now() - (expired ? 86400001 : 1000),
      timezoneOffsetMinutes: -180,
      sessionId: '22222222-2222-4222-8222-222222222222',
      version: 1,
      createBody: null,
      processBody: { uploadCompleted: true }
    };
    jest.mocked(loadVoiceBatches).mockImplementation(async () => [operation]);
    jest.mocked(saveVoiceBatch).mockImplementation(async (_owner, value) => {
      operation = value;
    });
    const removeAudio = jest.fn().mockResolvedValue(undefined);
    const receipt = {
      sessionId: operation.sessionId,
      batchId: null,
      status: 'failed',
      transactionIds: [],
      addedCount: 0,
      ledgerVersion: 0
    };
    const request = jest.fn(
      async (url: string | URL | Request) =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            String(url).includes('/recovery') ? { items: [] } : receipt
        }) as Response
    );
    const api = createVoiceBatchApi({
      baseUrl: 'https://example.test',
      owner: async () => 'owner',
      token: async () => 'token',
      request: request as typeof fetch,
      removeAudio
    });
    expect((await api.runBatch(operation.id)).status).toBe('failed');
    await api.recoverBatches();
    if (timing === 'deadline') await jest.advanceTimersByTimeAsync(86400001);
    if (expired || timing === 'deadline')
      await waitFor(() => expect(operation.audioReference).toBeNull());
    else {
      expect(removeAudio).not.toHaveBeenCalled();
      expect(operation.audioReference).toBe('file://failed.m4a');
    }
    expect(
      request.mock.calls.every(([url]) => /batch|recovery/.test(String(url)))
    ).toBe(true);
    api.pauseBatches();
    if (timing === 'deadline') jest.useRealTimers();
  }
);

it.each([false, true])(
  'delivers cancellation of failed audio durably, uploaded=%s',
  async (uploaded) => {
    let operation: VoiceBatchOperation = {
      id: '11111111-1111-4111-8111-111111111111',
      revision: 3,
      phase: 'failed',
      audioReference: 'file://failed.m4a',
      locale: 'ar',
      durationMs: 1000,
      recordedAt: Date.now(),
      timezoneOffsetMinutes: -180,
      sessionId: uploaded ? '22222222-2222-4222-8222-222222222222' : null,
      version: 1,
      createBody: null,
      processBody: null
    };
    jest.mocked(loadVoiceBatches).mockImplementation(async () => [operation]);
    jest.mocked(saveVoiceBatch).mockImplementation(async (_owner, value) => {
      operation = value;
    });
    const removeAudio = jest.fn().mockResolvedValue(undefined);
    const cancellationKeys: unknown[] = [];
    const request = jest.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).endsWith('/cancel')) {
          cancellationKeys.push(
            new Headers(init?.headers).get('idempotency-key')
          );
          // The server applied cancellation, but the first response was lost.
          if (cancellationKeys.length === 1) throw new TypeError('offline');
        }
        return {
          ok: true,
          status: 200,
          json: async () =>
            String(url).includes('/recovery')
              ? { items: [] }
              : {
                  sessionId: operation.sessionId,
                  batchId: null,
                  status: 'cancelled',
                  transactionIds: [],
                  addedCount: 0,
                  ledgerVersion: 0
                }
        } as Response;
      }
    );
    const api = createVoiceBatchApi({
      baseUrl: 'https://example.test',
      owner: async () => 'owner',
      token: async () => 'token',
      request: request as typeof fetch,
      removeAudio
    });
    if (uploaded) {
      await expect(api.cancelBatch(operation.id)).rejects.toThrow();
      expect(operation.phase).toBe('cancel_requested');
      expect(removeAudio).not.toHaveBeenCalled();
      api.pauseBatches();
      await api.recoverBatches();
      expect(cancellationKeys).toEqual([
        'voice-cancel:' + operation.id,
        'voice-cancel:' + operation.id
      ]);
      expect(
        request.mock.calls.every(([url]) => /cancel|recovery/.test(String(url)))
      ).toBe(true);
    } else {
      expect(await api.cancelBatch(operation.id)).toBeNull();
      expect(request).not.toHaveBeenCalled();
    }
    await waitFor(() => expect(operation.phase).toBe('cancelled'));
    await waitFor(() => expect(operation.audioReference).toBeNull());
    expect(removeAudio).toHaveBeenCalledTimes(1);
    api.pauseBatches();
  }
);
