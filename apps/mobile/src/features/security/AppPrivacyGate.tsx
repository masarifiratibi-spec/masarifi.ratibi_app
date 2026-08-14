import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

interface AppPrivacyGateProps {
  children: ReactNode;
  immediate?: boolean;
  lockAfterMs?: number | null;
  locked?: boolean;
  onLock?: () => void;
}

export function AppPrivacyGate({
  children,
  immediate = false,
  lockAfterMs = null,
  locked = false,
  onLock
}: AppPrivacyGateProps) {
  const theme = useTheme();
  const [masked, setMasked] = useState(locked);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        const firstBackgroundTransition = backgroundedAt.current === null;
        backgroundedAt.current ??= Date.now();
        setMasked(true);
        if (immediate && firstBackgroundTransition) onLock?.();
      }
      if (state === 'active') {
        const elapsed = backgroundedAt.current
          ? Date.now() - backgroundedAt.current
          : 0;
        backgroundedAt.current = null;
        if (!immediate && lockAfterMs !== null && elapsed >= lockAfterMs) {
          onLock?.();
          return;
        }
        if (!locked) setMasked(false);
      }
    });
    return () => sub.remove();
  }, [immediate, lockAfterMs, locked, onLock]);

  const privacyMaskVisible = masked || locked;
  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden={privacyMaskVisible}
        importantForAccessibility={
          privacyMaskVisible ? 'no-hide-descendants' : 'auto'
        }
        pointerEvents={privacyMaskVisible ? 'none' : 'auto'}
        style={styles.content}
      >
        {children}
      </View>
      {privacyMaskVisible ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.cover, { backgroundColor: theme.colors.background }]}
        >
          <StyledText accessibilityLiveRegion="polite" variant="subtitle">
            {translate('appShell.security.protectedContent')}
          </StyledText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
