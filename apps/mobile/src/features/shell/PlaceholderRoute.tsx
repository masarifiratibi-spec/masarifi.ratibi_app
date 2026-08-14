import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { StateView } from '@/design-system/components/feedback/StateView';
import { translate } from '@/localization/i18n';

export function PlaceholderRoute({ title }: { title: string }) {
  return (
    <View style={styles.stack}>
      <StyledText variant="title">{title}</StyledText>
      <StateView
        state="empty"
        title={translate('appShell.shell.noMockFinancialData')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
    padding: 16
  }
});
