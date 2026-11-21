import { useCallback, useLayoutEffect, useRef } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { usePathname } from 'expo-router';
import { type QueryClient, type QueryKey } from '@tanstack/react-query';
import { isBenchmarkReadOnly } from '@/config/client-runtime';
import { useStartupContentVisible } from '@/design-system/components/feedback/StartupLoadingBoundary';
import { useAppShellStore } from '@/state/app-shell';
import {
  classifyScreenReads,
  type ScreenRead
} from '@/services/platform/screen-readiness';
import {
  measuredScreen,
  mountScreenTrace,
  type MeasuredScreen,
  type ScreenTrace
} from '@/services/platform/screen-performance';

type ChildScreenQuery = { client: QueryClient; key: QueryKey | null };
function childRead(query: ChildScreenQuery | undefined): ScreenRead[] {
  if (!query?.key) return [];
  const state = query.client.getQueryState(query.key);
  return [
    {
      data: state?.data,
      error: state?.error,
      isError: state?.status === 'error',
      dataUpdatedAt: state?.dataUpdatedAt,
      isFetching: state?.fetchStatus === 'fetching'
    }
  ];
}

/** Scope/owner keys stay in memory; only fixed route enums reach diagnostics. */
export function useScreenPerformance(
  route: MeasuredScreen,
  reads: readonly ScreenRead[],
  scope: string,
  childQuery?: ChildScreenQuery
) {
  const owner = useAppShellStore((state) => state.session?.userId);
  const pathname = usePathname();
  const visible = useStartupContentVisible();
  const localSession = useAppShellStore(
    (state) => state.session?.restoration === 'local'
  );
  const enabled = isBenchmarkReadOnly() && measuredScreen(pathname) === route;
  const childClient = childQuery?.client;
  const admittedOwner = useRef(owner);
  const trace = useRef<ScreenTrace | null>(null);
  const layout = useRef({ width: 0, height: 0 });
  const frame = useRef<number | null>(null);
  const latest = useRef({ reads, visible, childQuery, localSession });
  latest.current = { reads, visible, childQuery, localSession };
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  useLayoutEffect(() => {
    admittedOwner.current ??= owner;
    if (!enabled || !owner || admittedOwner.current !== owner) return;
    trace.current = mountScreenTrace(route);
    return () => {
      cancelFrame();
      trace.current?.finish();
      trace.current = null;
    };
  }, [enabled, owner, route, scope, cancelFrame]);

  const observe = useCallback(() => {
    cancelFrame();
    const active = trace.current;
    if (
      !active ||
      useAppShellStore.getState().session?.userId !== admittedOwner.current
    )
      return;
    const state = classifyScreenReads(
      [...latest.current.reads, ...childRead(latest.current.childQuery)],
      active.startedAtUnixMs,
      active.startedAtMonotonicMs
    );
    active.observe(
      latest.current.localSession && ['fresh', 'cached'].includes(state)
        ? 'offline'
        : state
    );
    if (!latest.current.visible) return;
    active.layout(layout.current.width, layout.current.height);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        if (
          trace.current === active &&
          useAppShellStore.getState().session?.userId === admittedOwner.current
        )
          active.frame();
        frame.current = null;
      });
    });
  }, [cancelFrame]);
  useLayoutEffect(observe);
  useLayoutEffect(() => {
    if (enabled && childClient)
      return childClient.getQueryCache().subscribe(observe);
  }, [enabled, childClient, observe]);

  return useCallback(
    (event: LayoutChangeEvent) => {
      layout.current = event.nativeEvent.layout;
      observe();
    },
    [observe]
  );
}
