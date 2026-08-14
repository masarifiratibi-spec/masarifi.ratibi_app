import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import { Snackbar, UndoSnackbar } from '@/design-system/components/feedback/TransientFeedback';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function InteractionGallery() {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <FormField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        variant="amount"
        helperText="Enter the transaction amount"
      />
      <ActionButton label="Save changes" loading={saved} onPress={() => setSaved(true)} />
      {saved ? <Snackbar message="Saved" actionLabel="Retry" onAction={() => setSaved(false)} /> : null}
      <UndoSnackbar message="Transaction added" onUndo={() => setSaved(false)} timeoutMs={4000} />
      <ConfirmationDialog
        visible
        title={translate('designSystem.action.delete')}
        message="This cannot be undone"
        confirmLabel="Delete permanently"
        destructive
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    gap: 12,
    padding: 16
  }
});
