import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import type { AuthResult } from '@/services/contracts/app-shell-service';
import { authService } from './auth-flow';

export function AppleAccountSelector({
  onResult,
  disabled = false
}: {
  onResult: (result: AuthResult) => void | Promise<void>;
  disabled?: boolean;
}) {
  const identity = useLiveIdentityStatus();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then(
        (supported) => {
          if (mounted.current) setAvailable(supported);
        },
        () => {
          if (mounted.current) setMessage('appShell.auth.unavailable');
        }
      );
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  async function signIn() {
    if (disabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await authService.signInWithApple();
      if (!mounted.current) return;
      if (result.status === 'authenticated') await onResult(result);
      else
        setMessage(
          result.status === 'cancelled'
            ? 'appleAuth.notCompleted'
            : 'appShell.auth.unavailable'
        );
    } catch {
      if (mounted.current) setMessage('appShell.error.unknown');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (Platform.OS !== 'ios') return null;
  return (
    <View style={styles.stack}>
      {message &&
      !['error', 'incomplete', 'cancelled'].includes(identity.status) ? (
        <StyledText accessibilityRole="alert" accessibilityLiveRegion="polite">
          {translate(message)}
        </StyledText>
      ) : null}
      {available ? (
        <View pointerEvents={disabled || busy ? 'none' : 'auto'}>
          <AppleAuthentication.AppleAuthenticationButton
            accessibilityLabel={translate('appleAuth.continue')}
            accessibilityState={{ busy, disabled: disabled || busy }}
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={16}
            style={styles.button}
            onPress={() => void signIn()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  button: { width: '100%', height: 56 }
});
