import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { translateDynamic } from '@/localization/i18n';

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
  const [revealed, setRevealed] = useState(false);
  const [obscured, setObscured] = useState(false);
  const value = useMemo(
    () => ({
      revealed,
      reveal: () => setRevealed(true),
      reset: () => setRevealed(false)
    }),
    [revealed]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const inactive = state !== 'active';
      if (inactive) setRevealed(false);
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
