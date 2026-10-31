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
  useReportAttempt,
  useReportInput,
  useReportMutation,
  useReportPreview,
  useReportSchedule
} from './report-queries';
import { outputStateTitle, reportStateTitle } from './report-state';
import { ReportPdfExport } from './ReportPdfExport';

type OutputRequest = Parameters<typeof reportsService.requestOutput>[0];
let outputOperationSequence = 0;

export function ReportPreviewScreen() {
  const fixtureMode = isFixtureModeEnabled();
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
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const downloadFlight = useRef(false);
  const [pendingOutput, setPendingOutput] = useState<{
    id: string;
    kind: 'send_test' | 'send_now' | 'download' | 'share';
    owner: string | null | undefined;
  } | null>(null);
  const [currentOutput, setCurrentOutput] = useState<{
    owner: string | null | undefined;
    value: ReportOutputAttempt;
  } | null>(null);
  const owner = useAppShellStore((state) => state.session?.userId);
  const pendingAttempt = useReportAttempt(
    pendingOutput?.owner === owner ? pendingOutput?.id : undefined
  );
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
            if (owner !== useAppShellStore.getState().session?.userId) return;
            setCurrentOutput({ owner, value: result.value });
            setPendingOutput({
              id: result.value.id,
              kind,
              owner: useAppShellStore.getState().session?.userId
            });
          }
        }
      );
  };
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
    const attempt = pendingAttempt.data;
    if (attempt && attempt.id !== pendingOutput.id) {
      setPendingOutput(null);
      setDownloadFailed(true);
      return;
    }
    if (!attempt || ['scheduled', 'sending'].includes(attempt.status)) return;
    setPendingOutput(null);
    if (pendingOutput.owner !== useAppShellStore.getState().session?.userId)
      return;
    setCurrentOutput({ owner: pendingOutput.owner, value: attempt });
    if (attempt.status === 'failed') setDownloadFailed(true);
    else if (
      !isFixtureModeEnabled() &&
      attempt.status === 'ready' &&
      (pendingOutput.kind === 'download' || pendingOutput.kind === 'share')
    )
      void download(attempt, pendingOutput.kind);
  }, [pendingAttempt.data, pendingOutput, download]);
  const snapshot = preview.data?.snapshot;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.stack, !fixtureMode && styles.liveStack]}
      >
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
            <StyledText>
              {fixtureMode
                ? `${translate('reports.preview.recipient')}: ${recipientEmail ?? translate('reports.preview.notSet')}`
                : translate('reports.pdf.emailPreparing')}
            </StyledText>
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

        {fixtureMode ? (
          <View style={styles.actions}>
            <ActionButton
              disabled={
                !preview.data ||
                !recipientEmail ||
                output.isPending ||
                downloading
              }
              label={translate('reports.action.sendTest')}
              onPress={() => submit('send_test')}
            />
            <ActionButton
              disabled={
                !preview.data ||
                !recipientEmail ||
                output.isPending ||
                downloading
              }
              label={translate('reports.action.sendNow')}
              onPress={() => submit('send_now')}
            />
            <ActionButton
              disabled={!preview.data || output.isPending || downloading}
              label={translate('reports.action.download')}
              onPress={() => submit('download')}
              variant="secondary"
            />
            <ActionButton
              disabled={!preview.data || output.isPending || downloading}
              label={translate('reports.action.share')}
              onPress={() => submit('share')}
              variant="secondary"
            />
          </View>
        ) : null}

        {currentOutput && currentOutput.owner === owner ? (
          <StyledText accessibilityLiveRegion="polite">
            {outputStateTitle(currentOutput.value.status)}
          </StyledText>
        ) : null}
        {output.isError || downloadFailed ? (
          <StyledText accessibilityRole="alert">
            {translate('reports.state.error')}
          </StyledText>
        ) : null}
        {pendingAttempt.isError ? (
          <ActionButton
            label={translate('reports.action.retry')}
            loading={pendingAttempt.isFetching}
            onPress={() => void pendingAttempt.refetch()}
          />
        ) : null}
      </ScrollView>
      {!fixtureMode ? (
        <ReportPdfExport
          input={input}
          offline={!preview.data && preview.isError}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stack: { gap: 12, padding: 16 },
  liveStack: { paddingBottom: 88 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
