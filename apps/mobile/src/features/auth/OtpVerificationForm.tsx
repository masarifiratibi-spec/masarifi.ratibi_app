import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';

interface OtpVerificationFormProps {
  errorCode?: MessageKey;
  resending?: boolean;
  resendAvailable: boolean;
  submitting?: boolean;
  onResend: () => void;
  onSubmit: (code: string) => void;
}

export function OtpVerificationForm({
  errorCode,
  resending = false,
  resendAvailable,
  submitting = false,
  onResend,
  onSubmit
}: OtpVerificationFormProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const submittedCode = useRef<string | null>(null);
  const code = digits.join('');

  function updateDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    const next = [...digits];
    if (clean.length > 1) {
      clean.split('').forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    } else {
      next[index] = clean;
    }
    submittedCode.current = null;
    setDigits(next.slice(0, 6));
  }

  function submit() {
    if (code.length !== 6 || submittedCode.current === code) return;
    submittedCode.current = code;
    onSubmit(code);
  }

  return (
    <View style={styles.stack}>
      <View testID="otp-slots" style={styles.slots}>
        {digits.map((digit, index) => (
          <TextInput
            accessibilityLabel={`${translate('appShell.auth.otp.code')} ${index + 1}`}
            key={index}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => updateDigit(index, value)}
            style={styles.slot}
            value={digit}
          />
        ))}
      </View>
      {errorCode ? (
        <StyledText accessibilityRole="alert">{translate(errorCode)}</StyledText>
      ) : null}
      <ActionButton
        label={translate('appShell.auth.otp.submit')}
        loading={submitting}
        onPress={submit}
      />
      <ActionButton
        disabled={!resendAvailable}
        label={translate(
          resendAvailable
            ? 'appShell.auth.otp.resend'
            : 'appShell.auth.otp.wait'
        )}
        onPress={onResend}
        loading={resending}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  slots: {
    direction: 'ltr',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    width: '100%'
  },
  slot: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
    textAlign: 'center'
  }
});
