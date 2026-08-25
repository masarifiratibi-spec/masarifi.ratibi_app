import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/design-system/components/feedback/StateView';
import { AmountText } from '@/design-system/components/financial/FinancialPrimitives';
import { translate } from '@/localization/i18n';

export function StateGallery() {
  return (
    <View style={styles.stack}>
      <StateView state="loading" title={translate('designSystem.state.loadingShort')} />
      <StateView state="offline" title={translate('designSystem.state.offlineShort')} />
      <StateView state="pending-sync" title={translate('designSystem.state.pendingSync')} />
      <StateView state="hidden" title={translate('designSystem.state.hiddenValue')} />
      <AmountText currency="EGP" meaning="income" state="unknown" />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  }
});
