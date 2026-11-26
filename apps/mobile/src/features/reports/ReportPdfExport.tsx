import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { layoutDirectionStyle } from '@/design-system/direction';
import { AppIcon } from '@/design-system/icons';
import { elevation, spacing } from '@/design-system/tokens';
import { resolveReportPeriod } from '@/domain/reports';
import { formatDaySpan } from '@/features/filters/date-period';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import {
  readReportEmailIdentity,
  isReportEmailIdentityCurrent,
  observeReportEmailIdentity,
  type ReportEmailIdentity
} from './report-email-identity';
import {
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { reportsService } from '@/services/reports-service';
import type { ReportQuery } from '@/services/contracts/reports-service';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { pdfFailureMessage } from './report-state';
import {
  StagingReportFiles,
  stagingReportFilesEnabled
} from './StagingReportFiles';

type Pending = { operationId: string; previewId?: string; attemptId?: string };
type Feedback =
  'review' | 'requesting' | 'queued' | { error: MessageKey } | null;

export function ReportPdfExport({
  input,
  offline = false
}: {
  input: ReportQuery;
  offline?: boolean;
}) {
  const owner = useAppShellStore((state) =>
    state.session?.status === 'authenticated' ? state.session.userId : null
  );
  const locale = usePreferenceStore((state) => state.locale);
  const scope = JSON.stringify([
    owner,
    input.kind,
    input.anchorDate,
    input.currencyCode,
    input.timeZone,
    input.monthStartDay ?? 1,
    [...(input.accountIds ?? [])].sort(),
    locale
  ]);
  return (
    <OwnedReportPdfExport
      key={scope}
      owner={owner}
      input={input}
      offline={offline}
    />
  );
}

function OwnedReportPdfExport({
  owner,
  input,
  offline
}: {
  owner?: string | null;
  input: ReportQuery;
  offline: boolean;
}) {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const locale = usePreferenceStore((state) => state.locale);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const mounted = useRef(true);
  const flight = useRef<symbol | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Pending | null>(null);
  const [identity, setIdentity] = useState<ReportEmailIdentity | null>(null);
  const selectedAccountAtReview = useRef<string | null>(null);
  const reviewing = useRef(false);
  const current = () =>
    mounted.current && useAppShellStore.getState().session?.userId === owner;
  const consentCurrent = () =>
    current() &&
    !controller.current?.signal.aborted &&
    !!identity &&
    isReportEmailIdentityCurrent(identity) &&
    selectedAccountAtReview.current ===
      useCoreFinanceViewState.getState().selectedAccountId;
  const assertCurrent = () => {
    if (!consentCurrent()) throw Error('REPORT_RECIPIENT_UNVERIFIED');
  };
  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!identity) return;
    const invalidate = () => {
      if (isReportEmailIdentityCurrent(identity)) return;
      controller.current?.abort();
      reviewing.current = false;
      pending.current = null;
      setIdentity(null);
      setVisible(false);
    };
    return observeReportEmailIdentity(invalidate);
  }, [identity]);

  const fileMode = stagingReportFilesEnabled();
  const review = () => {
    if (fileMode) {
      setVisible(true);
      return;
    }
    if (flight.current) return;
    const next = readReportEmailIdentity();
    if (!identity || !isReportEmailIdentityCurrent(identity))
      pending.current = null;
    selectedAccountAtReview.current =
      useCoreFinanceViewState.getState().selectedAccountId;
    setIdentity(next);
    reviewing.current = !!next;
    setFeedback(next ? 'review' : { error: 'reports.pdf.emailMissing' });
    setVisible(true);
  };
  const dismiss = () => {
    reviewing.current = false;
    setVisible(false);
  };

  const start = async () => {
    if (flight.current || !reviewing.current || !identity) return;
    reviewing.current = false;
    const token = Symbol('report-email');
    flight.current = token;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setFeedback('requesting');
    setVisible(true);
    try {
      assertCurrent();
      const currentlyOffline = readRecoveryNetwork.available
        ? !(await readRecoveryNetwork.isOnline())
        : offline;
      if (currentlyOffline) throw Error('REPORT_PDF_REQUIRES_INTERNET');
      assertCurrent();
      if (pending.current?.attemptId) {
        const attemptId = pending.current.attemptId;
        const previous = await reportsService.getAttempt(attemptId, {
          signal: abort.signal
        });
        assertCurrent();
        if (previous.id !== attemptId) throw Error('REPORT_GENERATION_FAILED');
        if (!['sent', 'failed'].includes(previous.status)) {
          setFeedback('queued');
          return;
        }
        pending.current = null;
      }
      const operation = (pending.current ??= { operationId: randomUUID() });
      if (!operation.previewId) {
        const preview = await reportsService.previewOutput(
          {
            ...input,
            language: locale,
            detailLevel: 'summary',
            recipientEmail: null
          },
          { signal: abort.signal }
        );
        assertCurrent();
        operation.previewId = preview.previewId;
      }
      const result = await reportsService.requestOutput(
        {
          kind: 'send_now',
          previewId: operation.previewId,
          expectedAccountEmail: identity.email
        },
        operation.operationId,
        consentCurrent
      );
      assertCurrent();
      if (
        !['scheduled', 'sending', 'ready', 'sent'].includes(result.value.status)
      )
        throw Error('REPORT_GENERATION_FAILED');
      operation.attemptId = result.value.id;
      setFeedback('queued');
    } catch (error) {
      if (current()) setFeedback({ error: pdfFailureMessage(error) });
    } finally {
      if (flight.current === token) {
        flight.current = null;
        if (current()) setBusy(false);
      }
    }
  };
  const error =
    feedback && typeof feedback === 'object' ? feedback.error : null;
  const period = feedback === 'review' ? resolveReportPeriod(input) : null;
  const title = translate(
    feedback === 'review'
      ? 'reports.pdf.confirmTitle'
      : error
        ? 'reports.pdf.emailFailure'
        : 'reports.pdf.emailWaitTitle'
  );
  return (
    <>
      <View
        testID="reports-pdf-overlay"
        pointerEvents="box-none"
        style={[
          styles.export,
          Platform.OS === 'ios' && locale === 'ar' && styles.iosRtlExport,
          { bottom: Math.max(insets?.bottom ?? 0, spacing.sm) }
        ]}
      >
        <Pressable
          testID="reports-pdf-fab"
          accessibilityRole="button"
          accessibilityLabel={translate(
            fileMode ? 'reports.pdf.files' : 'reports.pdf.download'
          )}
          accessibilityState={{ busy, disabled: busy || !owner }}
          disabled={busy || !owner}
          onPress={review}
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        >
          {busy ? (
            <ActivityIndicator
              accessible={false}
              color={theme.colors.textInverse}
            />
          ) : (
            <AppIcon
              name="pdf"
              decorative
              color={theme.colors.textInverse}
              size="md"
            />
          )}
        </Pressable>
      </View>
      <Modal
        visible={visible}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={dismiss}
        statusBarTranslucent
      >
        <View
          style={[
            styles.backdrop,
            { backgroundColor: theme.colors.horizon.scrim }
          ]}
        >
          <ScrollView contentContainerStyle={styles.viewport} bounces={false}>
            <View
              testID="report-email-popup"
              accessibilityViewIsModal
              accessibilityRole="alert"
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surfaces.card,
                  direction: locale === 'ar' ? 'rtl' : 'ltr'
                }
              ]}
            >
              <View
                accessible={false}
                style={[
                  styles.icon,
                  { backgroundColor: theme.colors.surfaceMuted }
                ]}
              >
                <AppIcon
                  name="pdf"
                  decorative
                  color={theme.colors.primary}
                  size="lg"
                />
              </View>
              {fileMode && owner ? (
                visible && <StagingReportFiles owner={owner} input={input} />
              ) : (
                <>
                  <StyledText variant="title" style={styles.copy}>
                    {title}
                  </StyledText>
                  {period && identity ? (
                    <>
                      <StyledText style={styles.copy}>
                        {translateDynamic('reports.pdf.confirmDetails', {
                          type: translate(`reports.period.${input.kind}`),
                          period: formatDaySpan(
                            period.startInstant,
                            period.endExclusiveInstant - 1,
                            locale,
                            period.timeZone
                          )
                        })}
                      </StyledText>
                      <StyledText style={styles.copy}>
                        reports.pdf.confirmRecipient
                      </StyledText>
                      <StyledText
                        style={[styles.copy, { writingDirection: 'ltr' }]}
                      >
                        {identity.email}
                      </StyledText>
                      <ActionButton
                        label="reports.pdf.confirmSend"
                        onPress={() => void start()}
                      />
                    </>
                  ) : (
                    <StyledText style={styles.copy}>
                      {error ??
                        (feedback === 'queued'
                          ? 'reports.pdf.emailQueued'
                          : 'reports.pdf.emailPreparing')}
                    </StyledText>
                  )}
                  {error ? (
                    <ActionButton
                      label="reports.pdf.retry"
                      disabled={busy}
                      onPress={review}
                    />
                  ) : null}
                </>
              )}
              <ActionButton
                label={
                  feedback === 'review'
                    ? 'designSystem.action.cancel'
                    : 'common.close'
                }
                variant="secondary"
                onPress={dismiss}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  export: {
    ...layoutDirectionStyle('ltr'),
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'flex-end'
  },
  iosRtlExport: { alignItems: 'flex-start' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised
  },
  backdrop: { flex: 1 },
  viewport: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.md
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  copy: { textAlign: 'center' }
});
