import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';

export default function LanguageRoute() {
  const setLocale = usePreferenceStore((state) => state.setLocale);

  function choose(locale: 'ar' | 'en') {
    setLocale(locale);
    router.replace('/(public)/welcome');
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate('appShell.public.language.title')}</StyledText>
      <ActionButton
        label={translate('appShell.public.language.arabic')}
        onPress={() => choose('ar')}
      />
      <ActionButton
        label={translate('appShell.public.language.english')}
        onPress={() => choose('en')}
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
