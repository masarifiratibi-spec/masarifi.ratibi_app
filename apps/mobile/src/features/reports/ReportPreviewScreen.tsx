import { isFixtureModeEnabled } from '@/config/demo-mode';
import { useReportAnchorDate } from './useReportAnchorDate';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Share, ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { ReportBreakdown, ReportOutputAttempt } from '@/domain/reports';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { reportsService } from '@/services/reports-service';
import { usePreferenceStore } from '@/state/preferences';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { useReportsViewState } from '@/state/reports-view-state';
import {
  formatDate,
  formatDateTime,
  formatMinorAmount
} from '@/utils/format-financial-value';
import {
  useReportAttempts,
  useReportInput,
  useReportMutation,
  useReportPreview,
  useReportSchedule
} from './report-queries';
import { outputStateTitle, reportStateTitle } from './report-state';

type OutputRequest = Parameters<typeof reportsService.requestOutput>[0];
let outputOperationSequence = 0;

export function ReportPreviewScreen() {
  const anchorDate = useReportAnchorDate();
  const baseCurrencyCode = usePreferenceStore(
    (state) => state.baseCurrencyCode
  );
  const selectedAccountId = useCoreFinanceViewState(
    (state) => state.selectedAccountId
  );
  const accounts = useAccounts(false);
  const currencyCode =
    accounts.data?.find((account) => account.id === selectedAccountId)
      ?.currencyCode ?? baseCurrencyCode;
  const locale = usePreferenceStore((state) => state.locale);
  const { selectedKind } = useReportsViewState();
  const schedule = useReportSchedule();
  const attempts = useReportAttempts();
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const downloadFlight = useRef(false);
  const [pendingOutput, setPendingOutput] = useState<{
    id: string;
    kind: 'download' | 'share';
    owner: string | null | undefined;
  } | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed'>(
    isFixtureModeEnabled()
      ? (schedule.data?.detailLevel ?? 'summary')
      : 'summary'
  );
  const recipientEmail =
    schedule.data?.recipient.status === 'verified'
      ? schedule.data.recipient.normalizedEmail
      : null;
  const input = {
    ...useReportInput(
      selectedKind,
      anchorDate,
      currencyCode,
      selectedAccountId ? [selectedAccountId] : []
    ),
    language: locale,
    detailLevel,
    recipientEmail
  };
  const preview = useReportPreview(input);
  const output = useReportMutation((request: OutputRequest) =>
    reportsService.requestOutput(
      request,
      `report-output:${request.kind}:${Date.now()}:${++outputOperationSequence}`
    )
  );

  const submit = (kind: 'send_test' | 'send_now' | 'download' | 'share') => {
    if (preview.data)
      output.mutate(
        { kind, previewId: preview.data.previewId },
        {
          onSuccess: (result) => {
            if (
              !isFixtureModeEnabled() &&
              (kind === 'download' || kind === 'share')
            )
              setPendingOutput({
                id: result.value.id,
                kind,
                owner: useAppShellStore.getState().session?.userId
              });
          }
        }
      );
  };
  const retry = (attempt: ReportOutputAttempt) =>
    output.mutate({ kind: 'retry', previousAttemptId: attempt.id });
  const download = useCallback(
    async (
      attempt: ReportOutputAttempt,
      kind: 'download' | 'share' = 'download'
    ) => {
      if (downloadFlight.current) return;
      downloadFlight.current = true;
      const owner = useAppShellStore.getState().session?.userId;
      setDownloading(true);
      setDownloadFailed(false);
      try {
        const fresh = await reportsService.getAttempt(attempt.id);
        if (owner !== useAppShellStore.getState().session?.userId) return;
        if (
          fresh.id !== attempt.id ||
          fresh.status !== 'ready' ||
          !fresh.downloadUrl ||
          (fresh.downloadUrlExpiresAt ?? 0) <= Date.now()
        )
          throw new Error('REPORT_NOT_READY');
        if (kind === 'share')
          await Share.share({
            message: fresh.downloadUrl,
            url: fresh.downloadUrl
          });
        else await Linking.openURL(fresh.downloadUrl);
      } catch {
        if (owner === useAppShellStore.getState().session?.userId)
          setDownloadFailed(true);
      } finally {
        downloadFlight.current = false;
        setDownloading(false);
      }
    },
    []
  );
  useEffect(() => {
    if (!pendingOutput) return;
    const attempt = attempts.data?.items.find(
      (item) => item.id === pendingOutput.id
    );
    if (!attempt || !['ready', 'failed'].includes(attempt.status)) return;
    setPendingOutput(null);
    if (pendingOutput.owner !== useAppShellStore.getState().session?.userId)
      return;
    if (attempt.status === 'failed') setDownloadFailed(true);
    else void download(attempt, pendingOutput.kind);
  }, [attempts.data, pendingOutput, download]);
  const snapshot = preview.data?.snapshot;

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('reports.preview.title')}
      </StyledText>
      {snapshot ? (
        <View style={styles.stack}>
          <StyledText>{`${translate('reports.preview.period')}: ${formatDate(snapshot.period.startInstant, currentLocale(), snapshot.period.timeZone)} – ${formatDate(snapshot.period.endExclusiveInstant - 1, currentLocale(), snapshot.period.timeZone)}`}</StyledText>
          <StyledText>{`${translate('reports.preview.generated')}: ${formatDateTime(snapshot.generatedAt, currentLocale())}`}</StyledText>
          <StyledText>{`${translate('reports.preview.dataAsOf')}: ${formatDateTime(snapshot.dataAsOf, currentLocale())}`}</StyledText>
          <StyledText>{`${translate('reports.preview.language')}: ${translate(snapshot.language === 'ar' ? 'common.arabic' : 'common.english')}`}</StyledText>
          <StyledText>{`${translate('reports.preview.currency')}: ${snapshot.currencyCode}`}</StyledText>
          <StyledText>{`${translate('reports.preview.sections')}: ${snapshot.breakdowns.map((item: ReportBreakdown) => translate(`reports.dimension.${item.dimension}` as MessageKey)).join(', ')}`}</StyledText>
          <StyledText>{`${translate('reports.preview.detail')}: ${translate(`reports.schedule.${snapshot.detailLevel}` as MessageKey)}`}</StyledText>
          <StyledText>{`${translate('reports.preview.recipient')}: ${recipientEmail ?? translate('reports.preview.notSet')}`}</StyledText>
          <StyledText>{reportStateTitle(snapshot.dataState)}</StyledText>
          {(['income', 'expense', 'netCashFlow'] as const).map((metric) => (
            <StyledText key={metric}>
              {translate(`reports.metric.${metric}`)}:{' '}
              {hideBalances
                ? '••••'
                : snapshot.summary[metric].value
                  ? formatMinorAmount(
                      snapshot.summary[metric].value.minorUnits,
                      snapshot.currencyCode,
                      currentLocale()
                    )
                  : '—'}
            </StyledText>
          ))}
          {snapshot.breakdowns
            .flatMap((group) => group.items)
            .map((item) => (
              <StyledText key={item.id}>
                {item.label}:{' '}
                {hideBalances
                  ? '••••'
                  : item.value.value
                    ? formatMinorAmount(
                        item.value.value.minorUnits,
                        snapshot.currencyCode,
                        currentLocale()
                      )
                    : '—'}
              </StyledText>
            ))}
        </View>
      ) : (
        <StyledText>
          {translate(
            (preview.error as { code?: string } | null)?.code ===
              'report_account_scope_unavailable'
              ? 'reports.preview.accountScopeUnavailable'
              : preview.isError
                ? 'reports.state.error'
                : 'reports.state.loading'
          )}
        </StyledText>
      )}

      <StyledText variant="subtitle">
        {translate('reports.preview.privacy')}
      </StyledText>
      {isFixtureModeEnabled() ? (
        <View style={styles.actions}>
          <ActionButton
            label={translate('reports.schedule.summary')}
            onPress={() => setDetailLevel('summary')}
            variant="secondary"
          />
          <ActionButton
            label={translate('reports.schedule.detailed')}
            onPress={() => setDetailLevel('detailed')}
            variant="secondary"
          />
        </View>
      ) : null}
      <StyledText>{`${translate('reports.preview.privacyWarning')}: ${translate('reports.preview.emailWarning')}`}</StyledText>
      {isFixtureModeEnabled() ? (
        <StyledText>{translate('reports.preview.mockNotice')}</StyledText>
      ) : null}

      <View style={styles.actions}>
        <ActionButton
          disabled={!preview.data || !recipientEmail || output.isPending}
          label={translate('reports.action.sendTest')}
          onPress={() => submit('send_test')}
        />
        <ActionButton
          disabled={!preview.data || !recipientEmail || output.isPending}
          label={translate('reports.action.sendNow')}
          onPress={() => submit('send_now')}
        />
        <ActionButton
          disabled={!preview.data || output.isPending}
          label={translate('reports.action.download')}
          onPress={() => submit('download')}
          variant="secondary"
        />
        <ActionButton
          disabled={!preview.data || output.isPending}
          label={translate('reports.action.share')}
          onPress={() => submit('share')}
          variant="secondary"
        />
      </View>

      <StyledText variant="subtitle">
        {translate('reports.preview.history')}
      </StyledText>
      {attempts.data?.items.length ? (
        attempts.data.items.map((attempt: ReportOutputAttempt) => (
          <View key={attempt.id} style={styles.historyItem}>
            <StyledText>
              {translate(`reports.output.kind.${attempt.kind}` as MessageKey)}
            </StyledText>
            <StyledText>{outputStateTitle(attempt.status)}</StyledText>
            <StyledText>
              {formatDateTime(attempt.requestedAt, currentLocale())}
            </StyledText>
            {attempt.failureCategory ? (
              <StyledText>
                {translate(
                  `reports.output.failure.${attempt.failureCategory}` as MessageKey
                )}
              </StyledText>
            ) : null}
            {attempt.status === 'ready' ? (
              <ActionButton
                label={translate('reports.action.download')}
                loading={downloading}
                onPress={() => void download(attempt)}
              />
            ) : null}
            {attempt.status === 'failed' ? (
              <ActionButton
                disabled={output.isPending}
                label={translate('reports.action.retry')}
                onPress={() => retry(attempt)}
                variant="secondary"
              />
            ) : null}
          </View>
        ))
      ) : (
        <StyledText>{translate('reports.preview.noHistory')}</StyledText>
      )}
      {output.isError || downloadFailed ? (
        <StyledText accessibilityRole="alert">
          {translate('reports.state.error')}
        </StyledText>
      ) : null}
      <ActionButton
        label={translate('reports.action.retry')}
        loading={attempts.isFetching}
        onPress={() => void attempts.refetch()}
      />
      {attempts.hasNextPage ? (
        <ActionButton
          label={translate('reports.action.more')}
          loading={attempts.isFetchingNextPage}
          onPress={() => void attempts.fetchNextPage()}
        />
      ) : null}
      {attempts.isError ? (
        <ActionButton
          label={translate('reports.action.retry')}
          onPress={() => void attempts.refetch()}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyItem: { borderWidth: 1, gap: 4, padding: 12 }
});
