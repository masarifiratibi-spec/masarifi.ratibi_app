import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { VoiceCaptureScreen } from '@/features/voice/VoiceCaptureScreen';
import { translate } from '@/localization/i18n';

export default function AddRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const voice = mode === 'voice';
  return (
    <View style={styles.root}>
      <View style={styles.modes}>
        <ActionButton
          label={translate('voice.mode.manual')}
          variant={voice ? 'secondary' : 'primary'}
          onPress={() => router.setParams({ mode: 'manual' })}
          style={styles.mode}
        />
        <ActionButton
          label={translate('voice.mode.voice')}
          variant={voice ? 'primary' : 'secondary'}
          onPress={() => router.setParams({ mode: 'voice' })}
          style={styles.mode}
        />
      </View>
      {voice ? (
        <VoiceCaptureScreen onManual={() => router.setParams({ mode: 'manual' })} />
      ) : (
        <TransactionForm />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  mode: { flex: 1 }
});
