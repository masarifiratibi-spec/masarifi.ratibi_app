import React from 'react';

import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { OnboardingScaffold } from './OnboardingScaffold';

export function PermissionEducation({
  onEnable,
  onSkip,
  primaryLabel
}: {
  onEnable: () => void;
  onSkip: () => void;
  primaryLabel?: string;
}) {
  return (
    <OnboardingScaffold
      onPrimary={onEnable}
      onSkip={onSkip}
      primaryLabel={primaryLabel ?? translate('appShell.permission.enable')}
      title={translate('appShell.onboarding.permission.title')}
    >
      <StyledText>{translate('appShell.onboarding.permission.purpose')}</StyledText>
      <StyledText>{translate('appShell.onboarding.permission.dataUse')}</StyledText>
      <StyledText>{translate('appShell.onboarding.permission.benefit')}</StyledText>
      <StyledText>{translate('appShell.onboarding.permission.denial')}</StyledText>
      <StyledText>{translate('capture.permission.disable')}</StyledText>
      <StyledText>{translate('trust.review')}</StyledText>
    </OnboardingScaffold>
  );
}
