import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from 'react-native';
import { isLoaded } from 'expo-font';

import { spacing, startupLoading, typography } from '@/design-system/tokens';
import type { Locale, ThemePreference } from '@/domain/foundation';
import { currentLocale, translate } from '@/localization/i18n';

/** Provider-independent: FontGate renders this before FoundationProviders. */
export function StartupLoading({
  locale = currentLocale(),
  themePreference = 'system',
  reducedMotion = false,
  testID = 'startup-loading'
}: {
  locale?: Locale;
  themePreference?: ThemePreference;
  reducedMotion?: boolean;
  testID?: string;
}) {
  const systemScheme = useColorScheme();
  const mode = themePreference === 'system' ? systemScheme : themePreference;
  const colors = startupLoading[mode === 'dark' ? 'dark' : 'light'];
  const [systemReducedMotion, setSystemReducedMotion] = useState<
    boolean | null
  >(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const family = startupLoading.fontFamily[locale];
  const textStyle = {
    fontFamily: isLoaded(family) ? family : undefined,
    writingDirection: locale === 'ar' ? ('rtl' as const) : ('ltr' as const)
  };
  const message = translate('appShell.startup.preparing', locale);

  useEffect(() => {
    let disposed = false;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        receivedChange = true;
        setSystemReducedMotion(enabled);
      }
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!disposed && !receivedChange) setSystemReducedMotion(enabled);
      })
      .catch(() => {
        if (!disposed && !receivedChange) setSystemReducedMotion(true);
      });
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || systemReducedMotion !== false) return;
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: startupLoading.rotationDuration,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false
      })
    );
    animation.start();
    return () => {
      animation.stop();
      rotation.setValue(0);
    };
  }, [reducedMotion, rotation, systemReducedMotion]);

  return (
    <View
      testID={testID}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={message}
          accessibilityLiveRegion="none"
          style={styles.identity}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.identity}
          >
            <View style={[styles.indicator, { borderColor: colors.track }]}>
              <Animated.View
                style={[
                  styles.arc,
                  {
                    borderTopColor: colors.indicator,
                    transform: [
                      {
                        rotate: rotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }
                    ]
                  }
                ]}
              />
            </View>
            <Text
              style={[styles.message, textStyle, { color: colors.message }]}
            >
              {message}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl
  },
  identity: { alignItems: 'center', width: '100%' },
  indicator: {
    width: startupLoading.indicatorSize,
    height: startupLoading.indicatorSize,
    borderRadius: startupLoading.indicatorSize / 2,
    borderWidth: startupLoading.indicatorWidth
  },
  arc: {
    position: 'absolute',
    top: -startupLoading.indicatorWidth,
    left: -startupLoading.indicatorWidth,
    width: startupLoading.indicatorSize,
    height: startupLoading.indicatorSize,
    borderRadius: startupLoading.indicatorSize / 2,
    borderWidth: startupLoading.indicatorWidth,
    borderColor: 'transparent'
  },
  message: { ...typography.body, textAlign: 'center', marginTop: spacing.xl }
});
