import React from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';

export function LogoutProgressOverlay() {
  const ownerId = useAppShellStore(state => state.logoutInProgressOwnerId);
  const locale = usePreferenceStore(state => state.locale);
  const theme = useTheme();
  if (!ownerId) return null;
  const message = translate('logout.progress', locale);
  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
    <View testID="logout-progress-overlay" accessibilityViewIsModal accessibilityLiveRegion="polite"
      style={{flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.surfaces.page}}>
      <ActivityIndicator color={theme.colors.primary} />
      <StyledText>{message}</StyledText>
    </View>
  </Modal>;
}
