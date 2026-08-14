import React, { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';

import { PermissionEducation } from '@/features/onboarding/PermissionEducation';
import { createTrackingPermissionService } from '@/services/platform/tracking-permission-service';
import { StyledText } from '@/components/StyledText';
import type { PermissionState } from '@/domain/app-shell';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function AndroidSmsPermissionRoute() {
  const service = useMemo(createTrackingPermissionService, []);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [error, setError] = useState(false);
  const advanceOnboarding = useAppShellStore(
    (state) => state.advanceOnboarding
  );
  const requiresSettings = permission?.recoveryAction === 'open_settings';

  useEffect(() => {
    const refresh = () =>
      void service
        .getState()
        .then(setPermission)
        .catch(() => setError(true));
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [service]);

  async function enable() {
    setError(false);
    try {
      const result = await service.requestAfterEducation();
      setPermission(result);
      if (result.status === 'granted') await continueWithTracking();
    } catch {
      setError(true);
    }
  }

  async function openSettings() {
    setError(false);
    try {
      await service.openSettings();
    } catch {
      setError(true);
    }
  }

  async function continueWithTracking() {
    const progress = await advanceOnboarding(
      ['permission_education', 'permission_request'],
      'completed'
    );
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  async function skip() {
    const progress = await advanceOnboarding(
      ['permission_education', 'permission_request', 'keywords', 'preference'],
      'skipped'
    );
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  return (
    <>
      <PermissionEducation
        onEnable={
          requiresSettings
            ? openSettings
            : permission?.status === 'granted'
              ? continueWithTracking
              : enable
        }
        onSkip={skip}
        primaryLabel={
          permission?.status === 'granted'
            ? translate('appShell.onboarding.continue')
            : requiresSettings
              ? translate('appShell.permission.openSettings')
              : permission?.status === 'denied'
                ? translate('appShell.permission.retry')
                : undefined
        }
      />
      {permission ? (
        <StyledText accessibilityRole="alert">
          {translate(
            `appShell.permission.status.${statusKey(permission.status)}` as never
          )}
        </StyledText>
      ) : null}
      {error ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.unknown')}
        </StyledText>
      ) : null}
    </>
  );
}

function statusKey(status: string) {
  return status.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
}
