import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
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
      <TextInput
        accessibilityLabel={translate('appShell.security.pinLabel')}
        editable={!disabled && !loading}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={setPin}
        secureTextEntry
        style={styles.input}
        value={pin}
      />
      {error ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.security.pinError')}
        </StyledText>
      ) : null}
      {errorMessage ? (
        <StyledText accessibilityRole="alert">{errorMessage}</StyledText>
      ) : null}
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
  },
  input: {
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12
  }
});
