import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { translate } from '@/localization/i18n';
import { isValidPin } from './privacy-lock';

interface PinFormProps {
  mode: 'create' | 'confirm' | 'change' | 'unlock' | 'reset';
  disabled?: boolean;
  errorMessage?: string;
  loading?: boolean;
  onSubmit: (pin: string) => void;
}

export function PinForm({
  disabled = false,
  errorMessage,
  loading = false,
  mode,
  onSubmit
}: PinFormProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const label =
    mode === 'unlock'
      ? translate('appShell.security.unlock')
      : translate('appShell.security.savePin');

  function submit() {
    if (!isValidPin(pin)) {
      setError(true);
      return;
    }
    setError(false);
    setPin('');
    onSubmit(pin);
  }

  return (
    <View style={styles.stack}>
      <FormField
        label="appShell.security.pinLabel"
        editable={!disabled && !loading}
        errorText={error ? 'appShell.security.pinError' : errorMessage}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={setPin}
        secureTextEntry
        value={pin}
      />
      <ActionButton
        disabled={disabled}
        label={label}
        loading={loading}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  }
});
