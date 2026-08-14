import React from 'react';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { PlaceholderRoute } from '@/features/shell/PlaceholderRoute';
import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function AuthRequiredRoute() {
  const pendingDestination = useAppShellStore((state) => state.pendingDestination);
  const setPendingDestination = useAppShellStore((state) => state.setPendingDestination);

  async function signIn() {
    await setPendingDestination(
      sanitizeReturnRoute(pendingDestination) ?? '/(tabs)/home'
    );
    router.replace('/(public)/sign-in');
  }

  return (
    <>
      <PlaceholderRoute title={translate('appShell.navigation.authRequired')} />
      <ActionButton label={translate('appShell.auth.signIn.title')} onPress={signIn} />
      <ActionButton
        label={translate('appShell.navigation.back')}
        onPress={() => router.back()}
        variant="secondary"
      />
    </>
  );
}
