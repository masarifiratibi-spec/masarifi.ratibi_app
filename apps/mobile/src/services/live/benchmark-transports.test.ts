import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import { createEngagementApi } from './engagement-service';
import { createLiveAutomaticTrackingService } from './automatic-tracking-service';
import { createLiveReportsService } from './reports-service';
import { createLiveAssistantApiService } from './assistant-api-service';
import { createLiveCoreFinanceSync } from './core-finance-service';
import { SyncHttpService } from '../contracts/sync-service';
import { createMemoryAssistantJournal } from '@/storage/assistant-operation-journal';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

const cases = [
  [
    'engagement',
    (options: Options) =>
      createEngagementApi(options).createTicket({}, 'operation')
  ],
  [
    'tracking',
    (options: Options) =>
      createLiveAutomaticTrackingService(options).setMode('paused')
  ],
  [
    'reports',
    (options: Options) =>
      createLiveReportsService(options).verifyRecipient(
        'inert@example.test',
        'operation'
      )
  ],
  [
    'assistant',
    (options: Options) =>
      createLiveAssistantApiService({
        ...options,
        journal: createMemoryAssistantJournal()
      }).createConversation({ question: 'inert question' }, 'operation')
  ],
  [
    'sync mutations',
    (options: Options, device: () => Promise<string>) =>
      new SyncHttpService(
        options.baseUrl,
        options.token,
        device,
        options.request
      ).mutations([], 'operation')
  ],
  [
    'sync acknowledgment',
    (options: Options, device: () => Promise<string>) =>
      new SyncHttpService(
        options.baseUrl,
        options.token,
        device,
        options.request
      ).acknowledge('accounts', 'cursor')
  ],
  [
    'financial sync replay',
    () =>
      createLiveCoreFinanceSync({
        identity: jest.fn(async () => {
          throw new Error('unexpected identity');
        })
      }).synchronize()
  ]
] as const;
type Options = {
  baseUrl: string;
  token: () => Promise<string>;
  request: typeof fetch;
};
test.each(cases)(
  '%s rejects benchmark writes before tokens, device lookup or network',
  async (_name, execute) => {
    const restoreEnvironment = installBenchmarkEnvironment();
    const token = jest.fn(async () => 'inert-token');
    const request = jest.fn(async () => {
      throw new Error('unexpected transport');
    });
    const device = jest.fn(async () => 'inert-device');
    const options = { baseUrl: 'https://inert.invalid', token, request };
    try {
      await expect(execute(options, device)).rejects.toThrow(
        'benchmark_read_only'
      );
      expect(token).not.toHaveBeenCalled();
      expect(device).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    } finally {
      restoreEnvironment();
    }
  }
);
