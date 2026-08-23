import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { useTheme } from '@/state/theme-context';

export type FeedbackState =
  | 'initial'
  | 'loading'
  | 'success'
  | 'error'
  | 'empty'
  | 'no-result'
  | 'offline'
  | 'sync'
  | 'partial'
  | 'stale'
  | 'pending-sync'
  | 'local-success'
  | 'conflict'
  | 'permission'
  | 'review'
  | 'disabled'
  | 'read-only'
  | 'limit'
  | 'hidden';

export function StateView({
  state,
  title,
  message,
  consequence,
  source,
  freshness,
  actionLabel,
  onAction
}: {
  state: FeedbackState;
  title: string;
  message?: string;
  consequence?: string;
  source?: string;
  freshness?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const announcesImmediately =
    state === 'error' || state === 'offline' || state === 'conflict';
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
      {[message, consequence, source, freshness].filter(Boolean).map((line) => (
        <Text key={line} style={{ color: theme.colors.textSecondary }}>
          {line}
        </Text>
      ))}
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
