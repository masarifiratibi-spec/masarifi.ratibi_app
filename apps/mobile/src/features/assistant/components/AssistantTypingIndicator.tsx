import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { spacing } from '@/design-system/tokens';

export function AssistantTypingIndicator() {
  const { colors } = useTheme();
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1050,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false
      })
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={translateDynamic('assistant.thinking')}
      accessibilityState={{ busy: true }}
      style={[styles.bubble, { backgroundColor: colors.surfaceMuted }]}
    >
      {[0, 1, 2].map((index) => {
        const inputRange = [
          0,
          0.1 + index * 0.14,
          0.23 + index * 0.14,
          0.36 + index * 0.14,
          1
        ];
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: colors.content.secondary,
                opacity: reducedMotion
                  ? 1
                  : progress.interpolate({
                      inputRange,
                      outputRange: [0.45, 0.45, 1, 0.45, 0.45]
                    }),
                transform: [
                  {
                    translateY: reducedMotion
                      ? 0
                      : progress.interpolate({
                          inputRange,
                          outputRange: [0, 0, -3, 0, 0]
                        })
                  }
                ]
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 5,
    height: 32,
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    width: 56
  },
  dot: { borderRadius: 3, height: 5, width: 5 }
});
