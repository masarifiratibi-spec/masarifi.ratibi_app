import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PhoneAuthForm } from '@/features/auth/PhoneAuthForm';
import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
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
      <StyledText variant="title">{translate('appShell.auth.phone.title')}</StyledText>
      <SurfaceCard>
        <PhoneAuthForm loading={loading} onSubmit={submit} />
      </SurfaceCard>
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
    gap: 12,
    padding: 16
  }
});
