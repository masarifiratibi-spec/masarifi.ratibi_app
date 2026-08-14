import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { useTheme } from '@/state/theme-context';

export type FeedbackState =
  | 'loading'
  | 'success'
  | 'error'
  | 'empty'
  | 'offline'
  | 'sync'
  | 'permission'
  | 'review';

export function StateView({
  state,
  title,
  actionLabel,
  onAction
}: {
  state: FeedbackState;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const announcesImmediately = state === 'error' || state === 'offline';
  return (
    <View
      accessibilityLabel={title}
      accessibilityLiveRegion={announcesImmediately ? 'assertive' : 'polite'}
      style={styles.stack}
    >
      <Text
        accessibilityRole={announcesImmediately ? 'alert' : 'text'}
        style={[styles.title, { color: theme.colors.textPrimary }]}
      >
        {title}
      </Text>
      {actionLabel ? (
        <ActionButton
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  title: {
    fontWeight: '700'
  }
});
