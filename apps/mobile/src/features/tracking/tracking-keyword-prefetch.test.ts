import { QueryClient } from '@tanstack/react-query';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';
import { useAppShellStore } from '@/state/app-shell';
import { beginTrackingAdmission } from '@/state/tracking-admission';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { prefetchTrackingKeywords } from './useAutomaticTracking';

jest.mock('@/services/automatic-tracking-service', () => ({
  automaticTrackingService: { listKeywordRules: jest.fn() }
}));

const owner = 'keyword-prefetch-owner';
const rules = defaultKeywordRules
  .slice(0, 1)
  .map((rule) => ({ ...rule, recentUseCount: 0, lastUsedAt: null }));
const clients: QueryClient[] = [];
function client() {
  const query = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60000, gcTime: Infinity }
    }
  });
  clients.push(query);
  return query;
}
beforeEach(() => {
  clearTrackingIsolation();
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: owner }
  });
  jest
    .mocked(automaticTrackingService.listKeywordRules)
    .mockReset()
    .mockResolvedValue(rules);
});
afterEach(() => {
  clients.splice(0).forEach((query) => query.clear());
});

it('warms the same owner-scoped keyword read used by the screen without another fresh request', async () => {
  const query = client();
  await prefetchTrackingKeywords(query, owner);
  const key = automaticTrackingReadKey(automaticTrackingKeys.keywords(), owner);
  expect(query.getQueryData(key)).toEqual(rules);
  expect(
    await query.fetchQuery({
      queryKey: key,
      queryFn: () => automaticTrackingService.listKeywordRules()
    })
  ).toEqual(rules);
  expect(automaticTrackingService.listKeywordRules).toHaveBeenCalledTimes(1);
});

it('discards a late prefetch when the current owner changes', async () => {
  let finish!: (value: typeof rules) => void;
  let started!: () => void;
  const entry = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest
    .mocked(automaticTrackingService.listKeywordRules)
    .mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
  const query = client();
  const pending = prefetchTrackingKeywords(query, owner);
  await entry;
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: 'other-keyword-owner' }
  });
  finish(rules);
  await pending;
  expect(
    query.getQueryData(
      automaticTrackingReadKey(automaticTrackingKeys.keywords(), owner)
    )
  ).toBeUndefined();
  expect(
    query.getQueryData(
      automaticTrackingReadKey(
        automaticTrackingKeys.keywords(),
        'other-keyword-owner'
      )
    )
  ).toBeUndefined();
});

it.each(['unadmitted', 'former-owner'] as const)(
  'does not start a background read for %s',
  async (reason) => {
    if (reason === 'unadmitted') beginTrackingAdmission();
    else
      useAppShellStore.setState({
        session: { ...authenticatedSession, userId: 'other-keyword-owner' }
      });
    const query = client();
    await prefetchTrackingKeywords(query, owner);
    expect(automaticTrackingService.listKeywordRules).not.toHaveBeenCalled();
    expect(
      query.getQueryData(
        automaticTrackingReadKey(automaticTrackingKeys.keywords(), owner)
      )
    ).toBeUndefined();
  }
);
