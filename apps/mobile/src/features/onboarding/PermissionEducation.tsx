import React, { type ReactNode } from 'react';

import { StyledText } from '@/components/StyledText';
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
      <StyledText>
        {translate('appShell.onboarding.permission.benefit')}
      </StyledText>
      <StyledText>
        {translate('appShell.onboarding.permission.denial')}
      </StyledText>
      <StyledText>{translate('capture.permission.disable')}</StyledText>
      <StyledText>{translate('trust.review')}</StyledText>
      {children}
    </OnboardingScaffold>
  );
}
