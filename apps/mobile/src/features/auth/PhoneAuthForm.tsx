import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { translate } from '@/localization/i18n';
import {
  validatePhoneInput,
  type PhoneInput
} from '@/features/auth/phone-validation';

interface PhoneAuthFormProps {
  loading?: boolean;
  onSubmit: (input: PhoneInput) => void;
}

export function PhoneAuthForm({ loading = false, onSubmit }: PhoneAuthFormProps) {
  const [countryCode, setCountryCode] = useState('+20');
  const [phoneValue, setPhoneValue] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function submit() {
    const result = validatePhoneInput({ countryCode, phoneValue });
    if (!result.success) {
      setErrorKey(result.errorCode);
      return;
    }
    setErrorKey(null);
    onSubmit(result.data);
  }

  return (
    <View style={styles.stack}>
      <FormField
        label={translate('appShell.auth.phone.countryCode')}
        onChangeText={setCountryCode}
        value={countryCode}
        variant="phone"
      />
      <FormField
        errorText={errorKey ? translate(errorKey as never) : undefined}
        label={translate('appShell.auth.phone.number')}
        onChangeText={setPhoneValue}
        value={phoneValue}
        variant="phone"
      />
      <ActionButton
        label={translate('appShell.auth.phone.submit')}
        loading={loading}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  }
});
