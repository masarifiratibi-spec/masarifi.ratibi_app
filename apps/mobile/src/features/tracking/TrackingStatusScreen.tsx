import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import { StyledText } from '@/components/StyledText';
import { layoutDirectionStyle } from '@/design-system/direction';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { Toggle } from '@/design-system/components/forms/SelectionControls';
import { DesignIcon } from '@/design-system/icons';
import {
  useAutomaticTrackingSyncState,
  useTrackingStatus,
  useKeywordRules
} from './useAutomaticTracking';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { createTrackingPermissionService } from '@/services/platform/tracking-permission-service';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import {
  trackingSourcePreferences,
  type TrackingSourceState
} from '@/services/tracking-source-preferences';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { useAppShellStore } from '@/state/app-shell';
import {
  captureTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { useTheme } from '@/state/theme-context';
import {
  lightThemeColors,
  darkThemeColors,
  type ThemeColors,
  radius,
  spacing
} from '@/design-system/tokens';
import type { KeywordRule } from '@/domain/app-shell';
import type {
  TrackingMode,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import { trackingKeywordConfiguration } from '@/services/tracking-keyword-configuration';
import { TrackingKeywordChips } from './components/TrackingKeywordChips';
import { TrackingDemoNotice } from './components/TrackingDemoNotice';
import {
  setTrackingSourceFailure,
  setTrackingSourceIntent,
  useTrackingSourceCommands
} from './tracking-source-command-state';
import {
  syncAutomaticTracking,
  resyncAutomaticTracking,
  type AutomaticTrackingSyncState
} from '@/services/automatic-tracking-coordinator';

export function TrackingStatusScreen() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const admission = useTrackingAdmission();
  if (!admission.ready)
    return (
      <StateView
        state="error"
        title={translate(
          admission.isolatedForOwnerId
            ? 'tracking.isolated.title'
            : 'tracking.unverified.title'
        )}
        message={translate(
          admission.isolatedForOwnerId
            ? 'tracking.isolated.message'
            : 'tracking.unverified.message'
        )}
      />
    );
  return <TrackingStatusContent key={ownerId} />;
}

function TrackingStatusContent() {
  const { colors, mode: themeMode } = useTheme();
  const styles = themedStyles[themeMode];
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const statusKey = automaticTrackingReadKey(
    automaticTrackingKeys.status,
    ownerId
  );
  const keywordsKey = useMemo(
    () => automaticTrackingReadKey(automaticTrackingKeys.keywords(), ownerId),
    [ownerId]
  );
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const query = useTrackingStatus();
  const keywords = useKeywordRules();
  const queryClient = useQueryClient();
  const syncState = useAutomaticTrackingSyncState();
  const refetchTrackingStatus = query.refetch;
  const permissionService = useMemo(createTrackingPermissionService, []);

  const [isUpdating, setUpdating] = useState(false);
  const updating = isUpdating;
  const { scope: sourceCommands, snapshot: sourceSnapshot } =
    useTrackingSourceCommands(ownerId);
  const sourceIntents = sourceSnapshot.intents;
  const contentMounted = useRef(true);
  const [actionFailed, setActionFailed] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const keywordRules = useMemo(() => keywords.data ?? [], [keywords.data]);
  const keywordLoadState = hasReadableSnapshot(keywords)
    ? 'ready'
    : keywords.isLoading
      ? 'loading'
      : 'error';
  const awaitingNotificationAccess = useRef<{
    assertCurrent: () => void;
    isCurrent: () => boolean;
  } | null>(null);
  const awaitingSmsAccess =
    useRef<typeof awaitingNotificationAccess.current>(null);
  const loadKeywords = keywords.refetch;
  const queueSourceChangeRef = useRef(queueSourceChange);
  queueSourceChangeRef.current = queueSourceChange;

  useEffect(() => {
    contentMounted.current = true;
    return () => {
      contentMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    void trackingSourcePreferences
      .hasPendingConsent()
      .then((pending) => {
        if (current) setPendingConsent(pending);
      })
      .catch(() => {
        if (current) setActionFailed(true);
      });
    return () => {
      current = false;
    };
  }, [
    ownerId,
    isUpdating,
    query.dataUpdatedAt,
    syncState.status,
    sourceIntents
  ]);

  async function publishSavedLocalSources() {
    try {
      if ((useAppShellStore.getState().session?.userId ?? null) !== ownerId)
        return;
      const sources = await trackingSourcePreferences.load();
      if ((useAppShellStore.getState().session?.userId ?? null) !== ownerId)
        return;
      queryClient.setQueryData<TrackingStatusSnapshot>(
        statusKey,
        (current) =>
          current && {
            ...current,
            smsTrackingEnabled: sources.smsEnabled,
            notificationTrackingEnabled: sources.notificationEnabled
          }
      );
    } catch {
      /* The original action failure remains visible; no authority is granted by this read. */
    }
  }

  async function retrySourceConsent() {
    if (updating) return;
    setUpdating(true);
    setActionFailed(false);
    setTrackingSourceFailure(sourceCommands, false);
    try {
      const result = await resyncAutomaticTracking();
      if (result.status === 'error') setActionFailed(true);
      await refetchTrackingStatus();
    } catch {
      setActionFailed(true);
    } finally {
      setUpdating(false);
    }
  }

  const setKeywordRules = useCallback(
    (rules: KeywordRule[]) => {
      // The callback only publishes a server-confirmed save/conflict result. Manual
      // updates are not persisted as reads; evict the superseded disk projection.
      queryClient.setQueryData(keywordsKey, rules);
      void queryClient.invalidateQueries({
        queryKey: keywordsKey,
        exact: true,
        refetchType: 'none'
      });
    },
    [queryClient, keywordsKey]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const admissionRevision = useTrackingAdmission.getState().revision;
        void (async () => {
          if (awaitingSmsAccess.current !== null) {
            const pending = awaitingSmsAccess.current;
            awaitingSmsAccess.current = null;
            if (
              (await permissionService.getState()).status === 'granted' &&
              pending.isCurrent()
            ) {
              pending.assertCurrent();
              queueSourceChangeRef.current('sms', true);
            }
          }
          if (awaitingNotificationAccess.current !== null) {
            const pending = awaitingNotificationAccess.current;
            awaitingNotificationAccess.current = null;
            if (
              (await bankNotificationService.getAccessState()) === 'granted' &&
              pending.isCurrent()
            ) {
              pending.assertCurrent();
              queueSourceChangeRef.current('notification', true);
            }
          }
          await resyncAutomaticTracking();
          await refetchTrackingStatus();
        })().catch(() => {
          if (
            contentMounted.current &&
            (useAppShellStore.getState().session?.userId ?? null) === ownerId &&
            useTrackingAdmission.getState().revision === admissionRevision
          )
            setActionFailed(true);
        });
        void loadKeywords();
      }
    });
    return () => subscription.remove();
  }, [refetchTrackingStatus, loadKeywords, ownerId, permissionService]);

  const handleKeywordsChange = useCallback(
    async (newRules: KeywordRule[]) => {
      if (updating || keywordLoadState !== 'ready') return;
      const previousRules = keywordRules;
      setActionFailed(false);
      setUpdating(true);
      try {
        await trackingKeywordConfiguration.save(
          newRules,
          previousRules,
          setKeywordRules
        );
      } catch {
        setActionFailed(true);
      } finally {
        setUpdating(false);
      }
    },
    [updating, keywordLoadState, keywordRules, setKeywordRules]
  );

  const restoreKeywords = useCallback(async () => {
    if (updating || keywordLoadState !== 'ready') return;
    setActionFailed(false);
    setUpdating(true);
    try {
      await trackingKeywordConfiguration.restore(setKeywordRules);
    } catch {
      setActionFailed(true);
    } finally {
      setUpdating(false);
    }
  }, [updating, keywordLoadState, setKeywordRules]);

  function queueSourceChange(source: 'sms' | 'notification', enabled: boolean) {
    if (updating) return;
    const request = ++sourceCommands.requests[source];
    const configurationRequest = ++sourceCommands.configurationRequest;
    const admissionRevision = sourceCommands.admissionRevision;
    const sameOwner = () =>
      (useAppShellStore.getState().session?.userId ?? null) === ownerId;
    const currentRequest = () =>
      sourceCommands.requests[source] === request &&
      sameOwner() &&
      useTrackingAdmission.getState().revision === admissionRevision;
    let assertAdmission: () => void;
    try {
      assertAdmission = captureTrackingAdmission(ownerId ?? undefined);
      if (!currentRequest()) throw new Error('tracking_source_context_changed');
    } catch {
      setActionFailed(true);
      return;
    }
    const assertContext = () => {
      assertAdmission();
      if (!sameOwner()) throw new Error('tracking_source_context_changed');
    };
    const assertIntent = () => {
      assertContext();
      if (!currentRequest()) throw new Error('tracking_source_intent_changed');
    };
    setActionFailed(false);
    setTrackingSourceIntent(sourceCommands, source, enabled);
    // Queue durable revocation immediately, before a slower ON/mode job settles.
    const disabling = !enabled
      ? Promise.all([
          trackingSourcePreferences.set(source, false),
          source === 'notification'
            ? bankNotificationService.setCaptureEnabled(false)
            : Promise.resolve()
        ]).then(([sources]) => sources)
      : null;
    // The queued job observes this rejection; attach a handler while it waits.
    void disabling?.catch(() => undefined);
    const run = async () => {
      try {
        let sources: TrackingSourceState;
        let mode =
          queryClient.getQueryData<TrackingStatusSnapshot>(statusKey)?.mode;
        if (disabling) {
          sources = await disabling;
          assertIntent();
          if (!sources.smsEnabled && !sources.notificationEnabled) {
            await automaticTrackingService.setMode('paused');
            assertIntent();
            mode = 'paused';
          }
        } else {
          assertIntent();
          if (source === 'sms') {
            const permission = await permissionService.getState();
            assertIntent();
            queryClient.setQueryData<TrackingStatusSnapshot>(
              statusKey,
              (current) =>
                current && {
                  ...current,
                  smsPermissionStatus: permission.status,
                  permissionStatus:
                    permission.status === 'granted' ||
                    current.notificationAccessStatus === 'granted'
                      ? 'granted'
                      : permission.status
                }
            );
            if (permission.status === 'unavailable')
              throw new Error('tracking_sms_unavailable');
            if (permission.status !== 'granted') {
              const pending = {
                assertCurrent: assertIntent,
                isCurrent: currentRequest
              };
              awaitingSmsAccess.current = pending;
              try {
                await permissionService.openSettings();
              } catch (error) {
                if (awaitingSmsAccess.current === pending)
                  awaitingSmsAccess.current = null;
                throw error;
              }
              return;
            }
          } else {
            const access = await bankNotificationService.getAccessState();
            assertIntent();
            queryClient.setQueryData<TrackingStatusSnapshot>(
              statusKey,
              (current) =>
                current && {
                  ...current,
                  notificationAccessStatus: access,
                  permissionStatus:
                    access === 'granted' ||
                    current.smsPermissionStatus === 'granted'
                      ? 'granted'
                      : (current.smsPermissionStatus ??
                        current.permissionStatus)
                }
            );
            if (access !== 'granted') {
              awaitingNotificationAccess.current = {
                assertCurrent: assertIntent,
                isCurrent: currentRequest
              };
              await bankNotificationService.openSettings();
              return;
            }
          }
          sources = await enableTrackingSource(
            source,
            mode,
            assertIntent,
            assertContext
          );
          if (mode === 'paused') mode = 'automatic_clear';
        }
        assertIntent();
        await showSavedSources(sources, mode, assertIntent);
        if (configurationRequest === sourceCommands.configurationRequest)
          void resyncAutomaticTracking()
            .then(() => {
              if (
                currentRequest() &&
                configurationRequest === sourceCommands.configurationRequest
              )
                return refetchTrackingStatus();
            })
            .catch(() => {
              if (
                currentRequest() &&
                configurationRequest === sourceCommands.configurationRequest
              )
                setTrackingSourceFailure(sourceCommands, true);
            });
      } catch {
        if (currentRequest()) {
          await publishSavedLocalSources();
          if (currentRequest()) setTrackingSourceFailure(sourceCommands, true);
        }
      } finally {
        if (currentRequest())
          setTrackingSourceIntent(sourceCommands, source, undefined);
      }
    };
    sourceCommands.tail = sourceCommands.tail.then(run, run);
  }

  function toggleSmsTracking(nextValue: boolean) {
    queueSourceChange('sms', nextValue);
  }

  async function showSavedSources(
    sources: TrackingSourceState,
    mode: TrackingMode | undefined,
    assertIntent: () => void
  ) {
    // A previous status request must not overwrite the preference just saved.
    assertIntent();
    await queryClient.cancelQueries({ queryKey: statusKey, exact: true });
    assertIntent();
    queryClient.setQueryData<TrackingStatusSnapshot>(
      statusKey,
      (current) =>
        current && {
          ...current,
          mode: mode ?? current.mode,
          smsTrackingEnabled: sources.smsEnabled,
          notificationTrackingEnabled: sources.notificationEnabled
        }
    );
  }

  async function toggleTrackingMode(nextValue: boolean) {
    if (updating) return;
    setUpdating(true);
    setActionFailed(false);
    try {
      await automaticTrackingService.setMode(
        nextValue ? 'automatic_clear' : 'paused'
      );
      await resyncAutomaticTracking();
      await query.refetch();
    } catch {
      setActionFailed(true);
    } finally {
      setUpdating(false);
    }
  }

  function toggleNotificationTracking(nextValue: boolean) {
    queueSourceChange('notification', nextValue);
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  if (query.isLoading && !hasReadableSnapshot(query)) {
    return (
      <View
        testID="tracking-status-screen"
        style={[styles.root, { direction }]}
      >
        <AppBar
          title={translate('tracking.header.title')}
          onBack={handleBack}
          direction={direction}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          accessibilityState={{ busy: true }}
        >
          <SurfaceCard style={styles.card}>
            {Platform.OS === 'android' ? (
              (['sms', 'notification'] as const).map((source) => (
                <View
                  key={source}
                  style={[
                    styles.sourceRow,
                    styles.physicalLtr,
                    { flexDirection: isRtl ? 'row-reverse' : 'row' }
                  ]}
                >
                  <View style={styles.sourceText}>
                    <StyledText style={styles.sourceTitle}>
                      {translate(
                        source === 'sms'
                          ? 'tracking.source.smsTracking'
                          : 'tracking.source.notificationTracking'
                      )}
                    </StyledText>
                    <StyledText style={styles.sourceDescription}>
                      {translate(
                        source === 'sms'
                          ? 'tracking.source.smsTrackingDescription'
                          : 'tracking.source.notificationTrackingDescription'
                      )}
                    </StyledText>
                  </View>
                  <View style={styles.pendingSwitch} />
                </View>
              ))
            ) : (
              <StyledText>{translate('tracking.status.label')} · —</StyledText>
            )}
          </SurfaceCard>
          <SurfaceCard style={[styles.card, styles.keywordCard]}>
            <StyledText variant="subtitle">
              {translate('tracking.keywords.sectionTitle')} (
              {hasReadableSnapshot(keywords)
                ? keywordRules.filter((rule) => rule.enabled).length
                : '—'}
              )
            </StyledText>
            <StyledText style={styles.sourceDescription}>
              {translate('tracking.keywords.explanation')}
            </StyledText>
          </SurfaceCard>
        </ScrollView>
      </View>
    );
  }

  if (!hasReadableSnapshot(query) || !query.data) {
    return (
      <StateView
        state="error"
        title={translate('tracking.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  }

  const status = query.data;
  const permissionUnavailable =
    status.permissionStatus === 'unavailable' ||
    status.serviceState === 'unavailable';
  const isEnabled = status.mode !== 'paused' && !permissionUnavailable;
  const smsPermission = status.smsPermissionStatus ?? status.permissionStatus;
  const notificationAccess =
    status.notificationAccessStatus ??
    (permissionUnavailable ? 'unavailable' : 'denied');
  const smsEnabled =
    isEnabled &&
    smsPermission === 'granted' &&
    status.smsTrackingEnabled !== false;
  const notificationEnabled =
    isEnabled &&
    notificationAccess === 'granted' &&
    (status.notificationTrackingEnabled ?? true);
  const isAndroid = status.platform === 'android';

  return (
    <View testID="tracking-status-screen" style={[styles.root, { direction }]}>
      {/* 1. Header with back navigation and localized title */}
      <AppBar
        title={translate('tracking.header.title')}
        onBack={handleBack}
        direction={direction}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {pendingConsent && !Object.keys(sourceIntents).length ? (
          <SurfaceCard style={styles.card}>
            <StyledText accessibilityRole="alert">
              {translate('tracking.sources.pendingConsent')}
            </StyledText>
            <ActionButton
              testID="tracking-consent-retry"
              label="designSystem.action.retry"
              variant="secondary"
              disabled={updating}
              onPress={() => void retrySourceConsent()}
            />
          </SurfaceCard>
        ) : null}
        {/* 2. Tracking Status Card */}
        <SurfaceCard style={styles.card}>
          {!isAndroid ? (
            <View
              testID="tracking-status-row"
              style={[
                styles.statusRow,
                styles.physicalLtr,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <View
                testID="tracking-status-text"
                style={[
                  styles.statusTextGroup,
                  { alignItems: isRtl ? 'flex-end' : 'flex-start' }
                ]}
              >
                <StyledText
                  variant="caption"
                  style={[
                    styles.statusLabel,
                    {
                      textAlign: isRtl ? 'right' : 'left',
                      writingDirection: direction
                    }
                  ]}
                >
                  {translate('tracking.status.label')}
                </StyledText>
                <StyledText
                  variant="title"
                  style={[
                    styles.statusValue,
                    {
                      textAlign: isRtl ? 'right' : 'left',
                      writingDirection: direction
                    }
                  ]}
                >
                  {permissionUnavailable
                    ? translate('tracking.status.unavailable')
                    : isEnabled
                      ? translate('tracking.status.enabled')
                      : translate('tracking.status.disabled')}
                </StyledText>
              </View>

              <View style={styles.toggleWrapper}>
                <Toggle
                  testID="tracking-mode-switch"
                  value={isEnabled}
                  onValueChange={(value) => void toggleTrackingMode(value)}
                  disabled={updating || permissionUnavailable}
                  accessibilityLabel={translate('tracking.status.label')}
                />
              </View>
            </View>
          ) : (
            <View style={styles.sourceList}>
              <TrackingSourceToggleRow
                testID="tracking-sms-switch"
                isRtl={isRtl}
                label={translate('tracking.source.smsTracking')}
                description={translate(
                  'tracking.source.smsTrackingDescription'
                )}
                value={
                  smsPermission === 'granted'
                    ? (sourceIntents.sms ?? smsEnabled)
                    : smsEnabled
                }
                disabled={updating || smsPermission === 'unavailable'}
                onValueChange={(value) => void toggleSmsTracking(value)}
              />
              <View style={styles.sourceDivider} />
              <TrackingSourceToggleRow
                testID="tracking-notification-switch"
                isRtl={isRtl}
                label={translate('tracking.source.notificationTracking')}
                description={translate(
                  'tracking.source.notificationTrackingDescription'
                )}
                value={
                  notificationAccess === 'granted'
                    ? (sourceIntents.notification ?? notificationEnabled)
                    : notificationEnabled
                }
                disabled={updating || notificationAccess === 'unavailable'}
                onValueChange={(value) =>
                  void toggleNotificationTracking(value)
                }
              />
            </View>
          )}

          {Platform.OS === 'android' &&
          (smsEnabled || notificationEnabled) &&
          status.serviceState === 'battery_restricted' ? (
            <View style={{ gap: 8 }}>
              <StyledText>
                {translate('tracking.howItWorks.background')}
              </StyledText>
              <ActionButton
                label="appShell.permission.openSettings"
                variant="secondary"
                onPress={() => void permissionService.openSettings()}
              />
            </View>
          ) : null}
          <TrackingDemoNotice />
          {!Object.keys(sourceIntents).length ? (
            <TrackingSyncPanel
              state={syncState}
              onRetry={() => {
                if (!updating) void syncAutomaticTracking();
              }}
            />
          ) : null}
        </SurfaceCard>

        <SurfaceCard testID="tracking-explanation-card" style={styles.card}>
          <View style={styles.explanationList}>
            {(
              [
                ['notifications', 'tracking.howItWorks.detection'],
                ['transactions', 'tracking.howItWorks.privacy']
              ] as const
            ).map(([icon, textKey]) => (
              <View
                key={textKey}
                testID="tracking-explanation-row"
                style={[
                  styles.explanationItem,
                  styles.physicalLtr,
                  { flexDirection: isRtl ? 'row-reverse' : 'row' }
                ]}
              >
                <View style={styles.explanationIcon}>
                  <DesignIcon
                    name={icon}
                    decorative
                    size="sm"
                    color={colors.content.link}
                  />
                </View>
                <StyledText
                  style={[
                    styles.explanationText,
                    {
                      textAlign: isRtl ? 'right' : 'left',
                      writingDirection: direction
                    }
                  ]}
                >
                  {translate(textKey)}
                </StyledText>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {/* 4. Keyword Management Card */}
        <SurfaceCard
          testID="tracking-keywords-card"
          style={[styles.card, styles.keywordCard]}
        >
          {keywordLoadState === 'ready' ? (
            <TrackingKeywordChips
              rules={keywordRules}
              onChange={handleKeywordsChange}
              onRestore={restoreKeywords}
              disabled={updating || permissionUnavailable}
            />
          ) : (
            <StateView
              state={keywordLoadState === 'loading' ? 'loading' : 'error'}
              title={translate(
                keywordLoadState === 'loading'
                  ? 'tracking.state.loading'
                  : 'tracking.state.error'
              )}
              actionLabel={
                keywordLoadState === 'error'
                  ? translate('coreFinance.action.retry')
                  : undefined
              }
              onAction={
                keywordLoadState === 'error'
                  ? () => void loadKeywords()
                  : undefined
              }
            />
          )}
        </SurfaceCard>

        {/* Error notification if action fails */}
        {actionFailed || sourceSnapshot.failed ? (
          <View style={styles.errorBanner}>
            <StyledText accessibilityRole="alert" style={styles.errorText}>
              {translate('tracking.state.error')}
            </StyledText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

async function enableTrackingSource(
  source: 'sms' | 'notification',
  mode: TrackingMode | undefined,
  assertIntent: () => void,
  assertContext: () => void
) {
  // Both switches appear off while paused; activating one must not revive the hidden other preference.
  assertIntent();
  if (mode === 'paused') {
    if (source === 'sms')
      await bankNotificationService.setCaptureEnabled(false);
    assertIntent();
    await trackingSourcePreferences.set(
      source === 'sms' ? 'notification' : 'sms',
      false
    );
    assertIntent();
    await automaticTrackingService.setMode('automatic_clear');
    assertIntent();
  }
  if (source === 'notification') {
    try {
      await bankNotificationService.setCaptureEnabled(true);
      assertIntent();
    } catch (error) {
      assertContext();
      await bankNotificationService.setCaptureEnabled(false);
      throw error;
    }
  }
  const sources = await trackingSourcePreferences.set(source, true);
  assertIntent();
  return sources;
}

function TrackingSourceToggleRow({
  testID,
  isRtl,
  label,
  description,
  value,
  disabled,
  onValueChange
}: {
  testID: string;
  isRtl: boolean;
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const styles = themedStyles[useTheme().mode];
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID}
    >
      <View
        testID={`${testID}-row`}
        style={[
          styles.sourceRow,
          styles.physicalLtr,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        <View
          testID={`${testID}-text`}
          style={[
            styles.sourceText,
            { alignItems: isRtl ? 'flex-end' : 'flex-start' }
          ]}
        >
          <StyledText
            variant="title"
            style={[
              styles.sourceTitle,
              {
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: isRtl ? 'rtl' : 'ltr'
              }
            ]}
          >
            {label}
          </StyledText>
          <StyledText
            variant="caption"
            style={[
              styles.sourceDescription,
              {
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: isRtl ? 'rtl' : 'ltr'
              }
            ]}
          >
            {description}
          </StyledText>
        </View>
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Toggle
            accessibilityLabel={label}
            disabled={disabled}
            value={value}
          />
        </View>
      </View>
    </Pressable>
  );
}

export function TrackingSyncPanel({
  state,
  onRetry
}: {
  state: AutomaticTrackingSyncState;
  onRetry: () => void;
}) {
  if (['idle', 'scanning', 'processing'].includes(state.status)) return null;
  if (state.status === 'queued')
    return (
      <StateView
        state="offline"
        title={translate('tracking.service.offline')}
        message={translate('tracking.recovery.message')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={onRetry}
      />
    );
  if (state.status === 'imported') return null;
  if (state.status === 'review' && state.reviewId)
    return (
      <StateView
        state="review"
        title={translate('tracking.review.title')}
        actionLabel={translate('tracking.action.review')}
        onAction={() => router.push(`/tracking/review/${state.reviewId}`)}
      />
    );
  if (state.status === 'duplicate' && state.duplicateId)
    return (
      <StateView
        state="review"
        title={translate('tracking.duplicate.title')}
        actionLabel={translate('tracking.action.open')}
        onAction={() =>
          router.push(`/tracking/duplicates/${state.duplicateId}`)
        }
      />
    );
  if (state.status === 'account_required')
    return (
      <StateView
        state="review"
        title={translate('coreFinance.accounts.noEligible')}
        actionLabel={translate('coreFinance.accounts.open')}
        onAction={() => router.push('/accounts')}
      />
    );
  return (
    <StateView
      state="error"
      title={translate('tracking.sync.error')}
      actionLabel={translate('coreFinance.action.retry')}
      onAction={onRetry}
    />
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    physicalLtr: {
      ...layoutDirectionStyle('ltr'),
      writingDirection: 'ltr'
    },
    root: {
      backgroundColor: colors.surfaces.page,
      flex: 1
    },
    scrollContent: {
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xxl
    },
    card: {
      backgroundColor: colors.surfaces.card,
      borderColor: colors.borders.default,
      borderRadius: radius.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    keywordCard: {
      marginHorizontal: -4,
      padding: 18
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 52
    },
    sourceList: {
      gap: spacing.sm
    },
    pendingSwitch: {
      width: 52,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.borders.default
    },
    sourceDivider: {
      backgroundColor: colors.borders.default,
      height: 1
    },
    sourceRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
      minHeight: 64
    },
    sourceText: {
      flex: 1,
      gap: spacing.xs
    },
    sourceTitle: {
      color: colors.content.primary,
      fontSize: 18,
      fontWeight: '700'
    },
    sourceDescription: {
      color: colors.content.secondary
    },
    toggleWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 54
    },
    statusTextGroup: {
      gap: 2
    },
    statusLabel: {
      color: colors.content.primary,
      fontSize: 18,
      fontWeight: '700'
    },
    statusValue: {
      color: colors.content.secondary,
      fontSize: 13,
      fontWeight: '600'
    },
    explanationList: { gap: spacing.md },
    explanationItem: { alignItems: 'center', gap: spacing.md },
    explanationIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaces.brandSubtle
    },
    explanationText: {
      flex: 1,
      color: colors.content.secondary,
      fontSize: 13.5,
      lineHeight: 20
    },
    errorBanner: {
      backgroundColor: colors.iconBadges.danger.background,
      borderColor: colors.iconBadges.danger.border,
      borderRadius: radius.control,
      borderWidth: 1,
      padding: spacing.md
    },
    errorText: {
      color: colors.iconBadges.danger.foreground,
      fontSize: 13,
      textAlign: 'center'
    }
  });

const themedStyles = {
  light: createStyles(lightThemeColors),
  dark: createStyles(darkThemeColors)
};
