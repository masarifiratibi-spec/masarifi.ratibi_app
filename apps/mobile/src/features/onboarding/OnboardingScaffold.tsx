import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { translate } from '@/localization/i18n';

interface OnboardingScaffoldProps {
  title: string;
  children?: ReactNode;
  currentStep?: number;
  totalSteps?: number;
  primaryLabel?: string;
  onPrimary?: () => void;
  onSkip?: () => void;
}

export function OnboardingScaffold({
  title,
  children,
  currentStep,
  totalSteps,
  primaryLabel = translate('appShell.onboarding.continue'),
  onPrimary,
  onSkip
}: OnboardingScaffoldProps) {
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
        {currentStep && totalSteps ? (
          <StyledText variant="caption">
            {translate('appShell.onboarding.progress')
              .replace('{{current}}', String(currentStep))
              .replace('{{total}}', String(totalSteps))}
          </StyledText>
        ) : null}
        <StyledText variant="title">{title}</StyledText>
        {children ? <SurfaceCard style={styles.body}>{children}</SurfaceCard> : null}
        {onPrimary ? <ActionButton label={primaryLabel} onPress={onPrimary} /> : null}
        {onSkip ? (
          <ActionButton
            label={translate('appShell.onboarding.skip')}
            onPress={onSkip}
            variant="secondary"
          />
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  content: {
    gap: 14,
    padding: 16
  },
  body: {
    gap: 10
  }
});
