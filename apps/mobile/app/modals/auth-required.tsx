import React, { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { RouteModalContainer } from '@/design-system/components/overlays/RouteModalContainer';
import { spacing } from '@/design-system/tokens';
import { StyledText } from '@/components/StyledText';
import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function AuthRequiredRoute() {
  const pendingDestination = useAppShellStore((state) => state.pendingDestination);
  const setPendingDestination = useAppShellStore((state) => state.setPendingDestination);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await setPendingDestination(
        sanitizeReturnRoute(pendingDestination) ?? '/(tabs)/home'
      );
      router.replace('/(public)/sign-in');
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RouteModalContainer
      closeLabel={translate('appShell.navigation.back')}
      onDismiss={() => router.back()}
      title={translate('appShell.navigation.authRequired')}
    >
      <StyledText variant="body">
        {translate('appShell.auth.required.message')}
      </StyledText>
      {error ? (
        <StyledText variant="caption">
          {translate('appShell.auth.required.saveFailed')}
        </StyledText>
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          label={translate('appShell.auth.signIn.title')}
          loading={submitting}
          onPress={signIn}
        />
        <ActionButton
          label={translate('appShell.navigation.back')}
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    </RouteModalContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg
  }
});
