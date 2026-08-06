/**
 * CaptureFallbackPanel — proves User Story 2.
 *
 * Shows honest platform capability states, optional permission education with
 * skip/recovery, manual and voice fallbacks, and offline-entry status. Denial
 * never blocks the core app (Constitution Principle II, UI Contract §2-3).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { minTouchTarget } from '@/design-system/tokens';
import type {
  CaptureMethod,
  OfflineEntry,
  Platform
} from '@/domain/foundation';
import type { PlatformCapabilityService } from '@/services/contracts/foundation-service';
import { permissionStatusLabel } from './permission-status-label';
import { currentLocale, translate } from '@/localization/i18n';
import { formatAmount } from '@/utils/format-financial-value';

export interface CaptureFallbackPanelProps {
  capabilities: PlatformCapabilityService;
  platform: Platform;
  onAction?: (action: CaptureAction) => void;
  offlineEntry?: OfflineEntry | null;
  offlineActions?: OfflineEntryActions;
}

export type CaptureAction =
  'continue-permission' | 'skip-permission' | 'manual' | 'voice';

export interface OfflineEntryActions {
  edit: () => void;
  delete: () => void;
  startSync: () => void;
  confirmSync: () => void;
  failSync: () => void;
  conflictSync: () => void;
  retry: () => void;
}

export function CaptureFallbackPanel({
  capabilities,
  platform,
  onAction = () => undefined,
  offlineEntry = null,
  offlineActions
}: CaptureFallbackPanelProps) {
  const theme = useTheme();
  const sms = capabilities
    .listCapabilities(platform)
    .find((c) => c.id === 'sms-tracking');
  const permission = capabilities.listPermissions(platform)[0];
  const methods = capabilities
    .listCaptureMethods(platform)
    .filter(isFallbackMethod);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title">{translate('capture.title')}</StyledText>

      {platform === 'ios' && <IosSmsNotice />}
      {platform === 'android' && sms && permission && (
        <SmsCapabilityCard
          titleKey="capture.sms.title"
          purposeKey="capture.sms.purpose"
          dataUseKey="capture.sms.dataUse"
          statusLabel={permissionStatusLabel(permission.status)}
          onAction={onAction}
        />
      )}

      <View style={styles.methods}>
        {methods.map((method) => (
          <CaptureMethodRow
            key={method.kind}
            kind={method.kind}
            onPress={() => onAction(method.kind)}
          />
        ))}
      </View>

      {offlineEntry && offlineActions && (
        <OfflineEntryCard entry={offlineEntry} actions={offlineActions} />
      )}
    </ScrollView>
  );
}

function OfflineEntryCard({
  entry,
  actions
}: {
  entry: OfflineEntry;
  actions: OfflineEntryActions;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        }
      ]}
    >
      <StyledText variant="subtitle">
        {translate('capture.offline.title')}
      </StyledText>
      <StyledText variant="amount">
        {formatAmount(
          entry.payload.amount,
          entry.payload.currencyCode,
          currentLocale()
        )}
      </StyledText>
      <StyledText variant="body">
        {offlineStatusLabel(entry.syncStatus)}
      </StyledText>
      <View style={styles.actions}>
        {offlineButtons(entry.syncStatus, actions)}
      </View>
    </View>
  );
}

function offlineStatusLabel(status: OfflineEntry['syncStatus']): string {
  if (status === 'pending') return translate('capture.offline.saved');
  if (status === 'syncing') return translate('capture.offline.syncing');
  if (status === 'synced') return translate('capture.offline.synced');
  if (status === 'failed') return translate('capture.offline.failed');
  return translate('capture.offline.conflict');
}

function offlineButtons(
  status: OfflineEntry['syncStatus'],
  actions: OfflineEntryActions
) {
  if (status === 'pending') {
    return (
      <>
        <ActionButton
          label={translate('capture.offline.edit')}
          onPress={actions.edit}
        />
        <ActionButton
          label={translate('capture.offline.delete')}
          onPress={actions.delete}
        />
        <ActionButton
          label={translate('capture.offline.startSync')}
          onPress={actions.startSync}
          primary
        />
      </>
    );
  }
  if (status === 'syncing') {
    return (
      <>
        <ActionButton
          label={translate('capture.offline.confirmSync')}
          onPress={actions.confirmSync}
          primary
        />
        <ActionButton
          label={translate('capture.offline.failSync')}
          onPress={actions.failSync}
        />
        <ActionButton
          label={translate('capture.offline.conflictSync')}
          onPress={actions.conflictSync}
        />
      </>
    );
  }
  if (status === 'failed' || status === 'conflict') {
    return (
      <ActionButton
        label={translate('capture.offline.retry')}
        onPress={actions.retry}
        primary
      />
    );
  }
  return null;
}

type FallbackCaptureKind = 'manual' | 'voice';

function isFallbackMethod(method: CaptureMethod): method is CaptureMethod & {
  kind: FallbackCaptureKind;
} {
  return method.kind === 'manual' || method.kind === 'voice';
}

function IosSmsNotice() {
  const theme = useTheme();
  return (
    <View
      style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted }]}
    >
      <StyledText variant="body">{translate('capture.ios.noSms')}</StyledText>
      <StyledText variant="body">
        {translate('capture.ios.alternatives')}
      </StyledText>
    </View>
  );
}

interface SmsCapabilityCardProps {
  titleKey: 'capture.sms.title';
  purposeKey: 'capture.sms.purpose';
  dataUseKey: 'capture.sms.dataUse';
  statusLabel: string;
  onAction: (action: CaptureAction) => void;
}

function SmsCapabilityCard({
  titleKey,
  purposeKey,
  dataUseKey,
  statusLabel,
  onAction
}: SmsCapabilityCardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        }
      ]}
    >
      <StyledText variant="subtitle">{translate(titleKey)}</StyledText>
      <StyledText variant="body">{translate(purposeKey)}</StyledText>
      <StyledText variant="caption">{translate(dataUseKey)}</StyledText>
      <StyledText variant="body" accessibilityLabel={statusLabel}>
        {statusLabel}
      </StyledText>
      <View style={styles.actions}>
        <ActionButton
          label={translate('capture.sms.continue')}
          onPress={() => onAction('continue-permission')}
          primary
        />
        <ActionButton
          label={translate('capture.sms.skip')}
          onPress={() => onAction('skip-permission')}
        />
      </View>
    </View>
  );
}

function CaptureMethodRow({
  kind,
  onPress
}: {
  kind: 'manual' | 'voice';
  onPress: () => void;
}) {
  const label =
    kind === 'manual'
      ? translate('capture.manual')
      : translate('capture.voice');
  return <ActionButton label={label} onPress={onPress} />;
}

function ActionButton({
  label,
  onPress,
  primary
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: primary
            ? theme.colors.primary
            : theme.colors.surface,
          borderColor: theme.colors.border,
          minHeight: minTouchTarget
        }
      ]}
    >
      <Text
        style={{
          color: primary ? theme.colors.textInverse : theme.colors.textPrimary,
          fontSize: theme.typography.body
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  notice: { padding: 12, borderRadius: 10, gap: 4 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6
  },
  methods: { gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
