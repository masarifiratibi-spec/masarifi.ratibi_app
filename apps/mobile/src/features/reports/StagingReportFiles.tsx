import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { ReportQuery } from '@/services/contracts/reports-service';
import { reportsService } from '@/services/reports-service';
import {
  saveReportPdf,
  openReportPdf,
  removeReportPdfCache,
  type SavedReportPdf
} from '@/services/platform/report-pdf-file';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import type { MessageKey } from '@/localization/i18n';
import { pdfFailureMessage } from './report-state';

export function stagingReportFilesEnabled() {
  return (
    process.env.EXPO_PUBLIC_STAGING_REPORT_FILES === 'true' &&
    process.env.EXPO_PUBLIC_API_URL ===
      'https://api.staging.masarifiratibi.com/qa-reports'
  );
}

type Props = {
  owner: string;
  input: ReportQuery;
  id: string | null;
  onIdChange: (id: string | null) => void;
  operation: React.MutableRefObject<string | null>;
};

export function StagingReportFiles({
  owner,
  input,
  id,
  onIdChange,
  operation
}: Props) {
  const locale = usePreferenceStore((state) => state.locale);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState<SavedReportPdf | null>(null);
  const active = useRef(true);
  const flight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const current = () =>
    active.current && useAppShellStore.getState().session?.userId === owner;
  const check = () => {
    if (!current()) throw Error('REPORT_CONTEXT_CHANGED');
  };
  const clear = () => {
    onIdChange(null);
    operation.current = null;
    setReady(false);
    setConfirm(false);
    setSaved(null);
  };
  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (flight.current || !current()) return;
    const abort = new AbortController();
    flight.current = true;
    controller.current = abort;
    setBusy(true);
    try {
      await task(abort.signal);
    } catch (error) {
      if (current()) {
        const code = (error as { code?: string })?.code;
        if (id && (code === 'expired' || code === 'not_found')) clear();
        setMessage(pdfFailureMessage(error));
      }
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  }
  const refresh = async (reportId: string, signal: AbortSignal) => {
    const attempt = await reportsService.getAttempt(reportId, { signal });
    check();
    if (attempt.id !== reportId) throw Error('REPORT_GENERATION_FAILED');
    if (attempt.status === 'failed') {
      clear();
      throw Error('REPORT_GENERATION_FAILED');
    }
    setReady(attempt.status === 'ready');
    setMessage(
      attempt.status === 'ready'
        ? 'reports.pdf.fileReady'
        : 'reports.pdf.processing'
    );
    return attempt;
  };
  async function create(signal: AbortSignal) {
    const key = (operation.current ??= randomUUID());
    const preview = await reportsService.previewOutput(
      { ...input, language: locale, detailLevel: 'summary' },
      { signal }
    );
    check();
    const { value } = await reportsService.requestOutput(
      { kind: 'download', previewId: preview.previewId },
      key,
      current
    );
    check();
    onIdChange(value.id);
    await refresh(value.id, signal);
  }
  const download = async (signal: AbortSignal) => {
    if (!id) return;
    const report = await refresh(id, signal);
    if (report.status !== 'ready') return;
    if (Platform.OS === 'android') {
      const file = await saveReportPdf(report, check, signal);
      try {
        check();
        setSaved(file);
        setMessage('reports.pdf.success');
      } finally {
        await removeReportPdfCache(file);
      }
    } else {
      if (
        !report.downloadUrl ||
        !report.downloadUrlExpiresAt ||
        report.downloadUrlExpiresAt <= Date.now() ||
        new URL(report.downloadUrl).protocol !== 'https:'
      )
        throw Error('REPORT_DOWNLOAD_INVALID');
      await Linking.openURL(report.downloadUrl);
    }
  };
  const remove = async () => {
    if (!confirm || !id || !reportsService.deletePdfFile) return;
    await reportsService.deletePdfFile(id, current);
    check();
    clear();
    setMessage('reports.pdf.fileDeleted');
  };
  return (
    <>
      <StyledText variant="title">reports.pdf.files</StyledText>
      {message && (
        <StyledText accessibilityLiveRegion="polite">{message}</StyledText>
      )}
      {!id && (
        <ActionButton
          label="reports.pdf.createFile"
          disabled={busy}
          onPress={() => void run(create)}
        />
      )}
      {id && !ready && (
        <ActionButton
          label="reports.pdf.refreshFile"
          disabled={busy}
          onPress={() =>
            void run(async (signal) => {
              await refresh(id, signal);
            })
          }
        />
      )}
      {id && ready && !confirm && (
        <>
          <ActionButton
            label="reports.pdf.saveFile"
            disabled={busy}
            onPress={() => void run(download)}
          />
          {saved && (
            <ActionButton
              label="reports.pdf.open"
              disabled={busy}
              onPress={() => void run(() => openReportPdf(saved, check))}
            />
          )}
          <ActionButton
            label="reports.pdf.deleteFile"
            variant="destructive"
            disabled={busy}
            onPress={() => setConfirm(true)}
          />
        </>
      )}
      {confirm && (
        <>
          <ActionButton
            label="reports.pdf.confirmDelete"
            variant="destructive"
            disabled={busy}
            onPress={() => void run(remove)}
          />
          <ActionButton
            label="designSystem.action.cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => setConfirm(false)}
          />
        </>
      )}
    </>
  );
}
