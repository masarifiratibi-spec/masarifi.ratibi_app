import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { ProfileCompletionStep } from '@/domain/app-shell';
import { translate } from '@/localization/i18n';

interface ProfileCompletionCardProps {
  steps: ProfileCompletionStep[];
  onDismiss: () => void;
  reopened?: boolean;
}

const labelByStep: Record<ProfileCompletionStep['id'], string> = {
  name: 'appShell.profile.name',
  first_account: 'appShell.profile.firstAccount',
  salary: 'appShell.profile.salary',
  budget: 'appShell.profile.budget',
  obligation: 'appShell.profile.obligation',
  savings_goal: 'appShell.profile.savingsGoal'
};

export function ProfileCompletionCard({ steps, onDismiss }: ProfileCompletionCardProps) {
  const incomplete = steps.filter((step) => step.status === 'incomplete');
  if (incomplete.length === 0) return null;

  return (
    <View style={styles.stack}>
      <StyledText variant="subtitle">{translate('appShell.shell.progressiveSetup')}</StyledText>
      {incomplete.map((step) => (
        <ActionButton
          key={step.id}
          label={translate(labelByStep[step.id] as never)}
          onPress={() => router.push(step.destination)}
          variant="secondary"
        />
      ))}
      <ActionButton
        label={translate('appShell.profile.dismiss')}
        onPress={onDismiss}
        variant="quiet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  }
});
