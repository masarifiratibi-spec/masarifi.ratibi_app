import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateView } from '@/design-system/components/feedback/StateView';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function StartupConnectionState({ onAction }: { onAction: () => void }) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surfaces.page }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.spacing.lg }]}>
        <View style={[styles.message, { gap: theme.spacing.xl, direction }]}>
          <Image
            accessible={false}
            source={require('../../../assets/icon.png')}
            style={styles.mark}
          />
          <StateView
            state="offline"
            title={translate('appShell.connectionUnavailable.title')}
            message={translate('appShell.connectionUnavailable.message')}
            actionLabel={translate('profileSetup.retry')}
            onAction={onAction}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  message: { width: '100%', maxWidth: 440 },
  mark: { width: 72, height: 72, alignSelf: 'center' }
});
