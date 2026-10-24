import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState
} from 'react';
import { StyleSheet, View } from 'react-native';
import { StartupLoading } from './StartupLoading';

const StartupReadiness = createContext<(() => void) | null>(null);

/** Keep the same loading view mounted while fonts, navigation and Home prepare. */
export function StartupLoadingBoundary({
  children,
  ...appearance
}: React.ComponentProps<typeof StartupLoading> & {
  children: React.ReactNode;
}) {
  const [waiting, setWaiting] = useState(true);
  const finish = React.useCallback(() => setWaiting(false), []);
  return (
    <StartupReadiness.Provider value={waiting ? finish : null}>
      <View style={styles.screen}>
        <View
          style={[styles.screen, waiting && styles.hidden]}
          pointerEvents={waiting ? 'none' : 'auto'}
          accessibilityElementsHidden={waiting}
          importantForAccessibility={waiting ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {waiting ? (
          <View style={StyleSheet.absoluteFill}>
            <StartupLoading {...appearance} />
          </View>
        ) : null}
      </View>
    </StartupReadiness.Provider>
  );
}

export function useStartupReady(ready: boolean) {
  const finish = useContext(StartupReadiness);
  useLayoutEffect(() => {
    if (ready) finish?.();
  }, [ready, finish]);
}

export function StartupLoadingStage(
  props: React.ComponentProps<typeof StartupLoading>
) {
  const finish = useContext(StartupReadiness);
  return finish ? null : <StartupLoading {...props} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { opacity: 0 }
});
