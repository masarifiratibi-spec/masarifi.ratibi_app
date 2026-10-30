import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { AppIcon } from '@/design-system/icons';
import { elevation, radius, spacing } from '@/design-system/tokens';
import { translate, type MessageKey } from '@/localization/i18n';
import { reportsService } from '@/services/reports-service';
import type { ReportQuery } from '@/services/contracts/reports-service';
import {
  saveReportPdf,
  openReportPdf,
  shareReportPdf,
  removeReportPdfCache,
  type SavedReportPdf
} from '@/services/platform/report-pdf-file';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { pdfFailureMessage } from './report-state';

type Pending = { operationId: string; previewId?: string; attemptId?: string };
type Feedback =
  'generating' | 'saving' | 'success' | { error: MessageKey } | null;

export function ReportPdfExport({
  input,
  offline = false
}: {
  input: ReportQuery;
  offline?: boolean;
}) {
  const owner = useAppShellStore((state) => state.session?.userId);
  return (
    <OwnedReportPdfExport
      key={owner ?? 'signed-out'}
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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const mounted = useRef(true);
  const flight = useRef<symbol | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Pending | null>(null);
  const saved = useRef<SavedReportPdf | null>(null);
  const scope = JSON.stringify([
    input.kind,
    input.anchorDate,
    input.currencyCode,
    input.timeZone,
    input.monthStartDay ?? 1,
    [...(input.accountIds ?? [])].sort(),
    locale
  ]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const current = () =>
    mounted.current &&
    currentScope.current === scope &&
    useAppShellStore.getState().session?.userId === owner;
  const assertCurrent = () => {
    if (!owner || !current()) throw Error('REPORT_CONTEXT_CHANGED');
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (saved.current)
        void removeReportPdfCache(saved.current).catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    flight.current = null;
    pending.current = null;
    if (saved.current)
      void removeReportPdfCache(saved.current).catch(() => undefined);
    saved.current = null;
    setBusy(false);
    setFeedback(null);
  }, [scope]);

  const start = async () => {
    if (flight.current) return;
    const token = Symbol('pdf');
    flight.current = token;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setFeedback('generating');
    try {
      assertCurrent();
      const currentlyOffline = readRecoveryNetwork.available
        ? !(await readRecoveryNetwork.isOnline())
        : offline;
      if (currentlyOffline) throw Error('REPORT_PDF_REQUIRES_INTERNET');
      assertCurrent();
      if (saved.current) await removeReportPdfCache(saved.current);
      saved.current = null;
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
      if (!operation.attemptId) {
        const result = await reportsService.requestOutput(
          { kind: 'download', previewId: operation.previewId },
          operation.operationId
        );
        assertCurrent();
        operation.attemptId = result.value.id;
      }
      for (let poll = 0; poll < 30; poll++) {
        const attempt = await reportsService.getAttempt(operation.attemptId, {
          signal: abort.signal
        });
        assertCurrent();
        if (attempt.id !== operation.attemptId)
          throw Error('REPORT_ID_MISMATCH');
        if (attempt.status === 'failed') {
          pending.current = null;
          throw Error('REPORT_GENERATION_FAILED');
        }
        if (attempt.status === 'ready') {
          setFeedback('saving');
          const result = await saveReportPdf(
            attempt,
            assertCurrent,
            abort.signal
          );
          if (!current()) {
            await removeReportPdfCache(result);
            return;
          }
          saved.current = result;
          setFeedback('success');
          return;
        }
        await pauseForPdf(abort.signal);
      }
      throw Error('REPORT_STILL_PROCESSING');
    } catch (error) {
      if (current()) {
        if ((error as { code?: string })?.code === 'expired')
          pending.current = null;
        setFeedback({ error: pdfFailureMessage(error) });
      }
    } finally {
      if (flight.current === token) {
        flight.current = null;
        if (current()) setBusy(false);
      }
    }
  };

  const openOrShare = async (kind: 'open' | 'share') => {
    if (!saved.current || flight.current) return;
    const token = Symbol(kind);
    flight.current = token;
    setBusy(true);
    try {
      assertCurrent();
      await (kind === 'open' ? openReportPdf : shareReportPdf)(
        saved.current,
        assertCurrent
      );
    } catch (error) {
      if (current()) setFeedback({ error: pdfFailureMessage(error) });
    } finally {
      if (flight.current === token) {
        flight.current = null;
        if (current()) setBusy(false);
      }
    }
  };
  const bottom = Math.max(insets?.bottom ?? 0, spacing.lg) + spacing.lg;
  return (
    <View testID="reports-pdf-dock" style={{ paddingBottom: bottom + 72 }}>
      {feedback ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            {
              backgroundColor: theme.colors.surfaces.card,
              borderColor: theme.colors.border
            }
          ]}
        >
          <StyledText
            accessibilityRole={typeof feedback === 'object' ? 'alert' : 'text'}
          >
            {typeof feedback === 'object'
              ? feedback.error
              : `reports.pdf.${feedback}`}
          </StyledText>
          {feedback === 'success' || saved.current ? (
            <View style={styles.actions}>
              <ActionButton
                label="reports.pdf.open"
                disabled={busy}
                variant="secondary"
                onPress={() => void openOrShare('open')}
              />
              <ActionButton
                label="reports.pdf.share"
                disabled={busy}
                variant="secondary"
                onPress={() => void openOrShare('share')}
              />
            </View>
          ) : typeof feedback === 'object' ? (
            <ActionButton
              label="reports.pdf.retry"
              disabled={busy}
              onPress={() => void start()}
            />
          ) : null}
          {!busy ? (
            <ActionButton
              label="common.close"
              variant="quiet"
              onPress={() => setFeedback(null)}
            />
          ) : null}
        </View>
      ) : null}
      <Pressable
        testID="reports-pdf-fab"
        accessibilityRole="button"
        accessibilityLabel={translate('reports.pdf.download')}
        accessibilityState={{ busy, disabled: busy || !owner }}
        disabled={busy || !owner}
        onPress={() => void start()}
        style={[styles.fab, { bottom, backgroundColor: theme.colors.primary }]}
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
  );
}

function pauseForPdf(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(Error('REPORT_CONTEXT_CHANGED'));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(Error('REPORT_CONTEXT_CHANGED'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, 2000);
    signal.addEventListener('abort', stop, { once: true });
  });
}


const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised
  },
  feedback: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }
});
