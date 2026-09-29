import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { GoogleAccountSelector } from '@/features/auth/GoogleAccountSelector';
import { authService } from '@/features/auth/auth-flow';
import { validatePhoneInput } from '@/features/auth/phone-validation';
import { completeAuthenticatedSession } from '@/features/auth/session-controller';
import { mapAppShellError } from '@/features/shell/app-shell-errors';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';
import type { AuthenticationSession } from '@/domain/app-shell';
import type {
  AuthResult,
  AuthService,
  PhoneVerificationAttempt
} from '@/services/contracts/app-shell-service';
import { useTheme } from '@/state/theme-context';

export default function AuthPendingRoute() {
  return (
    <AuthPendingScreen
      auth={authService}
      onAuthenticated={async (session) => {
        router.replace(await completeAuthenticatedSession(session));
      }}
    />
  );
}

export function AuthPendingScreen({
  auth,
  onAuthenticated
}: {
  auth: Pick<
    AuthService,
    | 'startPhone'
    | 'verifyPhone'
    | 'resendPhone'
    | 'signInWithGoogle'
    | 'reverifyConflict'
  >;
  onAuthenticated: (session: AuthenticationSession) => void | Promise<void>;
}) {
  const theme = useTheme();
  const [countryCode, setCountryCode] = useState('+966');
  const [phoneValue, setPhoneValue] = useState('');
  const [attempt, setAttempt] = useState<PhoneVerificationAttempt | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null);
  const [clock, setClock] = useState(Date.now());
  const canResend = attempt !== null && clock >= attempt.resendAvailableAt;

  useEffect(() => {
    if (!attempt || canResend) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(0, attempt.resendAvailableAt - Date.now()) + 25
    );
    return () => clearTimeout(timer);
  }, [attempt, canResend]);

  async function finish(result: AuthResult) {
    if (result.status === 'authenticated') {
      setMessageKey(null);
      await onAuthenticated(result.session);
      return;
    }
    setMessageKey(messageForResult(result));
  }

  async function sendCode() {
    if (pending) return;
    const input = validatePhoneInput({ countryCode, phoneValue });
    if (!input.success) {
      setMessageKey(input.errorCode);
      return;
    }
    setPending(true);
    setMessageKey(null);
    try {
      const nextAttempt = await auth.startPhone(input.data);
      setAttempt(nextAttempt);
      setClock(Date.now());
      setCode('');
    } catch (error) {
      setMessageKey(mapAppShellError(error).code as MessageKey);
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (!attempt || pending) return;
    if (!/^\d{6}$/.test(code)) {
      setMessageKey('appShell.auth.otp.invalid');
      return;
    }
    setPending(true);
    try {
      await finish(
        await auth.verifyPhone({ sessionId: attempt.sessionId, code })
      );
    } catch (error) {
      setMessageKey(mapAppShellError(error).code as MessageKey);
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (!attempt || pending) return;
    if (!canResend) {
      setMessageKey('appShell.auth.otp.wait');
      return;
    }
    setPending(true);
    try {
      const nextAttempt = await auth.resendPhone(attempt.sessionId);
      setAttempt(nextAttempt);
      setClock(Date.now());
      setMessageKey(null);
    } catch (error) {
      setMessageKey(mapAppShellError(error).code as MessageKey);
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.surfaces.page }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <StyledText variant="headline">
          {translate(
            attempt ? 'appShell.auth.otp.title' : 'appShell.auth.signIn.title'
          )}
        </StyledText>

        {attempt ? (
          <>
            <FormField
              label={translate('appShell.auth.otp.code')}
              maxLength={6}
              onChangeText={setCode}
              value={code}
              variant="otp"
            />
            <ActionButton
              label={translate('appShell.auth.otp.submit')}
              loading={pending}
              onPress={() => void verifyCode()}
            />
            <ActionButton
              disabled={!canResend}
              label={translate(
                canResend
                  ? 'appShell.auth.otp.resend'
                  : 'appShell.auth.otp.wait'
              )}
              loading={pending}
              onPress={() => void resendCode()}
              variant="secondary"
            />
            <ActionButton
              label={translate('appShell.auth.phone.change')}
              onPress={() => {
                setAttempt(null);
                setCode('');
                setMessageKey(null);
              }}
              variant="quiet"
            />
          </>
        ) : (
          <>
            <FormField
              keyboardType="phone-pad"
              label={translate('appShell.auth.phone.countryCode')}
              onChangeText={setCountryCode}
              value={countryCode}
              variant="phone"
            />
            <FormField
              autoComplete="tel"
              keyboardType="phone-pad"
              label={translate('appShell.auth.phone.number')}
              onChangeText={setPhoneValue}
              value={phoneValue}
              variant="phone"
            />
            <ActionButton
              label={translate('appShell.auth.phone.submit')}
              loading={pending}
              onPress={() => void sendCode()}
            />
            <GoogleAccountSelector
              onResult={(result) => void finish(result)}
              reverify={auth.reverifyConflict}
              signIn={auth.signInWithGoogle}
            />
          </>
        )}

        {messageKey ? (
          <StyledText accessibilityRole="alert">
            {translate(messageKey)}
          </StyledText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function messageForResult(
  result: Exclude<AuthResult, { status: 'authenticated' }>
): MessageKey {
  if (result.status === 'cancelled') return 'appShell.auth.google.cancelled';
  if (result.status === 'conflict') return 'appShell.auth.conflict.title';
  if (result.errorCode === 'invalid') return 'appShell.auth.otp.invalid';
  if (result.errorCode === 'expired') return 'appShell.auth.otp.expired';
  if (result.errorCode === 'rate_limited')
    return 'appShell.auth.otp.rateLimited';
  return mapAppShellError(new Error(result.errorCode)).code as MessageKey;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32
  }
});
