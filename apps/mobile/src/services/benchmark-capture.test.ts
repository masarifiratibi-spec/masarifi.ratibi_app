import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import * as TaskManager from 'expo-task-manager';
import { syncAutomaticTracking } from './automatic-tracking-coordinator';
import { recordMobileForeground } from './live/mobile-activity';
import { ensureLivePushDeviceRegistration } from './live/engagement-service';
import { createLiveVoiceApiService } from './live/voice-api-service';
import { createVoiceBatchApi } from './live/voice-batch-api-service';
import { createMemoryAssistantJournal } from '@/storage/assistant-operation-journal';
import { createLiveAssistantApiService } from './live/assistant-api-service';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
test('benchmark push tasks, tracking, device activity and voice recovery stay dormant', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  try {
    const phone = { getPermission: jest.fn() };
    const request = jest.fn();
    const owner = jest.fn(async () => 'inert-owner');
    const token = jest.fn(async () => 'inert-token');
    const journal = createMemoryAssistantJournal();
    // Provider registration must be tested after installing the bundled environment.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('./tracking-push-task');
    expect(TaskManager.defineTask).not.toHaveBeenCalled();
    await recordMobileForeground('android');
    await expect(
      ensureLivePushDeviceRegistration({ phone: phone as never })
    ).resolves.toBe('unavailable');
    await expect(syncAutomaticTracking()).resolves.toMatchObject({
      status: 'idle'
    });
    await expect(
      createLiveVoiceApiService({ owner, token, request }).recoverPending!()
    ).rejects.toThrow('benchmark_read_only');
    await expect(
      createVoiceBatchApi({
        baseUrl: 'https://inert.invalid',
        owner,
        token,
        request
      }).recoverBatches()
    ).rejects.toThrow('benchmark_read_only');
    await expect(
      createLiveAssistantApiService({
        baseUrl: 'https://inert.invalid',
        token,
        request,
        journal
      }).createConversation({ question: 'inert' }, 'op')
    ).rejects.toThrow('benchmark_read_only');
    expect(await journal.read('inert-adapter-owner', 'question')).toBeNull();
    expect(phone.getPermission).not.toHaveBeenCalled();
    expect(owner).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  } finally {
    restoreEnvironment();
  }
});
