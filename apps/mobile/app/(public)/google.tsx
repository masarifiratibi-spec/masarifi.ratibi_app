import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { GoogleAccountSelector } from '@/features/auth/GoogleAccountSelector';
import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { authService } from '@/features/auth/auth-flow';
import { completeAuthenticatedSession } from '@/features/auth/session-controller';
import type { AuthResult } from '@/services/contracts/app-shell-service';
import { translate } from '@/localization/i18n';

export default function GoogleRoute() {
  async function resultHandler(result: AuthResult) {
    if (result.status !== 'authenticated') return;
    router.replace(await completeAuthenticatedSession(result.session));
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate('appShell.auth.google.title')}</StyledText>
      <SurfaceCard>
        <GoogleAccountSelector
          onResult={resultHandler}
          reverify={authService.reverifyConflict}
          signIn={authService.signInWithGoogle}
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  }
});
