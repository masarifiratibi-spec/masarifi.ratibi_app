import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTrackingStatus } from './useAutomaticTracking';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createTrackingPermissionService } from '@/services/platform/tracking-permission-service';

export function TrackingStatusScreen() {
  const query = useTrackingStatus();
  const refetchTrackingStatus = query.refetch;
  const permissionService = useMemo(createTrackingPermissionService, []);
  const [updating, setUpdating] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetchTrackingStatus();
    });
    return () => subscription.remove();
  }, [refetchTrackingStatus]);

  async function recoverPermission(status: string | null) {
    setActionFailed(false);
    try {
      if (status === 'revoked' || status === 'permanently_denied') {
        await permissionService.openSettings();
      } else {
        await permissionService.requestAfterEducation();
        await query.refetch();
      }
    } catch {
      setActionFailed(true);
    }
  }

  async function setMode(mode: 'paused' | 'automatic_clear') {
    setActionFailed(false);
    setUpdating(true);
    try {
      await automaticTrackingService.setMode(mode);
      await query.refetch();
    } catch {
      setActionFailed(true);
    } finally {
      setUpdating(false);
    }
  }
  if (query.isLoading)
    return (
      <StateView state="loading" title={translate('tracking.state.loading')} />
    );
  if (query.isError || !query.data)
    return (
      <StateView
        state="error"
        title={translate('tracking.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  const status = query.data;
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('tracking.status.title')}
      </StyledText>
      <SurfaceCard>
        <View style={styles.stack}>
          <Row
            label="tracking.status.mode"
            value={`tracking.mode.${status.mode}`}
          />
          <Row
            label="tracking.status.permission"
            value={`tracking.permission.${status.permissionStatus ?? 'unavailable'}`}
          />
          <Row
            label="tracking.status.service"
            value={`tracking.service.${status.serviceState}`}
          />
          <Row
            label="tracking.status.detected"
            value={String(status.detectedThisMonth)}
            raw
          />
          <Row
            label="tracking.status.review"
            value={String(status.reviewCount)}
            raw
          />
          <Row
            label="tracking.status.keywords"
            value={String(status.activeKeywordCount)}
            raw
          />
          <Row
            label="tracking.status.senders"
            value={String(status.activeSenderCount)}
            raw
          />
        </View>
      </SurfaceCard>
      <TrackingRecoveryPanel
        permission={status.permissionStatus}
        service={status.serviceState}
        onRecoverPermission={() =>
          void recoverPermission(status.permissionStatus)
        }
      />
      {actionFailed ? (
        <StyledText accessibilityRole="alert">
          {translate('tracking.state.error')}
        </StyledText>
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          label={translate('tracking.action.demo')}
          onPress={() => router.push('/tracking/demo')}
        />
        <ActionButton
          label={translate('tracking.action.review')}
          onPress={() => router.push('/tracking/review')}
          variant="secondary"
        />
        <ActionButton
          label={translate('tracking.action.history')}
          onPress={() => router.push('/tracking/history')}
          variant="secondary"
        />
        <ActionButton
          label={translate('tracking.action.keywords')}
          onPress={() => router.push('/tracking/keywords')}
          variant="secondary"
        />
        <ActionButton
          label={translate('tracking.action.senders')}
          onPress={() => router.push('/tracking/senders')}
          variant="secondary"
        />
        <ActionButton
          disabled={updating}
          label={translate('tracking.action.pause')}
          loading={updating}
          onPress={() => void setMode('paused')}
          variant="secondary"
        />
        <ActionButton
          disabled={updating}
          label={translate('tracking.action.resume')}
          loading={updating}
          onPress={() => void setMode('automatic_clear')}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

export function TrackingRecoveryPanel({
  permission,
  service,
  onRecoverPermission
}: {
  permission: string | null;
  service: string;
  onRecoverPermission?: () => void;
}) {
  if (permission === 'granted' && service === 'healthy') return null;
  return (
    <SurfaceCard>
      <StyledText>{translate('tracking.recovery.message')}</StyledText>
      {permission !== 'granted' && onRecoverPermission ? (
        <ActionButton
          label={translate(
            permission === 'revoked' || permission === 'permanently_denied'
              ? 'appShell.permission.openSettings'
              : 'appShell.permission.retry'
          )}
          onPress={onRecoverPermission}
        />
      ) : null}
      <ActionButton
        label={translate('tracking.action.manual')}
        onPress={() => router.push('/(tabs)/add')}
        variant="secondary"
      />
    </SurfaceCard>
  );
}

function Row({
  label,
  value,
  raw = false
}: {
  label: string;
  value: string;
  raw?: boolean;
}) {
  return (
    <View>
      <StyledText variant="caption">{translate(label as never)}</StyledText>
      <StyledText>{raw ? value : translate(value as never)}</StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  actions: { gap: 8 }
});
