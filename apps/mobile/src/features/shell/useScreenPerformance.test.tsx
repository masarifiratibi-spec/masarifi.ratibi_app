import React from 'react';
import { View } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { useAppShellStore } from '@/state/app-shell';
import { type ScreenRead } from '@/services/platform/screen-readiness';
import { useScreenPerformance } from './useScreenPerformance';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
jest.mock('expo-router', () => ({ usePathname: jest.fn(() => '/accounts') }));

const summaryClient = new QueryClient();
function Page({
  read,
  summary = false
}: {
  read: ScreenRead;
  summary?: boolean;
}) {
  const onLayout = useScreenPerformance(
    'accounts',
    [read],
    'all',
    summary ? { client: summaryClient, key: ['summary'] } : undefined
  );
  return <View testID="page" onLayout={onLayout} />;
}

it('waits for a child query without starting a second request', () => {
  const restore = installBenchmarkEnvironment();
  const previous = useAppShellStore.getState().session;
  useAppShellStore.setState({ session: authenticatedSession });
  jest.mocked(usePathname).mockReturnValue('/accounts');
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  try {
    const view = render(<Page read={{ data: [], isError: false }} summary />);
    const events = () =>
      log.mock.calls
        .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
        .map(([, json]) => JSON.parse(json));
    expect(events().some((event) => event.phase === 'cached')).toBe(false);
    act(() => summaryClient.setQueryData(['summary'], { total: 0 }));
    expect(events().some((event) => event.phase === 'cached')).toBe(true);
    expect(summaryClient.isFetching()).toBe(0);
    view.unmount();
  } finally {
    restore();
    summaryClient.clear();
    useAppShellStore.setState({ session: previous });
    log.mockRestore();
    clock.mockRestore();
  }
});

it('cancels the pending frame when the owner changes and never reports the old owner as usable', () => {
  const restore = installBenchmarkEnvironment();
  const previous = useAppShellStore.getState().session;
  useAppShellStore.setState({ session: authenticatedSession });
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const clock = jest.spyOn(performance, 'now').mockReturnValue(100);
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const raf = jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
  const cancel = jest
    .spyOn(global, 'cancelAnimationFrame')
    .mockImplementation((id) => {
      frames.delete(id);
    });
  try {
    const view = render(<Page read={{ data: [], isError: false }} />);
    fireEvent(view.getByTestId('page'), 'layout', {
      nativeEvent: { layout: { width: 100, height: 100 } }
    });
    act(() =>
      useAppShellStore.setState({
        session: { ...authenticatedSession, userId: 'other_owner' }
      })
    );
    act(() => {
      for (const callback of frames.values()) callback(130);
    });
    const events = log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, json]) => JSON.parse(json));
    expect(events.some((event) => event.phase === 'aborted')).toBe(true);
    expect(events.some((event) => event.phase === 'interactive')).toBe(false);
    expect(JSON.stringify(events)).not.toMatch(/other_owner/);
    view.unmount();
  } finally {
    restore();
    useAppShellStore.setState({ session: previous });
    log.mockRestore();
    clock.mockRestore();
    raf.mockRestore();
    cancel.mockRestore();
  }
});

it('does not classify an unfocused retained screen as a navigation', () => {
  const restore = installBenchmarkEnvironment();
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.mocked(usePathname).mockReturnValue('/transactions');
  try {
    const view = render(<Page read={{ data: [], isError: false }} />);
    fireEvent(view.getByTestId('page'), 'layout', {
      nativeEvent: { layout: { width: 100, height: 100 } }
    });
    expect(
      log.mock.calls.filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
    ).toEqual([]);
    view.unmount();
  } finally {
    restore();
    log.mockRestore();
  }
});
