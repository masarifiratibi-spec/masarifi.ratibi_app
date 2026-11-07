import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import { resyncAutomaticTracking } from '@/services/automatic-tracking-coordinator';
import { AppState } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import type { PermissionState } from '@/domain/app-shell';
import type {
  TrackingMode,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import { PermissionEducation } from '@/features/onboarding/PermissionEducation';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { createTrackingPermissionService } from '@/services/platform/tracking-permission-service';
import { useAppShellStore } from '@/state/app-shell';
import { captureTrackingAdmission } from '@/state/tracking-admission';
import { trackingSourcePreferences } from '@/services/tracking-source-preferences';

export default function TrackingPermissionRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const queryClient = useQueryClient();
  const selectedMode: TrackingMode =
    mode === 'review_all' ? 'review_all' : 'automatic_clear';
  const service = useMemo(createTrackingPermissionService, []);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [failed, setFailed] = useState(false);
  const requiresSettings = permission?.recoveryAction === 'open_settings';

  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const waitingForSettings = useRef<(() => void) | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const activate = useCallback(
    async (check: () => void) => {
      check();
      const statusKey = automaticTrackingReadKey(
        automaticTrackingKeys.status,
        owner
      );
      if (
        queryClient.getQueryData<TrackingStatusSnapshot>(statusKey)?.mode ===
        'paused'
      ) {
        await bankNotificationService.setCaptureEnabled(false);
        check();
        await trackingSourcePreferences.set('notification', false);
        check();
      }
      await automaticTrackingService.setMode(selectedMode);
      check();
      await trackingSourcePreferences.set('sms', true);
      check();
      void resyncAutomaticTracking()
        .finally(() =>
          queryClient.invalidateQueries({ queryKey: statusKey, exact: true })
        )
        .catch(() => undefined);
      router.dismissTo('/tracking');
    },
    [selectedMode, owner, queryClient]
  );

  function captureIntent() {
    const admission = captureTrackingAdmission(owner ?? undefined);
    return () => {
      admission();
      if (
        !mounted.current ||
        (useAppShellStore.getState().session?.userId ?? null) !== owner
      )
        throw new Error('tracking_source_context_changed');
    };
  }

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const refresh = async (returnedFromSettings: boolean) => {
      const state = await service.getState();
      if (!active) return;
      setPermission(state);
      const check = waitingForSettings.current;
      if (returnedFromSettings && check) {
        waitingForSettings.current = null;
        if (state.status === 'granted') {
          inFlight.current = true;
          try {
            await activate(check);
          } finally {
            inFlight.current = false;
          }
        }
      }
    };
    const refreshSafely = (returned: boolean) =>
      void refresh(returned).catch(() => {
        if (active) setFailed(true);
      });
    refreshSafely(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshSafely(true);
    });
    return () => {
      active = false;
      mounted.current = false;
      waitingForSettings.current = null;
      subscription.remove();
    };
  }, [service, owner, activate]);

  async function enable() {
    if (inFlight.current || waitingForSettings.current) return;
    inFlight.current = true;
    setFailed(false);
    try {
      const check = captureIntent();
      const result = await service.getState();
      check();
      if (result.recoveryAction === 'open_settings') {
        waitingForSettings.current = check;
        await service.openSettings();
        return;
      }
      const permission =
        result.status === 'granted'
          ? result
          : await service.requestAfterEducation();
      check();
      setPermission(permission);
      if (permission.status === 'granted') await activate(check);
    } catch {
      waitingForSettings.current = null;
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <>
      <PermissionEducation
        onEnable={enable}
        onSkip={() => {
          mounted.current = false;
          waitingForSettings.current = null;
          router.dismissTo('/tracking');
        }}
        primaryLabel={
          requiresSettings
            ? translate('appShell.permission.openSettings')
            : permission?.status === 'granted'
              ? translate('appShell.onboarding.continue')
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
      {failed ? (
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
