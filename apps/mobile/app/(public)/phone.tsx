import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PhoneAuthForm } from '@/features/auth/PhoneAuthForm';
import { StyledText } from '@/components/StyledText';
import { authService, setActivePhoneAttempt } from '@/features/auth/auth-flow';
import type { PhoneInput } from '@/features/auth/phone-validation';
import { translate } from '@/localization/i18n';

export default function PhoneRoute() {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(input: PhoneInput) {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const attempt = await authService.startPhone(input);
      setActivePhoneAttempt(attempt);
      router.push('/(public)/otp');
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.stack}>
      <PhoneAuthForm loading={loading} onSubmit={submit} />
      {failed ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.unknown')}
        </StyledText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    padding: 16
  }
});
