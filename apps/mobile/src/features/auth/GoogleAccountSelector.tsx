import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { mapAppShellError } from '@/features/shell/app-shell-errors';
import { translate } from '@/localization/i18n';
import { GoogleBrandIcon } from './GoogleBrandIcon';
import { colorTokens } from '@/design-system/tokens';
import type { MessageKey } from '@/localization/messages/en';
import type {
  AuthResult,
  ReverificationInput
} from '@/services/contracts/app-shell-service';

interface GoogleAccountSelectorProps {
  signIn: () => Promise<AuthResult>;
  reverify?: (input: ReverificationInput) => Promise<AuthResult>;
  onResult: (result: AuthResult) => void | Promise<void>;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  lifecycleMessage?: MessageKey;
}

export function GoogleAccountSelector({
  signIn,
  reverify,
  onResult,
  label,
  loading = false,
  disabled = false,
  lifecycleMessage
}: GoogleAccountSelectorProps) {
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null);
  const [conflict, setConflict] = useState<Extract<
    AuthResult,
    { status: 'conflict' }
  > | null>(null);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setMessageKey(null);
    try {
      const result = await signIn();

      if (result.status === 'authenticated') {
        await onResult(result);
        return;
      }
      if (result.status === 'cancelled') {
        setMessageKey('appShell.auth.google.cancelled');
        return;
      }
      if (result.status === 'conflict') {
        setConflict(result);
        setMessageKey('appShell.auth.conflict.title');
        return;
      }
      setMessageKey(
        mapAppShellError(new Error(result.errorCode)).code as MessageKey
      );
    } catch (error) {
      setMessageKey(
        error instanceof Error && error.message === 'googleAuth.incomplete'
          ? 'googleAuth.incomplete'
          : 'appShell.error.unknown'
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function confirmConflict() {
    if (!conflict || !reverify || pending) return;
    setPending(true);
    const result = await reverify({
      conflictId: conflict.conflictId,
      method: conflict.existingMethod,
      verificationToken: 'mock-reverified'
    });
    setPending(false);
    if (result.status === 'authenticated') {
      setConflict(null);
      onResult(result);
      return;
    }
    setMessageKey('appShell.auth.conflict.body');
  }

  return (
    <View style={styles.stack}>
      {lifecycleMessage || messageKey ? (
        <StyledText accessibilityRole="alert" accessibilityLiveRegion="polite">
          {translate(lifecycleMessage ?? messageKey!)}
        </StyledText>
      ) : null}
      <ActionButton
        label={label ?? translate('appShell.auth.google.choose')}
        icon={<GoogleBrandIcon />}
        variant="secondary"
        style={{
          backgroundColor: colorTokens.google.surface,
          borderColor: colorTokens.google.border
        }}
        labelStyle={{ color: colorTokens.google.content }}
        loading={pending || loading}
        disabled={disabled}
        onPress={submit}
      />
      {conflict && reverify ? (
        <ActionButton
          label={translate('appShell.auth.conflict.reverify')}
          loading={pending}
          onPress={confirmConflict}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  }
});
