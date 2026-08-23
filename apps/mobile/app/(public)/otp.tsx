import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { OtpVerificationForm } from '@/features/auth/OtpVerificationForm';
import {
  authService,
  clearActivePhoneAttempt,
  getActivePhoneAttempt,
  setActivePhoneAttempt
} from '@/features/auth/auth-flow';
import { completeAuthenticatedSession } from '@/features/auth/session-controller';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';

export default function OtpRoute() {
  const [errorCode, setErrorCode] = useState<MessageKey | undefined>();
  const [attempt, setAttempt] = useState(getActivePhoneAttempt);
  const [now, setNow] = useState(Date.now());
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  if (!attempt) {
    return (
      <StateView
        actionLabel={translate('appShell.auth.phone.submit')}
        onAction={() => router.replace('/(public)/phone')}
        state="error"
        title={translate('appShell.auth.otp.expired')}
      />
    );
  }
  const activeAttempt = attempt;

  async function submit(code: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await authService.verifyPhone({
        sessionId: activeAttempt.sessionId,
        code
      });
      if (result.status === 'authenticated') {
        clearActivePhoneAttempt();
        router.replace(await completeAuthenticatedSession(result.session));
        return;
      }
      if (result.status === 'failed') {
        setErrorCode(
          result.errorCode === 'expired'
            ? 'appShell.auth.otp.expired'
            : result.errorCode === 'rate_limited'
              ? 'appShell.auth.otp.rateLimited'
              : 'appShell.auth.otp.invalid'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (resending || now < activeAttempt.resendAvailableAt) return;
    setResending(true);
    try {
      const next = await authService.resendPhone(activeAttempt.sessionId);
      setActivePhoneAttempt(next);
      setAttempt(next);
      setNow(Date.now());
      setErrorCode(undefined);
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate('appShell.auth.otp.title')}</StyledText>
      <SurfaceCard>
        <OtpVerificationForm
          errorCode={errorCode}
          onResend={resend}
          onSubmit={submit}
          resendAvailable={now >= activeAttempt.resendAvailableAt}
          resending={resending}
          submitting={submitting}
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
