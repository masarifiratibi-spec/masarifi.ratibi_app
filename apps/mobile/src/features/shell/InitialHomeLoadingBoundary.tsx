import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useReducer,
  useRef
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  StartupLoadingStage,
  useStartupReady
} from '@/design-system/components/feedback/StartupLoadingBoundary';
import { usePreferenceStore } from '@/state/preferences';
import { recordBenchmarkEvent } from '@/services/platform/benchmark-observability';

type Part = 'home' | 'header' | 'notice';
type Readiness = 'pending' | 'ready' | 'failed';

const InitialHomeReadiness = createContext<
  ((part: Part, state: Readiness) => void) | null
>(null);

export function useInitialHomeReadiness(part: Part, state: Readiness | null) {
  const report = useContext(InitialHomeReadiness);
  useLayoutEffect(() => {
    if (state !== null) report?.(part, state);
  }, [part, state, report]);
}

type State = Record<Part | 'layout', boolean> & { released: boolean };
type Action = { part: Part | 'layout' | 'leave'; state: Readiness };

function reduceReadiness(previous: State, action: Action): State {
  if (previous.released) return previous;
  if (action.state === 'failed' || action.part === 'leave')
    return { ...previous, released: true };
  const ready = action.state === 'ready';
  if (previous[action.part] === ready) return previous;
  const next = { ...previous, [action.part]: ready };
  return {
    ...next,
    released: next.home && next.header && next.notice && next.layout
  };
}

export function InitialHomeLoadingBoundary({
  isHome,
  children
}: {
  isHome: boolean;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reduceReadiness, {
    home: false,
    header: false,
    notice: false,
    layout: false,
    released: !isHome
  });
  const released = useRef(state.released);
  released.current = state.released;
  const releaseOutcome = useRef<'failed' | 'left_route' | null>(
    isHome ? null : 'left_route'
  );
  const recorded = useRef(false);
  const report = useCallback(
    (part: Part, readiness: Readiness) => {
      if (!released.current && readiness === 'failed')
        releaseOutcome.current ??= 'failed';
      dispatch({ part, state: readiness });
    },
    []
  );
  const locale = usePreferenceStore((state) => state.locale);
  const themePreference = usePreferenceStore((state) => state.theme);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  useLayoutEffect(() => {
    if (!isHome) {
      if (!released.current) releaseOutcome.current ??= 'left_route';
      dispatch({ part: 'leave', state: 'ready' });
    }
  }, [isHome]);
  useLayoutEffect(() => {
    if (!state.released || recorded.current) return;
    const outcome =
      releaseOutcome.current ??
      (state.home && state.header && state.notice && state.layout ? 'ready' : null);
    if (!outcome) return;
    recorded.current = true;
    recordBenchmarkEvent({ kind: 'home', outcome });
  }, [state]);
  const waiting = isHome && !state.released;
  useStartupReady(!waiting);
  return (
    <InitialHomeReadiness.Provider value={report}>
      <View style={styles.screen}>
        <View
          testID="initial-home-content"
          collapsable={false}
          style={[styles.screen, waiting && styles.hidden]}
          pointerEvents={waiting ? 'none' : 'auto'}
          accessibilityElementsHidden={waiting}
          importantForAccessibility={waiting ? 'no-hide-descendants' : 'auto'}
          onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0)
              dispatch({ part: 'layout', state: 'ready' });
          }}
        >
          {children}
        </View>
        {waiting ? (
          <View style={StyleSheet.absoluteFill}>
            <StartupLoadingStage
              locale={locale}
              themePreference={themePreference}
              reducedMotion={reducedMotion}
            />
          </View>
        ) : null}
      </View>
    </InitialHomeReadiness.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { opacity: 0 }
});
