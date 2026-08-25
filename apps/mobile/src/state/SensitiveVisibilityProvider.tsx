import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';

interface SensitiveVisibilityContextValue {
  revealed: boolean;
  reveal: () => void;
  reset: () => void;
}

const SensitiveVisibilityContext = createContext<SensitiveVisibilityContextValue>({
  revealed: false,
  reveal: () => undefined,
  reset: () => undefined
});

export function SensitiveVisibilityProvider({ children }: { children: ReactNode }) {
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const [sessionRevealed, setSessionRevealed] = useState(false);
  const [obscured, setObscured] = useState(false);
  const revealed = !hideBalances || sessionRevealed;
  const value = useMemo(
    () => ({
      revealed,
      reveal: () => setSessionRevealed(true),
      reset: () => setSessionRevealed(false)
    }),
    [revealed]
  );

  useEffect(() => {
    if (!hideBalances) setSessionRevealed(false);
  }, [hideBalances]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const inactive = state !== 'active';
      if (inactive) setSessionRevealed(false);
      setObscured(inactive);
    });
    return () => subscription.remove();
  }, []);

  return (
    <SensitiveVisibilityContext.Provider value={value}>
      {obscured ? <View accessibilityLabel={translateDynamic('app.title')} style={{ flex: 1 }} testID="privacy-shield" /> : children}
    </SensitiveVisibilityContext.Provider>
  );
}

export function useSensitiveVisibility() {
  return useContext(SensitiveVisibilityContext);
}
