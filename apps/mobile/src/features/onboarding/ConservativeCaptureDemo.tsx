import React from 'react';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { OnboardingScaffold } from './OnboardingScaffold';

export function ConservativeCaptureDemo() {
  return (
    <OnboardingScaffold title={translate('appShell.onboarding.conservative.title')}>
      <ActionButton label={translate('capture.manual')} onPress={() => router.push('/(tabs)/add')} variant="secondary" />
      <ActionButton label={translate('capture.voice')} onPress={() => router.push('/(tabs)/add?mode=voice')} variant="secondary" />
    </OnboardingScaffold>
  );
}
