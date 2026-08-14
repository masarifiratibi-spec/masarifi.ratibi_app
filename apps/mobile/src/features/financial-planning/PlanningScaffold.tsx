import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { spacing } from '@/design-system/tokens';
import { translate, type MessageKey } from '@/localization/i18n';

export function PlanningScreen({
  titleKey,
  children,
  action
}: {
  titleKey: MessageKey;
  children: React.ReactNode;
  action?: { labelKey: MessageKey; onPress: () => void };
}) {
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">{translate(titleKey)}</StyledText>
      {children}
      {action ? (
        <ActionButton label={translate(action.labelKey)} onPress={action.onPress} />
      ) : null}
    </ScrollView>
  );
}

export function PlanningState({
  state,
  onRetry
}: {
  state: 'loading' | 'empty' | 'error' | 'partial' | 'offline';
  onRetry?: () => void;
}) {
  const key =
    state === 'loading'
      ? 'planning.state.loading'
      : state === 'empty'
        ? 'planning.state.empty'
        : state === 'partial'
          ? 'planning.state.partial'
          : state === 'offline'
            ? 'planning.state.offline'
            : 'planning.state.error';
  return (
    <StateView
      state={state === 'partial' ? 'review' : state}
      title={translate(key)}
      actionLabel={onRetry ? translate('planning.action.retry') : undefined}
      onAction={onRetry}
    />
  );
}

export function PlanningMetric({
  labelKey,
  value
}: {
  labelKey: MessageKey;
  value: string;
}) {
  return (
    <SurfaceCard>
      <View style={styles.metric}>
        <StyledText variant="caption">{translate(labelKey)}</StyledText>
        <StyledText variant="subtitle">{value}</StyledText>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  metric: {
    gap: spacing.xs
  }
});
