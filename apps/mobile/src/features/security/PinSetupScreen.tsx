import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import type { PinCredential } from '@/domain/app-shell';
import { translate } from '@/localization/i18n';
import { PinForm } from './PinForm';
import { createPinCredential, verifyPin } from './privacy-lock';

interface PinSetupScreenProps {
  currentCredential?: PinCredential | null;
  mode: 'create' | 'change';
  onInvalidCurrent?: () => void | Promise<void>;
  onSave: (credential: PinCredential) => void | Promise<void>;
}

export function PinSetupScreen({
  currentCredential = null,
  mode,
  onInvalidCurrent,
  onSave
}: PinSetupScreenProps) {
  const [stage, setStage] = useState<'current' | 'new' | 'confirm'>(
    mode === 'change' ? 'current' : 'new'
  );
  const [firstPin, setFirstPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  const title =
    stage === 'current'
      ? 'appShell.security.pin.current'
      : stage === 'confirm'
        ? 'appShell.security.pin.confirm'
        : 'appShell.security.pin.create';

  async function submit(pin: string) {
    setErrorMessage(undefined);
    if (stage === 'current') {
      if (!currentCredential || !(await verifyPin(pin, currentCredential))) {
        await onInvalidCurrent?.();
        setErrorMessage(translate('appShell.security.pin.invalid'));
        return;
      }
      setStage('new');
      return;
    }
    if (stage === 'new') {
      setFirstPin(pin);
      setStage('confirm');
      return;
    }

    setLoading(true);
    try {
      const result = await createPinCredential(firstPin, pin);
      if ('error' in result) {
        setErrorMessage(translate('appShell.security.pin.mismatch'));
        return;
      }
      await onSave(result.credential);
      setFirstPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate(title)}</StyledText>
      <PinForm
        errorMessage={errorMessage}
        loading={loading}
        onSubmit={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    padding: 24
  }
});
