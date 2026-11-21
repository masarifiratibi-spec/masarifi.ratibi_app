import { createVoiceBatchApi } from './voice-batch-api-service';
import {
  loadVoiceBatches,
  saveVoiceBatch
} from '@/storage/voice-batch-journal';
import { waitFor } from '@testing-library/react-native';

jest.mock('@/storage/voice-batch-journal', () => ({
  loadVoiceBatches: jest.fn(),
  saveVoiceBatch: jest.fn(),
  pruneVoiceBatches: jest.fn()
}));

it('lets the running capture own status polling while recovery discovers other work', async () => {
  const session = '22222222-2222-4222-8222-222222222222';
  const operation = {
    id: '11111111-1111-4111-8111-111111111111',
    revision: 3,
    phase: 'processing' as const,
    audioReference: null,
    locale: 'en' as const,
    durationMs: 1000,
    recordedAt: Date.now(),
    timezoneOffsetMinutes: 0,
    createBody: null,
    processBody: null,
    sessionId: session,
    version: 1
  };
  jest.mocked(loadVoiceBatches).mockResolvedValue([operation]);
  jest.mocked(saveVoiceBatch).mockResolvedValue(undefined);
  let resume!: () => void;
  const waiting = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const receipt = (status: string) => ({
    sessionId: session,
    batchId: null,
    status,
    addedCount: 0,
    transactionIds: [],
    ledgerVersion: 0
  });
  let complete = false,
    discoveries = 0;
  const request = jest.fn(
    async (url: string | URL | Request) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes('/recovery')
            ? {
                items:
                  discoveries++ === 0
                    ? [
                        {
                          ...receipt('analyzing'),
                          createdAt: '2026-10-18T00:00:00Z'
                        }
                      ]
                    : []
              }
            : receipt(complete ? 'completed' : 'analyzing')
      }) as Response
  );
  const api = createVoiceBatchApi({
    baseUrl: 'https://example.test',
    owner: async () => 'owner',
    token: async () => 'token',
    request: request as typeof fetch,
    sleep: () => waiting
  });
  const running = api.runBatch(operation.id);
  await waitFor(() =>
    expect(request.mock.calls.length).toBeGreaterThanOrEqual(2)
  );
  await api.recoverBatches();
  const before = request.mock.calls.filter(([url]) =>
    String(url).endsWith('/batch')
  ).length;
  await api.recoverBatches();
  expect(
    request.mock.calls.filter(([url]) => String(url).endsWith('/batch'))
  ).toHaveLength(before);
  complete = true;
  resume();
  expect((await running).status).toBe('completed');
});
