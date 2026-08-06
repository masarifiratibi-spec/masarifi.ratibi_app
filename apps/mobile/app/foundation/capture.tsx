/**
 * /foundation/capture — User Story 2 validation harness.
 *
 * Lets a reviewer switch between Android and iOS to confirm platform honesty,
 * permission states, fallback capture, and offline-entry handling. This is a
 * validation route, not a production screen (Scope Contract §11).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform as NativePlatform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import {
  CaptureFallbackPanel,
  type CaptureAction,
  type OfflineEntryActions
} from '@/features/foundation/CaptureFallbackPanel';
import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { minTouchTarget } from '@/design-system/tokens';
import {
  buildAndroidCapabilities,
  buildIosCapabilities
} from '@/services/mocks/platform-capabilities';
import type {
  OfflineEntry,
  PermissionStatus,
  Platform
} from '@/domain/foundation';
import { createLocalRecordsRepository } from '@/storage/local-records';
import { translate } from '@/localization/i18n';
import { permissionStatusLabel } from '@/features/foundation/permission-status-label';

const PLATFORMS: Platform[] = ['android', 'ios'];
const PERMISSION_STATES: PermissionStatus[] = [
  'not_requested',
  'denied',
  'permanently_denied',
  'granted',
  'revoked'
];
const repository = createLocalRecordsRepository();

export default function CaptureHarness() {
  const theme = useTheme();
  const [platform, setPlatform] = useState<Platform>('android');
  const [permission, setPermission] = useState<PermissionStatus>('denied');
  const [entry, setEntry] = useState<OfflineEntry | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [nativeBuildRequired, setNativeBuildRequired] = useState(false);

  const capabilities =
    platform === 'android'
      ? buildAndroidCapabilities(permission)
      : buildIosCapabilities();

  const refreshEntry = useCallback(async () => {
    const entries = await repository.list();
    setEntry(entries.at(-1) ?? null);
  }, []);

  useEffect(() => {
    if (NativePlatform.OS !== 'web') {
      void refreshEntry().catch(() => setActionFailed(true));
    }
  }, [refreshEntry]);

  const run = (operation: () => Promise<unknown>) => {
    setActionFailed(false);
    void operation()
      .then(refreshEntry)
      .catch(() => setActionFailed(true));
  };

  const handleCaptureAction = (action: CaptureAction) => {
    if (action === 'continue-permission') {
      setPermission('granted');
    } else if (action === 'manual') {
      if (NativePlatform.OS === 'web') {
        setNativeBuildRequired(true);
        return;
      }
      run(() =>
        repository.insert({
          amount: 100,
          currencyCode: 'SAR',
          categoryKey: 'manual-demo',
          note: null
        })
      );
    }
  };

  const offlineActions: OfflineEntryActions | undefined = entry
    ? {
        edit: () =>
          run(() =>
            repository.update(entry.localId, {
              ...entry.payload,
              amount: entry.payload.amount + 1
            })
          ),
        delete: () => run(() => repository.delete(entry.localId)),
        startSync: () =>
          run(() => repository.transition(entry.localId, 'syncing')),
        confirmSync: () =>
          run(() => repository.transition(entry.localId, 'synced')),
        failSync: () =>
          run(() => repository.transition(entry.localId, 'failed')),
        conflictSync: () =>
          run(() => repository.transition(entry.localId, 'conflict')),
        retry: () => run(() => repository.transition(entry.localId, 'pending'))
      }
    : undefined;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        horizontal
        contentContainerStyle={styles.platformBar}
        showsHorizontalScrollIndicator={false}
      >
        {PLATFORMS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPlatform(p)}
            accessibilityRole="button"
            accessibilityLabel={
              p === 'android'
                ? translate('common.android')
                : translate('common.ios')
            }
            style={[
              styles.platformButton,
              {
                borderColor: theme.colors.border,
                backgroundColor:
                  platform === p ? theme.colors.primary : theme.colors.surface,
                minHeight: minTouchTarget
              }
            ]}
          >
            <StyledText
              variant="body"
              style={{
                color:
                  platform === p
                    ? theme.colors.textInverse
                    : theme.colors.textPrimary
              }}
            >
              {p === 'android'
                ? translate('common.android')
                : translate('common.ios')}
            </StyledText>
          </Pressable>
        ))}
      </ScrollView>

      {platform === 'android' && (
        <ScrollView
          horizontal
          contentContainerStyle={styles.permissionBar}
          showsHorizontalScrollIndicator={false}
        >
          {PERMISSION_STATES.map((status) => (
            <Pressable
              key={status}
              onPress={() => setPermission(status)}
              accessibilityRole="radio"
              accessibilityLabel={permissionStatusLabel(status)}
              accessibilityState={{ selected: permission === status }}
              style={[
                styles.platformButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor:
                    permission === status
                      ? theme.colors.primary
                      : theme.colors.surface,
                  minHeight: minTouchTarget
                }
              ]}
            >
              <StyledText
                variant="caption"
                style={{
                  color:
                    permission === status
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary
                }}
              >
                {permissionStatusLabel(status)}
              </StyledText>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {actionFailed && (
        <StyledText variant="body" style={styles.error}>
          {translate('capture.offline.actionFailed')}
        </StyledText>
      )}
      {nativeBuildRequired && (
        <StyledText variant="body" style={styles.error}>
          {translate('capture.offline.nativeBuildRequired')}
        </StyledText>
      )}
      <CaptureFallbackPanel
        capabilities={capabilities}
        platform={platform}
        onAction={handleCaptureAction}
        offlineEntry={entry}
        offlineActions={offlineActions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  platformBar: { flexDirection: 'row', gap: 8, padding: 16 },
  permissionBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  error: { paddingHorizontal: 16 },
  platformButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
