import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { StateView } from '@/design-system/components/feedback/StateView';
import { spacing } from '@/design-system/tokens';
import { translate, type MessageKey } from '@/localization/i18n';
import { reportsService } from '@/services/reports-service';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import {
  saveReportPdf,
  removeReportPdfCache,
  type SavedReportPdf
} from '@/services/platform/report-pdf-file';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatDate, formatDateTime } from '@/utils/format-financial-value';
import { useReportAttempts } from './report-queries';
import { outputStateTitle, pdfFailureMessage } from './report-state';

export function ReportHistoryScreen() {
  const owner = useAppShellStore((state) => state.session?.userId);
  return owner ? (
    <OwnedReportHistory key={owner} owner={owner} />
  ) : (
    <StateView state="error" title={translate('reports.export.signIn')} />
  );
}

function OwnedReportHistory({ owner }: { owner: string }) {
  const attempts = useReportAttempts();
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const active = useRef(true);
  const flight = useRef<AbortController | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    id: string;
    message: MessageKey;
  } | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      flight.current?.abort();
    };
  }, []);

  const download = async (id: string) => {
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    let file: SavedReportPdf | undefined;
    const current = () =>
      active.current &&
      !controller.signal.aborted &&
      useAppShellStore.getState().session?.userId === owner;
    const assertCurrent = () => {
      if (!current()) throw new Error('REPORT_CONTEXT_CHANGED');
    };
    setBusyId(id);
    setFeedback(null);
    try {
      assertCurrent();
      const fresh = await reportsService.getAttempt(id, {
        signal: controller.signal
      });
      assertCurrent();
      if (
        fresh.id !== id ||
        fresh.format !== 'pdf' ||
        fresh.status !== 'ready' ||
        !['download', 'share'].includes(fresh.kind)
      )
        throw new Error('REPORT_NOT_READY');
      file = await saveReportPdf(fresh, assertCurrent, controller.signal);
      assertCurrent();
      setFeedback({ id, message: 'reports.pdf.success' });
    } catch (error) {
      const code =
        (error as { code?: string; message?: string })?.code ??
        (error as Error)?.message;
      if (current())
        setFeedback({
          id,
          message: [
            'not_found',
            'gone',
            'expired',
            'REPORT_NOT_READY'
          ].includes(code ?? '')
            ? 'reports.pdf.historyUnavailable'
            : pdfFailureMessage(error)
        });
    } finally {
      if (file) await removeReportPdfCache(file).catch(() => undefined);
      if (flight.current === controller) flight.current = null;
      if (active.current) setBusyId(null);
    }
  };
  const readable = hasReadableSnapshot(attempts);
  const items = readable
    ? (attempts.data?.items.filter(
        (item) =>
          item.format === 'pdf' && ['download', 'share'].includes(item.kind)
      ) ?? [])
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}>
      <AppBar
        title={translate('reports.pdf.history')}
        direction={direction}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/reports')
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md
        }}
      >
        <StyledText variant="caption">reports.pdf.historyScope</StyledText>
        {attempts.isPending ? (
          <StateView
            state="loading"
            title={translate('reports.state.loading')}
          />
        ) : null}
        {attempts.isError ? (
          <StateView
            state="error"
            title={translate('reports.state.error')}
            actionLabel={translate('reports.action.retry')}
            onAction={() => void attempts.refetch()}
          />
        ) : !attempts.isPending && !items.length ? (
          <StateView
            state="empty"
            title={translate('reports.pdf.historyEmpty')}
          />
        ) : null}
        {items.map((item) => (
          <SurfaceCard
            key={item.id}
            testID={`report-history-${item.id}`}
            style={{ gap: spacing.md }}
          >
            <StyledText>{formatDateTime(item.requestedAt, locale)}</StyledText>
            {item.snapshot ? (
              <StyledText variant="caption">{`${formatDate(item.snapshot.period.startInstant, locale, item.snapshot.period.timeZone)} – ${formatDate(item.snapshot.period.endExclusiveInstant - 1, locale, item.snapshot.period.timeZone)} · ${item.snapshot.currencyCode}`}</StyledText>
            ) : null}
            <StyledText>{outputStateTitle(item.status)}</StyledText>
            {item.status === 'ready' ? (
              <ActionButton
                label="reports.pdf.download"
                disabled={busyId !== null}
                loading={busyId === item.id}
                onPress={() => void download(item.id)}
              />
            ) : null}
            {feedback?.id === item.id ? (
              <StyledText accessibilityLiveRegion="polite">
                {feedback.message}
              </StyledText>
            ) : null}
          </SurfaceCard>
        ))}
        {!attempts.isPending && !attempts.isError ? (
          <ActionButton
            label="reports.action.retry"
            variant="secondary"
            loading={attempts.isFetching}
            onPress={() => void attempts.refetch()}
          />
        ) : null}
        {attempts.hasNextPage ? (
          <ActionButton
            label="reports.action.more"
            loading={attempts.isFetchingNextPage}
            onPress={() => void attempts.fetchNextPage()}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
