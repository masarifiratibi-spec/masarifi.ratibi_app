import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';

export default function LegalRoute() {
  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate('appShell.public.legal')}</StyledText>
      <StyledText variant="subtitle">{translate('appShell.public.privacyTitle')}</StyledText>
      <StyledText>{translate('appShell.public.privacyBody')}</StyledText>
      <StyledText variant="subtitle">{translate('appShell.public.termsTitle')}</StyledText>
      <StyledText>{translate('appShell.public.termsBody')}</StyledText>
      <ActionButton
        label={translate('appShell.navigation.back')}
        onPress={() => router.back()}
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
