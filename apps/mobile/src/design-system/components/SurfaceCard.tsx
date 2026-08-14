import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/state/theme-context';

export interface SurfaceCardProps extends ViewProps {
  children: ReactNode;
}

export function SurfaceCard({ children, style, ...props }: SurfaceCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        },
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  }
});
