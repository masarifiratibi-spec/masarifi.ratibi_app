import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { GoogleAccountSelector } from '@/features/auth/GoogleAccountSelector';
import { authService } from '@/features/auth/auth-flow';
import { completeAuthenticatedSession } from '@/features/auth/session-controller';
import type { AuthResult } from '@/services/contracts/app-shell-service';

export default function GoogleRoute() {
  async function resultHandler(result: AuthResult) {
    if (result.status !== 'authenticated') return;
    router.replace(await completeAuthenticatedSession(result.session));
  }

  return (
    <View style={styles.stack}>
      <GoogleAccountSelector
        onResult={resultHandler}
        reverify={authService.reverifyConflict}
        signIn={authService.signInWithGoogle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    padding: 16
  }
});
