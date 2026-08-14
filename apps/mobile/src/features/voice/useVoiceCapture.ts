import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  VOICE_MAX_DURATION_MS,
  proposalErrors,
  proposalToTransactionInput,
  selectedProposals,
  type VoiceErrorCode,
  type VoiceProposalGroup,
  type VoiceTransactionProposal
} from '@/domain/voice-capture';
import { scopeToKey } from '@/features/core-finance/core-finance-queries';
import type { NotificationSourceEvent } from '@/services/contracts/assistant-notifications-service';
import { VoiceCaptureError } from '@/services/contracts/voice-capture-service';
import { assistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { voiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import { voiceCategoryService } from '@/services/mocks/voice-category-service';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { useVoiceCaptureStore } from '@/state/voice-capture';

function safeError(error: unknown): VoiceErrorCode {
  if (error instanceof VoiceCaptureError) return error.code as VoiceErrorCode;
  if (error instanceof Error && error.message === 'invalid_proposal') return 'invalid_proposal';
  return 'unknown';
}

export function useVoiceCapture() {
  const session = useVoiceCaptureStore();
  const client = useQueryClient();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const emittedNotifications = useRef(new Set<string>());
  const pendingNotifications = useRef(new Map<string, Promise<void>>());

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      clearTimer();
      useVoiceCaptureStore.getState().transition('failed', safeError(error));
    },
    [clearTimer]
  );

  useEffect(() => {
    void voiceRecorderService
      .getPermission()
      .then((permission) =>
        useVoiceCaptureStore.getState().patch({
          permission,
          state: permission === 'granted' ? 'ready' : 'permission_required'
        })
      )
      .catch(fail);
  }, [fail]);

  const requestPermission = async () => {
    try {
      const permission = await voiceRecorderService.requestPermission();
      session.patch({ permission });
      if (permission === 'granted') session.transition('ready');
      else
        session.transition(
          'failed',
          permission === 'permanently_denied'
            ? 'permission_permanent'
            : 'permission_denied'
        );
    } catch (error) {
      fail(error);
    }
  };

  const start = async () => {
    try {
      const recording = await voiceRecorderService.start();
      const timezoneOffsetMinutes = new Date(recording.startedAt).getTimezoneOffset();
      session.patch({
        recordingId: recording.id,
        startedAt: recording.startedAt,
        timezoneOffsetMinutes,
        durationMs: 0,
        errorCode: null,
        state: 'recording'
      });
      const startedAt = recording.startedAt;
      timer.current = setInterval(() => {
        const durationMs = Math.min(Date.now() - startedAt, VOICE_MAX_DURATION_MS);
        session.patch({ durationMs });
        if (durationMs >= VOICE_MAX_DURATION_MS) void stop(recording.id);
      }, 250);
    } catch (error) {
      fail(error);
    }
  };

  const stop = async (recordingId = session.recordingId) => {
    if (!recordingId) return;
    clearTimer();
    session.transition('stopping');
    let audioReference: string | null = null;
    try {
      audioReference = await voiceRecorderService.stop(recordingId);
      session.patch({ audioReference, recordingId: null, state: 'transcribing' });
      const transcript = await voiceAnalyzerService.transcribe(audioReference, session.scenario);
      session.setTranscript(transcript);
      session.transition('transcript_review');
    } catch (error) {
      fail(error);
    } finally {
      if (audioReference) await voiceRecorderService.remove(audioReference);
      session.patch({ audioReference: null, recordingId: null });
    }
  };

  const cancelRecording = useCallback(async (errorCode?: VoiceErrorCode) => {
    clearTimer();
    if (session.recordingId) await voiceRecorderService.cancel(session.recordingId);
    if (session.audioReference) await voiceRecorderService.remove(session.audioReference);
    session.patch({ recordingId: null, audioReference: null, durationMs: 0 });
    if (errorCode) session.transition('failed', errorCode);
    else session.transition('ready');
  }, [clearTimer, session]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && useVoiceCaptureStore.getState().state === 'recording')
        void cancelRecording('recording_interrupted');
    });
    return () => subscription.remove();
  }, [cancelRecording]);

  useEffect(
    () => () => {
      clearTimer();
      const current = useVoiceCaptureStore.getState();
      if (current.recordingId) void voiceRecorderService.cancel(current.recordingId);
      if (current.audioReference) void voiceRecorderService.remove(current.audioReference);
    },
    [clearTimer]
  );

  const editTranscript = (text: string) => {
    if (!session.transcript) return;
    session.setTranscript({ ...session.transcript, text, editedByUser: true });
  };

  const analyze = async () => {
    if (!session.transcript || !session.startedAt || session.timezoneOffsetMinutes === null) return;
    session.transition('analyzing');
    try {
      const group = await voiceAnalyzerService.analyze({
        transcript: session.transcript,
        scenario: session.scenario,
        sessionId: session.id,
        recordedAt: session.startedAt,
        timezoneOffsetMinutes: session.timezoneOffsetMinutes
      });
      session.setGroup(group);
      session.transition('proposal_review');
    } catch (error) {
      fail(error);
    }
  };

  const updateProposal = (id: string, value: Partial<VoiceTransactionProposal>) =>
    session.updateProposal(id, value);

  const confirmField = (proposalId: string, field: string) => {
    const proposal = session.group?.proposals.find((item) => item.id === proposalId);
    if (!proposal) return;
    updateProposal(proposalId, {
      assessments: proposal.assessments.map((item) =>
        item.field === field ? { ...item, confirmed: true } : item
      )
    });
  };

  const save = async (includeAll = false) => {
    if (!session.group) return;
    const group = includeAll
      ? {
          ...session.group,
          proposals: session.group.proposals.map((item) =>
            item.status === 'removed' ? item : { ...item, selected: true }
          )
        }
      : session.group;
    const selected = selectedProposals(group);
    if (!selected.length) {
      await emitVoiceNotification(
        group,
        'review-required',
        emittedNotifications.current,
        pendingNotifications.current
      );
      session.patch({ group, state: 'proposal_review', errorCode: 'invalid_proposal' });
      return;
    }
    if (selected.some(hasDuplicateSignal)) {
      await emitVoiceNotification(
        group,
        'duplicate',
        emittedNotifications.current,
        pendingNotifications.current
      );
      session.patch({ group, state: 'proposal_review', errorCode: null });
      return;
    }
    if (selected.some((item) => proposalErrors(item).length)) {
      await emitVoiceNotification(
        group,
        'review-required',
        emittedNotifications.current,
        pendingNotifications.current
      );
      session.patch({ group, state: 'proposal_review', errorCode: 'invalid_proposal' });
      return;
    }
    session.patch({
      state: 'saving',
      group: { ...group, status: 'saving', saveErrorCode: null }
    });
    try {
      const result = await coreFinanceService.createTransactionsAtomically(
        selected.map(proposalToTransactionInput),
        group.id,
        'voice'
      );
      await Promise.allSettled(
        selected
          .filter(
            (proposal) =>
              proposal.categoryPreference === 'always_for_merchant' &&
              proposal.merchant &&
              proposal.categoryId
          )
          .map((proposal) =>
            voiceCategoryService.savePreference(proposal.merchant!, proposal.categoryId!)
          )
      );
      await emitVoiceNotification(
        group,
        selected.some(hasConfirmedObligationLink)
            ? 'obligation-link'
            : 'saved',
        emittedNotifications.current,
        pendingNotifications.current,
        result.value[0]?.id
      );
      await Promise.all(
        result.affectedScopes.map((scope) =>
          client.invalidateQueries({ queryKey: scopeToKey(scope) })
        )
      );
      session.patch({ transcript: null, group: null, state: 'saved', errorCode: null });
    } catch {
      await emitVoiceNotification(
        group,
        'failed',
        emittedNotifications.current,
        pendingNotifications.current
      );
      session.patch({
        state: 'failed',
        errorCode: 'save_failed',
        group: { ...group, status: 'failed', saveErrorCode: 'save_failed' }
      });
    }
  };

  const reRecord = async () => {
    await cancelRecording();
    session.patch({ transcript: null, group: null, state: 'ready', errorCode: null });
  };

  const cancel = async () => {
    clearTimer();
    if (session.recordingId) await voiceRecorderService.cancel(session.recordingId);
    if (session.audioReference) await voiceRecorderService.remove(session.audioReference);
    session.reset();
  };

  return {
    session,
    requestPermission,
    openSettings: voiceRecorderService.openSettings,
    start,
    stop,
    cancelRecording,
    editTranscript,
    analyze,
    updateProposal,
    confirmField,
    removeProposal: session.removeProposal,
    selectAll: session.selectAll,
    setScenario: session.setScenario,
    save,
    reRecord,
    cancel
  };
}

type VoiceNotificationOutcome =
  | 'saved'
  | 'review-required'
  | 'duplicate'
  | 'obligation-link'
  | 'failed';

async function emitVoiceNotification(
  group: VoiceProposalGroup,
  outcome: VoiceNotificationOutcome,
  emitted: Set<string>,
  pending: Map<string, Promise<void>>,
  transactionId?: string
) {
  const eventKey = `voice:${group.id}:${outcome}`;
  if (emitted.has(eventKey)) return;
  const replay = pending.get(eventKey);
  if (replay) return replay;
  const result = assistantNotificationsService
    .createFromSource(voiceNotification(group, outcome, transactionId))
    .catch(() =>
      assistantNotificationsService.createFromSource(
        voiceNotification(group, outcome, transactionId)
      )
    )
    .then(() => {
      emitted.add(eventKey);
    })
    .catch(() => undefined)
    .finally(() => {
      pending.delete(eventKey);
    });
  pending.set(eventKey, result);
  return result;
}

function voiceNotification(
  group: VoiceProposalGroup,
  outcome: VoiceNotificationOutcome,
  transactionId?: string
): NotificationSourceEvent {
  const obligationId =
    group.proposals.find(hasConfirmedObligationLink)?.obligationId ??
    group.proposals.find(hasConfirmedObligationLink)?.recurringSuggestion
      ?.candidateObligationIds[0] ??
    null;
  const target =
    outcome === 'obligation-link' && obligationId
      ? { kind: 'obligation' as const, obligationId }
      : transactionId
        ? { kind: 'transaction' as const, transactionId }
        : null;
  return {
    eventKey: `voice:${group.id}:${outcome}`,
    category: outcome === 'obligation-link' ? 'obligation' : 'transaction',
    eventType: `voice.${outcome}`,
    titleKey: `notifications.voice.${outcome}.title`,
    bodyKey: `notifications.voice.${outcome}.body`,
    messageValues: { outcome, count: group.proposals.length },
    sensitivity: 'protected',
    target,
    availableActions: target ? [{ kind: 'view', expiresAt: null, sourceVersion: 1 }] : [],
    occurredAt: Date.now()
  };
}

function hasDuplicateSignal(proposal: VoiceTransactionProposal) {
  return Boolean(proposal.duplicateOfTransactionId);
}

function hasConfirmedObligationLink(proposal: VoiceTransactionProposal) {
  return (
    proposal.recurringSuggestion?.kind === 'existing_obligation' &&
    proposal.recurringSuggestion.confirmed &&
    Boolean(
      proposal.obligationId ??
        proposal.recurringSuggestion.candidateObligationIds[0]
    )
  );
}
