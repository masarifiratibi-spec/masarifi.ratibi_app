import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';

export default function WelcomeRoute() {
  return (
    <View style={styles.stack}>
      <StyledText variant="headline">{translate('appShell.public.welcome.title')}</StyledText>
      <StyledText>{translate('appShell.public.welcome.body')}</StyledText>
      <ActionButton
        label={translate('appShell.public.welcome.signIn')}
        onPress={() => router.push('/(public)/sign-in')}
      />
      <ActionButton
        label={translate('appShell.public.welcome.signUp')}
        onPress={() => router.push('/(public)/sign-up')}
        variant="secondary"
      />
      <ActionButton
        label={translate('appShell.public.legal')}
        onPress={() => router.push('/(public)/legal')}
        variant="quiet"
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
