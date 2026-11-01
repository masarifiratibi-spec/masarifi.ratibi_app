import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { FoundationProviders } from './FoundationProviders';
import { useAppShellStore } from './app-shell';
import { usePreferenceStore } from './preferences';
import { HttpError } from '@/services/live/http-client';

jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isFixtureModeEnabled: () => false
}));

type Sqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...args: (string | number)[]): unknown[];
    get(...args: (string | number)[]): unknown;
    run(...args: (string | number)[]): unknown;
  };
  close(): void;
};
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => Sqlite;
}>('node:sqlite');
let mockDatabase: Sqlite;
jest.mock('@/storage/database', () => ({
  openDatabase: async () => ({
    getAllAsync: async (sql: string, ...args: (string | number)[]) =>
      mockDatabase.prepare(sql).all(...args),
    getFirstAsync: async (sql: string, ...args: (string | number)[]) =>
      mockDatabase.prepare(sql).get(...args) ?? null,
    runAsync: async (sql: string, ...args: (string | number)[]) =>
      mockDatabase.prepare(sql).run(...args)
  }),
  runExclusiveDatabaseTransaction: async (
    db: unknown,
    work: (db: unknown) => Promise<void>
  ) => work(db)
}));

beforeEach(() => {
  mockDatabase = new DatabaseSync(':memory:');
  const ddl = readFileSync('src/storage/database.ts', 'utf8').match(
    /-- migration:16([\s\S]*?)-- migration:10/
  )![1];
  mockDatabase.exec(ddl);
  mockDatabase.exec(
    'CREATE TABLE settings_profile (id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at INTEGER NOT NULL)'
  );
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr',
    theme: 'light'
  });
  useAppShellStore.setState({
    hydrated: true,
    session: {
      status: 'authenticated',
      userId: 'same-restoring-owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999,
      restoration: 'local'
    },
    privacyLock: {
      enabled: true,
      autoLockDuration: 'immediate',
      appLockStatus: 'unlocked'
    }
  });
});
afterEach(async () => {
  for (let step = 0; step < 20; step++) await Promise.resolve();
  useAppShellStore.setState({ session: null });
  mockDatabase.close();
});

it.each([false, true])(
  'refreshes a denied startup read only after the same owner is remotely restored, pending phase=%s',
  async (throughPending) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity }
      }
    });
    const dispatched: string[] = [];
    let finish!: () => void;
    const command = client.getMutationCache().build(client, {
      mutationKey: ['retained-command'],
      mutationFn: async ({ operationId }: { operationId: string }) => {
        dispatched.push(operationId);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      }
    });
    const pending = command.execute({ operationId: 'same-original-operation' });
    function ReadProbe() {
      const read = useQuery({
        queryKey: ['core-finance', 'home', 'startup-read'],
        queryFn: async () => {
          if (useAppShellStore.getState().session?.restoration === 'local')
            throw new HttpError('session_expired', 401);
          return 'restored-owner-read';
        }
      });
      return (
        <Text>
          {read.isError ? 'read-needs-recovery' : (read.data ?? 'loading')}
        </Text>
      );
    }
    const view = render(
      <FoundationProviders client={client}>
        <ReadProbe />
      </FoundationProviders>
    );
    try {
      await screen.findByText('read-needs-recovery');
      if (throughPending) {
        await act(async () => {
          useAppShellStore.setState((state) => ({
            session: { ...state.session!, restoration: 'pending' }
          }));
        });
        expect(screen.getByText('read-needs-recovery')).toBeTruthy();
      }
      act(() =>
        useAppShellStore.setState((state) => ({
          session: { ...state.session!, restoration: 'restored' }
        }))
      );
      await waitFor(() =>
        expect(screen.getByText('restored-owner-read')).toBeTruthy()
      );
      expect(client.getMutationCache().getAll()).toContain(command);
      expect(dispatched).toEqual(['same-original-operation']);
    } finally {
      view.unmount();
      finish();
      await pending;
      client.clear();
    }
  }
);
