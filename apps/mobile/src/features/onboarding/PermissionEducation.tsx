import React, { type ReactNode } from 'react';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { OnboardingScaffold } from './OnboardingScaffold';

export function PermissionEducation({
  onEnable,
  onSkip,
  primaryLabel,
  primaryLoading,
  children
}: {
  onEnable: () => void;
  onSkip: () => void;
  primaryLabel?: string;
  primaryLoading?: boolean;
  children?: ReactNode;
}) {
  return (
    <OnboardingScaffold
      onPrimary={onEnable}
      onSkip={onSkip}
      primaryLoading={primaryLoading}
      primaryLabel={primaryLabel ?? translate('appShell.permission.enable')}
      title={translate('appShell.onboarding.permission.title')}
    >
      <StyledText>
        {translate('appShell.onboarding.permission.purpose')}
      </StyledText>
      <StyledText>
        {translate('appShell.onboarding.permission.dataUse')}
      </StyledText>
      <ActionButton
        label="privacy.details"
        variant="quiet"
        onPress={() =>
          router.push({
            pathname: '/(public)/legal',
            params: { document: 'privacy' }
          })
        }
      />
      {children}
    </OnboardingScaffold>
  );
}
