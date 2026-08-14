import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';

export function Toast({ message }: { message: string }) {
  return <FeedbackBox message={message} />;
}

export function Snackbar({
  message,
  actionLabel,
  onAction
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <FeedbackBox
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

export function UndoSnackbar({
  message,
  onUndo,
  timeoutMs
}: {
  message: string;
  onUndo: () => void;
  timeoutMs: number;
}) {
  return (
    <FeedbackBox
      message={message}
      actionLabel={translate('coreFinance.undo')}
      onAction={onUndo}
    >
      <Text>{`${timeoutMs} ms`}</Text>
    </FeedbackBox>
  );
}

function FeedbackBox({
  message,
  actionLabel,
  onAction,
  children
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderColor: theme.colors.border }]}
    >
      <Text style={{ color: theme.colors.textPrimary }}>{message}</Text>
      {actionLabel ? (
        <ActionButton label={actionLabel} variant="quiet" onPress={onAction} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  }
});
