import React, { useState } from 'react';
import { View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { isValidPin } from './privacy-lock';

interface PinFormProps {
  disabled?: boolean;
  errorMessage?: string;
  loading?: boolean;
  onSubmit: (pin: string) => void | Promise<void>;
}

export function PinForm({
  disabled = false,
  errorMessage,
  loading = false,
  onSubmit
}: PinFormProps) {
  const [pin, setPin] = useState('');

  async function submit() {
    if (disabled || loading || !isValidPin(pin)) return;
    const submittedPin = pin;
    try {
      await onSubmit(submittedPin);
    } finally {
      setPin('');
    }
  }

  return (
    <View>
      <FormField
        editable={!disabled && !loading}
        errorText={errorMessage}
        keyboardType="number-pad"
        label="appShell.auth.otp.code"
        maxLength={6}
        onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
        secureTextEntry
        value={pin}
        variant="otp"
      />
      <ActionButton
        disabled={disabled || !isValidPin(pin)}
        label="appShell.auth.otp.submit"
        loading={loading}
        onPress={submit}
      />
    </View>
  );
}
