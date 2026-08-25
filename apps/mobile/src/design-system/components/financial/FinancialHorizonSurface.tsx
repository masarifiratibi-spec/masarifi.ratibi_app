import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop
} from 'react-native-svg';

import { useTheme } from '@/state/theme-context';

export function FinancialHorizonSurface({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme().colors.horizon;
  return (
    <View
      testID="financial-horizon-surface"
      style={[styles.root, { backgroundColor: colors.heroStart }, style]}
    >
      <Svg
        testID="financial-horizon-gradient"
        height="100%"
        pointerEvents="none"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        width="100%"
      >
        <Defs>
          <LinearGradient id="horizon-base" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.heroStart} />
            <Stop offset="1" stopColor={colors.heroEnd} />
          </LinearGradient>
          <RadialGradient id="horizon-glow" cx="78%" cy="8%" rx="68%" ry="68%">
            <Stop offset="0" stopColor={colors.glow} />
            <Stop offset="1" stopColor={colors.heroStart} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect fill="url(#horizon-base)" height="100%" width="100%" />
        <Rect fill="url(#horizon-glow)" height="100%" width="100%" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { overflow: 'hidden' } });
