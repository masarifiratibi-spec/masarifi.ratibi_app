import React from 'react';
import { AppState, Modal, Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQuery
} from '@tanstack/react-query';
import { NetworkConnectionNotice } from './NetworkConnectionNotice';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { LiveIdentityStatusContext } from '@/services/live/clerk-context';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { StartupLoadingBoundary } from '@/design-system/components/feedback/StartupLoadingBoundary';
import {
  synchronizeLiveCoreFinance,
  hasPendingLiveCoreFinanceMutations
} from '@/services/live/core-finance-service';

jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: true, isOnline: jest.fn() }
}));
jest.mock('@/services/live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: jest.fn(),
  hasPendingLiveCoreFinanceMutations: jest.fn()
}));
const probe = jest.mocked(readRecoveryNetwork.isOnline);
const synchronizeReceipts = jest.mocked(synchronizeLiveCoreFinance);
const pendingReceipts = jest.mocked(hasPendingLiveCoreFinanceMutations);
let changeState: (state: 'active' | 'background') => void;
let client: QueryClient;
const retryIdentity = jest.fn();

async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}
async function poll() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });
}
function mount(
  children?: React.ReactNode,
  status: 'ready' | 'unavailable' = 'ready'
) {
  return render(
    <LiveIdentityStatusContext.Provider
      value={{ status, retry: retryIdentity }}
    >
      <QueryClientProvider client={client}>
        <StartupLoadingBoundary>{children}</StartupLoadingBoundary>
        <NetworkConnectionNotice />
      </QueryClientProvider>
    </LiveIdentityStatusContext.Provider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  useAppShellStore.setState({
    profileSetupStatus: 'complete',
    bootstrapRevision: 0
  });
  retryIdentity.mockClear();
  synchronizeReceipts.mockReset().mockResolvedValue(undefined);
  pendingReceipts.mockReset().mockResolvedValue(false);
  probe.mockReset().mockResolvedValue(false);
  readRecoveryNetwork.available = true;
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active'
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      changeState = handler;
      return { remove: jest.fn() };
    });
});

it('automatically observes application after the first four-submission invocation ends before a worker tick', async () => {
  let applied = false;
  pendingReceipts.mockImplementation(async () => !applied);
  synchronizeReceipts
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 7000));
    })
    .mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      applied = true;
    });
  function Transactions() {
    const query = useQuery({
      queryKey: ['core-finance', 'transactions'],
      queryFn: async () => (applied ? 'Applied row' : 'Pending row')
    });
    return <Text>{query.data}</Text>;
  }
  render(
    <LiveIdentityStatusContext.Provider
      value={{ status: 'ready', retry: retryIdentity }}
    >
      <QueryClientProvider client={client}>
        <Transactions />
        <NetworkConnectionNotice />
      </QueryClientProvider>
    </LiveIdentityStatusContext.Provider>
  );
  await settle();
  expect(screen.getByText('Pending row')).toBeTruthy();
  probe.mockResolvedValue(true);
  await poll();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(12000);
  });
  expect(synchronizeReceipts).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Applied row')).toBeTruthy();
  await poll();
  expect(synchronizeReceipts).toHaveBeenCalledTimes(2);
});

it.each(['background', 'owner change', 'unmount'] as const)(
  'does not admit a new receipt invocation after %s during its final network probe',
  async (boundary) => {
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'owner-A',
        method: 'google',
        issuedAt: 1,
        expiresAt: 9999999999999,
        restoration: 'restored'
      }
    });
    pendingReceipts.mockResolvedValue(true);
    let finishProbe!: (online: boolean) => void;
    probe
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishProbe = resolve;
          })
      )
      .mockResolvedValue(true);
    const view = mount();
    await settle();
    if (boundary === 'background') act(() => changeState('background'));
    else if (boundary === 'owner change')
      useAppShellStore.setState({
        session: { ...useAppShellStore.getState().session!, userId: 'owner-B' }
      });
    else view.unmount();
    await act(async () => finishProbe(true));
    expect(synchronizeReceipts).not.toHaveBeenCalled();
  }
);
afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('shows an accessible Arabic notice even while the cold-start cover is visible', async () => {
  mount(<Text>Protected content</Text>);
  await settle();
  expect(screen.getByTestId('startup-loading')).toBeTruthy();
  expect(screen.queryByText('Protected content')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent(/أنت غير متصل بالإنترنت/);
  expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'إغلاق' })).toBeTruthy();
});

it('keeps an offline notice non-modal so cached navigation remains accessible', async () => {
  const navigate = jest.fn();
  render(
    <LiveIdentityStatusContext.Provider
      value={{ status: 'ready', retry: retryIdentity }}
    >
      <QueryClientProvider client={client}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cached accounts"
          onPress={navigate}
        >
          <Text>Cached accounts</Text>
        </Pressable>
        <NetworkConnectionNotice />
      </QueryClientProvider>
    </LiveIdentityStatusContext.Provider>
  );
  await settle();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  expect(screen.getByTestId('offline-connection-notice')).toHaveProp(
    'pointerEvents',
    'box-none'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Cached accounts' }));
  expect(navigate).toHaveBeenCalledTimes(1);
});

it('dismisses once per outage and opens again only for a new outage', async () => {
  mount();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'إغلاق' }));
  await poll();
  expect(screen.queryByRole('alert')).toBeNull();
  probe.mockResolvedValue(true);
  await poll();
  probe.mockResolvedValue(false);
  await poll();
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('rechecks on Retry, preserves the message offline and closes after recovery in English', async () => {
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  mount();
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await settle();
  expect(probe).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent(/You're offline/);
  probe.mockResolvedValue(true);
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await settle();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('recovers failed active reads without replaying a paused financial mutation or clearing cached data', async () => {
  const readBalance = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(955);
  const postExpense = jest.fn();
  function Balance() {
    const query = useQuery({ queryKey: ['qa-balance'], queryFn: readBalance });
    return <Text>{query.data ?? 'unavailable'}</Text>;
  }
  client.setQueryData(['owned-draft'], { amount: 4 });
  const mutation = client.getMutationCache().build(
    client,
    { mutationFn: postExpense },
    {
      status: 'pending',
      isPaused: true,
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      variables: undefined,
      submittedAt: Date.now()
    }
  );
  mount(<Balance />);
  await settle();
  expect(readBalance).toHaveBeenCalledTimes(1);
  probe.mockResolvedValue(true);
  await poll();
  expect(readBalance).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(['qa-balance'])).toBe(955);
  expect(client.getQueryData(['owned-draft'])).toEqual({ amount: 4 });
  expect(postExpense).not.toHaveBeenCalled();
  expect(mutation.state.isPaused).toBe(true);
  expect(synchronizeReceipts).toHaveBeenCalledTimes(1);
  await poll();
  expect(synchronizeReceipts).toHaveBeenCalledTimes(1);
});

it('does not start durable receipt synchronization on an initially online mount', async () => {
  probe.mockResolvedValue(true);
  mount();
  await settle();
  await poll();
  expect(synchronizeReceipts).not.toHaveBeenCalled();
});

it('does not dispatch durable sync through an unavailable identity on reconnect', async () => {
  mount(undefined, 'unavailable');
  await settle();
  probe.mockResolvedValue(true);
  await poll();
  expect(retryIdentity).toHaveBeenCalledTimes(1);
  expect(synchronizeReceipts).not.toHaveBeenCalled();
});

it('retries unavailable authentication and bootstrap once when connectivity returns', async () => {
  useAppShellStore.setState({ profileSetupStatus: 'unavailable' });
  mount(undefined, 'unavailable');
  await settle();
  probe.mockResolvedValue(true);
  await poll();
  expect(retryIdentity).toHaveBeenCalledTimes(1);
  expect(useAppShellStore.getState().bootstrapRevision).toBe(1);
  await poll();
  expect(retryIdentity).toHaveBeenCalledTimes(1);
  expect(useAppShellStore.getState().bootstrapRevision).toBe(1);
});

it('ignores late background probes and checks immediately on foreground return', async () => {
  let resolveProbe!: (online: boolean) => void;
  probe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveProbe = resolve;
      })
  );
  mount();
  act(() => changeState('background'));
  await act(async () => resolveProbe(false));
  await poll();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(probe).toHaveBeenCalledTimes(1);
  act(() => changeState('active'));
  await settle();
  expect(probe).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('does not declare an outage when the native probe fails or is unsupported', async () => {
  probe.mockRejectedValueOnce(new Error('native unavailable'));
  const view = mount();
  await settle();
  expect(screen.queryByRole('alert')).toBeNull();
  view.unmount();
  readRecoveryNetwork.available = false;
  mount();
  await poll();
  expect(probe).toHaveBeenCalledTimes(1);
});
