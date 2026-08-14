import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { translate } from '@/localization/i18n';

export function useTransactionDraftGuard({
  meaningful,
  discard
}: {
  meaningful: boolean;
  discard: () => Promise<void>;
}) {
  return useCallback(() => {
    if (!meaningful) {
      router.back();
      return;
    }
    Alert.alert(
      translate('coreFinance.draft.leaveTitle'),
      translate('coreFinance.draft.leaveMessage'),
      [
        { text: translate('coreFinance.draft.keepEditing'), style: 'cancel' },
        {
          text: translate('coreFinance.draft.discard'),
          style: 'destructive',
          onPress: () => void discard().then(() => router.back())
        }
      ]
    );
  }, [discard, meaningful]);
}
