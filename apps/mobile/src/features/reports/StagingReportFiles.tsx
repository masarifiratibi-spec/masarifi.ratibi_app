import React, { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { ReportQuery } from '@/services/contracts/reports-service';
import { reportsService } from '@/services/reports-service';
import {
  downloadReportPdf,
  openReportPdf,
  type SavedReportPdf
} from '@/services/platform/report-pdf-file';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import type { MessageKey } from '@/localization/i18n';
import { pdfFailureMessage } from './report-state';

type Props = {
  owner: string;
  input: ReportQuery;
};

export function StagingReportFiles({ owner, input }: Props) {
  const locale = usePreferenceStore((state) => state.locale);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState<SavedReportPdf | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const operation = useRef<string | null>(null);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const current = () => {
    const session = useAppShellStore.getState().session;
    return active.current && session?.status === 'authenticated' && session.userId === owner;
  };
  const check = () => {
    if (!current()) throw Error('REPORT_CONTEXT_CHANGED');
  };
  const clear = () => {
    setId(null);
    operation.current = null;
    setReady(false);
    setConfirm(false);
    setSaved(null);
  };
  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (controller.current || !current()) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      await task(abort.signal);
    } catch (error) {
      if (!abort.signal.aborted && current()) {
        const code = (error as { code?: string })?.code;
        if (code === 'expired' || code === 'not_found') {
          clear();
          setMessage('reports.pdf.fileDeleted');
        } else setMessage(pdfFailureMessage(error));
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        if (current()) setBusy(false);
      }
    }
  }
  const recover = async (signal: AbortSignal) => {
    if (!reportsService.findActivePdfFile)
      throw Error('REPORT_GENERATION_FAILED');
    const file = await reportsService.findActivePdfFile({ signal }, current);
    check();
    if (signal.aborted) return;
    setId(file?.id ?? null);
    setReady(file?.status === 'ready');
    setMessage(
      file
        ? file.status === 'ready'
          ? 'reports.pdf.fileReady'
          : 'reports.pdf.processing'
        : null
    );
    setLoaded(true);
  };
  // This component mounts for each opening of the file dialog.
  const initialRecovery = useRef(() => run(recover));
  useEffect(() => {
    active.current = true;
    void initialRecovery.current();
    return () => {
      active.current = false;
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
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
    setId(value.id);
    await refresh(value.id, signal);
  }
  const download = async (signal: AbortSignal) => {
    if (!id) return;
    const report = await refresh(id, signal);
    if (report.status !== 'ready') return;
    const file = await downloadReportPdf(report, check, signal);
    check();
    setSaved(file);
    setMessage('reports.pdf.success');
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
      {!loaded && (
        <ActionButton
          label="reports.pdf.refreshFile"
          disabled={busy}
          onPress={() => void run(recover)}
        />
      )}
      {loaded && !id && (
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
