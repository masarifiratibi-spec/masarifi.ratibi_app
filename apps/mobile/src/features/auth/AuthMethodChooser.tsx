import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';

export function AuthMethodChooser({ titleKey }: { titleKey: MessageKey }) {
  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate(titleKey)}</StyledText>
      <ActionButton
        label={translate('appShell.auth.method.phone')}
        onPress={() => router.push('/(public)/phone')}
      />
      <ActionButton
        label={translate('appShell.auth.method.google')}
        onPress={() => router.push('/(public)/google')}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  }
});
