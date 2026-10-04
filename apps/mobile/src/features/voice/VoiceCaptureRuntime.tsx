import { useVoiceBatches } from './useVoiceBatches';
import { randomUUID } from 'expo-crypto';
import { recordVoiceTiming } from '@/services/platform/voice-timing';
import { recordVoiceDiagnostic } from '@/services/platform/voice-diagnostics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode
} from 'react';
import { usePathname } from 'expo-router';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  VOICE_MAX_DURATION_MS,
  proposalErrors,
  selectedProposals,
  type VoiceErrorCode,
  type VoiceProposalGroup,
  type VoicePermissionState,
  type VoiceSessionState,
  type VoiceTranscript,
  type VoiceTransactionProposal
} from '@/domain/voice-capture';
import {
  coreFinanceKeys,
  invalidateCoreFinanceScopes
} from '@/features/core-finance/core-finance-queries';
import type { NotificationSourceEvent } from '@/services/contracts/assistant-notifications-service';
import { VoiceCaptureError } from '@/services/contracts/voice-capture-service';
import { notificationService } from '@/services/engagement-service';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import { voiceCategoryService } from '@/services/mocks/voice-category-service';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import {
  useVoiceCaptureStore,
  registerVoiceCaptureCleanup
} from '@/state/voice-capture';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';

// Pre-journal audio remains cleanup-owned across component/owner changes.
// Deletion never owns the capture lifecycle. Journal-owned audio uses its
// separate durable cleanup path and must never enter this collection.
const discardedCaptureAudio = new Set<string>();
const captureAudioCleanups = new Map<string, Promise<boolean>>();
function cleanupCaptureAudio(uri: string): Promise<boolean> {
  discardedCaptureAudio.add(uri);
  const existing = captureAudioCleanups.get(uri);
  if (existing) return existing;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const task = Promise.race([
    voiceRecorderService.remove(uri).then(() => {
      discardedCaptureAudio.delete(uri);
      return true;
    }),
    new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), 10000);
    })
  ])
    .catch(() => false)
    .finally(() => {
      if (timeout) clearTimeout(timeout);
      if (captureAudioCleanups.get(uri) === task)
        captureAudioCleanups.delete(uri);
    });
  captureAudioCleanups.set(uri, task);
  return task;
}

function safeError(error: unknown): VoiceErrorCode {
  if (error instanceof VoiceCaptureError) return error.code as VoiceErrorCode;
  if (error instanceof Error && error.message === 'invalid_proposal')
    return 'invalid_proposal';
  return 'unknown';
}

function canRefreshPermissionState(
  state: VoiceSessionState,
  errorCode: VoiceErrorCode | null
) {
  return (
    ['idle', 'permission_required', 'ready'].includes(state) ||
    (state === 'failed' &&
      ['permission_denied', 'permission_permanent'].includes(errorCode ?? ''))
  );
}

function useOwnedVoiceCapture() {
  const session = useVoiceCaptureStore();
  const authenticatedOwner = useAppShellStore((state) =>
    state.session?.status === 'authenticated' ? state.session.userId : null
  );
  const client = useQueryClient();
  const batches = useVoiceBatches(authenticatedOwner);
  const mounted = useRef(true);
  const revision = useRef(0);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const ownerId = useCallback(() => {
    const session = useAppShellStore.getState().session;
    return session?.status === 'authenticated' ? session.userId : null;
  }, []);
  const snapshot = useCallback(
    () => ({
      ownerId: ownerId(),
      revision: revision.current,
      id: useVoiceCaptureStore.getState().id
    }),
    [ownerId]
  );
  const valid = useCallback(
    (attempt: ReturnType<typeof snapshot>) =>
      mounted.current &&
      attempt.ownerId === ownerId() &&
      attempt.revision === revision.current &&
      attempt.id === useVoiceCaptureStore.getState().id,
    [ownerId]
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startInFlight = useRef(false);
  const stopInFlight = useRef(false);
  const captureTrace = useRef<string | null>(null);
  const reRecordInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const suspendedTransport = useRef(false);
  const foreground = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive'
  );
  const resumeTransport = useRef<(() => Promise<void>) | null>(null);
  const emittedNotifications = useRef(new Set<string>());
  const pendingNotifications = useRef(new Map<string, Promise<void>>());
  const recoveryAttempted = useRef(false);
  const startupRecovery = useRef<Promise<void> | null>(null);
  const ownedAudio = useRef<string | null>(null);
  const batchHandoff = useRef<{ uri: string; task: Promise<string> } | null>(
    null
  );
  const permissionSyncInFlight = useRef<Promise<
    VoicePermissionState | undefined
  > | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const fail = useCallback(
    (error: unknown, attempt = snapshot()) => {
      if (!valid(attempt)) return;
      clearTimer();
      const errorCode = safeError(error);
      useVoiceCaptureStore
        .getState()
        .transition(
          errorCode === 'recovery_required' ? 'confirmation_unknown' : 'failed',
          errorCode
        );
      if (errorCode === 'session_expired')
        void useAppShellStore.getState().expireSession();
    },
    [clearTimer, snapshot, valid]
  );

  const syncPermission = useCallback(() => {
    if (permissionSyncInFlight.current) return permissionSyncInFlight.current;
    const attempt = snapshot();
    const pending = (async () => {
      try {
        const permission = await voiceRecorderService.getPermission();
        if (!valid(attempt)) return undefined;
        const current = useVoiceCaptureStore.getState();
        if (canRefreshPermissionState(current.state, current.errorCode)) {
          current.patch({
            permission,
            state: permission === 'granted' ? 'ready' : 'permission_required'
          });
        } else current.patch({ permission });
        return permission;
      } catch (error) {
        const current = useVoiceCaptureStore.getState();
        if (canRefreshPermissionState(current.state, current.errorCode))
          fail(error, attempt);
        return undefined;
      }
    })();
    permissionSyncInFlight.current = pending;
    void pending.finally(() => {
      if (permissionSyncInFlight.current === pending)
        permissionSyncInFlight.current = null;
    });
    return pending;
  }, [fail, snapshot, valid]);

  const waitForPermissionSync = () =>
    permissionSyncInFlight.current ??
    Promise.resolve(useVoiceCaptureStore.getState().permission);

  const requestPermission = async () => {
    const attempt = snapshot();
    try {
      const permission = await voiceRecorderService.requestPermission();
      if (!valid(attempt)) return undefined;
      session.patch({ permission });
      if (permission === 'granted') session.transition('ready');
      else
        session.transition(
          'failed',
          permission === 'permanently_denied'
            ? 'permission_permanent'
            : 'permission_denied'
        );
      return permission;
    } catch (error) {
      fail(error, attempt);
      return undefined;
    }
  };

  const start = async () => {
    const tapTime = performance.now();
    if (!voiceAnalyzerService.queueBatch && startupRecovery.current)
      await startupRecovery.current;
    const current = useVoiceCaptureStore.getState();
    if (
      current.state === 'failed' &&
      (current.group ||
        current.audioReference ||
        ![
          'recording_interrupted',
          'permission_denied',
          'permission_permanent'
        ].includes(current.errorCode ?? ''))
    )
      return;
    if (
      startInFlight.current ||
      ![
        'idle',
        'permission_required',
        'ready',
        'failed',
        'saved',
        'canceled'
      ].includes(useVoiceCaptureStore.getState().state)
    )
      return;
    startInFlight.current = true;
    for (const uri of discardedCaptureAudio) void cleanupCaptureAudio(uri);
    revision.current += 1;
    const attempt = snapshot();
    const traceId = randomUUID();
    captureTrace.current = traceId;
    recordVoiceDiagnostic('capture-start', {
      traceId,
      phase: 'start'
    });
    try {
      const permission = await voiceRecorderService.getPermission();
      if (!valid(attempt)) return;
      session.patch({ permission });
      if (permission !== 'granted') {
        session.transition('requesting_permission');
        if ((await requestPermission()) !== 'granted' || !valid(attempt))
          return;
      }
      if (AppState.currentState === 'background') return;
      session.transition('preparing');
      const prepareTime = performance.now();
      const recording = await voiceRecorderService.start();
      recordVoiceDiagnostic('native-start', {
        traceId,
        recordingId: recording.id,
        phase: 'success'
      });
      recordVoiceTiming('native_start', performance.now() - prepareTime);
      recordVoiceTiming('tap_to_recording', performance.now() - tapTime);
      if (!valid(attempt)) {
        await voiceRecorderService.cancel(recording.id);
        return;
      }
      session.patch({
        recordingId: recording.id,
        startedAt: recording.startedAt,
        timezoneOffsetMinutes: new Date(
          recording.startedAt
        ).getTimezoneOffset(),
        durationMs: 0,
        transcript: null,
        group: null,
        errorCode: null,
        state: 'recording'
      });
      timer.current = setInterval(() => {
        if (!valid(attempt)) return;
        session.patch({
          durationMs:
            voiceRecorderService.duration?.(recording.id) ??
            Math.min(Date.now() - recording.startedAt, VOICE_MAX_DURATION_MS)
        });
      }, 250);
      void recording.finished?.then(() => {
        if (valid(attempt)) void stop(recording.id);
      });
    } catch (error) {
      fail(error, attempt);
    } finally {
      startInFlight.current = false;
    }
  };

  const saveCategoryPreferences = (proposals: VoiceTransactionProposal[]) =>
    Promise.allSettled(
      proposals
        .filter(
          (proposal) =>
            proposal.categoryPreference === 'always_for_merchant' &&
            proposal.merchant &&
            proposal.categoryId
        )
        .map((proposal) =>
          voiceCategoryService.savePreference(
            proposal.merchant!,
            proposal.categoryId!
          )
        )
    );

  const persistProposals = async (
    group: VoiceProposalGroup,
    proposals: VoiceTransactionProposal[],
    operationId: string,
    attempt: ReturnType<typeof snapshot>
  ) => {
    const mutation = await voiceAnalyzerService.confirm({
      group,
      proposals,
      operationId
    });
    if (!valid(attempt)) return;
    void saveCategoryPreferences(proposals);
    void emitVoiceNotification(
      { ...group, proposals },
      proposals.some(hasConfirmedObligationLink) ? 'obligation-link' : 'saved',
      emittedNotifications.current,
      pendingNotifications.current,
      mutation.transactionIds[0]
    );
    void invalidateCoreFinanceScopes(client, mutation.affectedScopes).catch(
      () => undefined
    );
  };

  const openVoiceReview = async (
    group: VoiceProposalGroup,
    proposals: VoiceTransactionProposal[],
    attempt = snapshot()
  ) => {
    if (!valid(attempt)) return;
    if (voiceAnalyzerService.metadata.kind === 'live') {
      const accounts = client.getQueryData<
        readonly { id: string; status: string }[]
      >(coreFinanceKeys.accounts());
      if (
        !accounts ||
        accounts.filter((account) => account.status === 'active').length > 1
      )
        proposals = proposals.map((proposal) => ({
          ...proposal,
          assessments: proposal.assessments
            .filter((field) => field.field !== 'account')
            .concat({
              field: 'account',
              confidence: 0,
              status: 'confirm',
              reasonCode: 'voice.confidence.account',
              confirmed: false
            })
        }));
    }
    const reviewGroup: VoiceProposalGroup = {
      ...group,
      proposals,
      status: 'reviewing',
      saveErrorCode: null
    };
    void emitVoiceNotification(
      reviewGroup,
      proposals.some(hasDuplicateSignal) ? 'duplicate' : 'review-required',
      emittedNotifications.current,
      pendingNotifications.current
    );
    useVoiceCaptureStore.getState().patch({
      group: reviewGroup,
      state: 'proposal_review',
      errorCode: null
    });
  };

  const routeAnalyzedGroup = async (
    group: VoiceProposalGroup,
    attempt = snapshot()
  ) => {
    if (!valid(attempt)) return;
    if (!group.proposals.length) {
      useVoiceCaptureStore.getState().patch({
        state: 'failed',
        durationMs: 0,
        transcript: null,
        group: null,
        errorCode: 'no_speech'
      });
      return;
    }
    await openVoiceReview(group, group.proposals, attempt);
  };

  const analyzeTranscript = async (
    transcript: VoiceTranscript,
    attempt = snapshot()
  ) => {
    if (!valid(attempt)) return;
    const current = useVoiceCaptureStore.getState();
    if (!current.startedAt || current.timezoneOffsetMinutes === null) return;
    current.transition('analyzing');
    try {
      const group = await voiceAnalyzerService.analyze({
        transcript,
        scenario: current.scenario,
        sessionId: current.id,
        recordedAt: current.startedAt,
        timezoneOffsetMinutes: current.timezoneOffsetMinutes
      });
      await routeAnalyzedGroup(group, attempt);
    } catch (error) {
      fail(error, attempt);
    }
  };

  useEffect(() => {
    if (
      recoveryAttempted.current ||
      !['idle', 'ready', 'permission_required'].includes(session.state) ||
      !authenticatedOwner ||
      !voiceAnalyzerService.recoverPending
    )
      return;
    recoveryAttempted.current = true;
    const attempt = snapshot();
    if (voiceAnalyzerService.queueBatch) {
      void batches.recover();
    }
    if (!voiceAnalyzerService.queueBatch) session.transition('recovering');
    const recovering = voiceAnalyzerService
      .recoverPending()
      .then(async (pending) => {
        if (!valid(attempt)) return;
        if (!pending) {
          const current = useVoiceCaptureStore.getState();
          current.transition(
            current.permission === 'granted'
              ? 'ready'
              : current.permission === 'not_requested'
                ? 'idle'
                : 'permission_required'
          );
          return;
        }
        if (pending.saved) {
          void invalidateCoreFinanceScopes(
            client,
            pending.saved.affectedScopes
          ).catch(() => undefined);
          session.patch({
            state: 'saved',
            group: null,
            transcript: null,
            errorCode: null
          });
          return;
        }
        useVoiceCaptureStore.getState().patch({
          startedAt: pending.recordedAt,
          timezoneOffsetMinutes: pending.timezoneOffsetMinutes,
          transcript: pending.transcript,
          state: 'transcribing',
          errorCode: null
        });
        await analyzeTranscript(pending.transcript, attempt);
      })
      .catch((error) => fail(error, attempt));
    startupRecovery.current = recovering;
    void recovering.finally(() => {
      if (startupRecovery.current === recovering)
        startupRecovery.current = null;
    });
    // Recovery is intentionally one-shot for this mounted authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail, session.state, authenticatedOwner]);

  const stop = async (
    recordingId = useVoiceCaptureStore.getState().recordingId
  ) => {
    if (!recordingId || stopInFlight.current) return;
    stopInFlight.current = true;
    const attempt = snapshot();
    const traceId = captureTrace.current ?? undefined;
    clearTimer();
    session.transition('stopping');
    recordVoiceDiagnostic('ui-state', {
      traceId,
      recordingId,
      phase: 'stopping'
    });
    let audioReference: string | null = null;
    let retainAudio = false;
    let handedOff = false;
    try {
      const audio = await voiceRecorderService.stop(recordingId);
      audioReference = audio.uri;
      ownedAudio.current = audio.uri;
      if (!valid(attempt)) return;
      session.patch({
        audioReference,
        recordingId: null,
        startedAt: audio.recordedAt,
        durationMs: audio.durationMs,
        state: 'transcribing'
      });
      const current = useVoiceCaptureStore.getState();
      if (voiceAnalyzerService.queueBatch && voiceAnalyzerService.runBatch) {
        const releaseTime = performance.now();
        const handoff = voiceAnalyzerService.queueBatch(
          audio,
          usePreferenceStore.getState().locale,
          current.timezoneOffsetMinutes ??
            new Date(audio.recordedAt).getTimezoneOffset()
        );
        batchHandoff.current = { uri: audio.uri, task: handoff };
        const captureId = await handoff;
        recordVoiceDiagnostic('journal-handoff', {
          traceId,
          recordingId,
          captureId,
          phase: 'success'
        });
        recordVoiceTiming('journal_handoff', performance.now() - releaseTime);
        const handoffTime = performance.now();
        retainAudio = true;
        handedOff = true;
        ownedAudio.current = null;
        if (!valid(attempt)) return;
        session.patch({
          state: 'ready',
          durationMs: 0,
          audioReference: null,
          recordingId: null,
          transcript: null,
          group: null,
          errorCode: null
        });
        recordVoiceTiming('handoff_to_ready', performance.now() - handoffTime);
        recordVoiceDiagnostic('ui-state', {
          captureId,
          phase: 'ready',
          elapsedMs: performance.now() - handoffTime
        });
        if (foreground.current) batches.submit(captureId);
        return;
      }
      const transcript = await voiceAnalyzerService.transcribe(
        audioReference,
        current.scenario,
        audio.durationMs,
        usePreferenceStore.getState().locale,
        {
          recordedAt: audio.recordedAt,
          timezoneOffsetMinutes:
            current.timezoneOffsetMinutes ??
            new Date(audio.recordedAt).getTimezoneOffset(),
          contentType: audio.contentType
        }
      );
      if (!valid(attempt)) return;
      session.setTranscript(transcript);
      await analyzeTranscript(transcript, attempt);
    } catch (error) {
      retainAudio =
        voiceAnalyzerService.metadata.kind === 'live' &&
        [
          'offline',
          'processing_timed_out',
          'operation_cancelled',
          'recovery_required'
        ].includes(safeError(error));
      fail(error, attempt);
    } finally {
      stopInFlight.current = false;
      if (batchHandoff.current?.uri === audioReference)
        batchHandoff.current = null;
      let cleanupFailed = false;
      if (audioReference && !retainAudio) {
        cleanupFailed = !(await cleanupCaptureAudio(audioReference));
        if (!cleanupFailed && ownedAudio.current === audioReference)
          ownedAudio.current = null;
      }
      if (valid(attempt))
        session.patch({
          audioReference:
            !handedOff && (cleanupFailed || retainAudio)
              ? audioReference
              : null,
          recordingId: null
        });
    }
  };

  const cancelRecording = useCallback(
    async (errorCode?: VoiceErrorCode) => {
      revision.current += 1;
      const attempt = snapshot();
      clearTimer();
      const current = useVoiceCaptureStore.getState();
      const audio = ownedAudio.current ?? current.audioReference;
      const handoff = batchHandoff.current;
      current.transition('stopping');
      await voiceRecorderService
        .cancel(current.recordingId ?? undefined)
        .catch(() => undefined);
      if (handoff && !errorCode)
        void handoff.task
          .then((id) => voiceAnalyzerService.cancelBatch?.(id))
          .catch(() => undefined);
      if (audio && audio !== handoff?.uri) await cleanupCaptureAudio(audio);
      if (ownedAudio.current === audio) ownedAudio.current = null;
      if (!valid(attempt)) return;
      current.patch({ recordingId: null, audioReference: null, durationMs: 0 });
      current.transition(errorCode ? 'failed' : 'ready', errorCode);
    },
    [clearTimer, snapshot, valid]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      const current = useVoiceCaptureStore.getState();
      if (
        state === 'active' &&
        canRefreshPermissionState(current.state, current.errorCode)
      )
        void syncPermission();
      if (state === 'active' && suspendedTransport.current) {
        suspendedTransport.current = false;
        void resumeTransport.current?.();
      } else if (
        state === 'background' &&
        ['recording', 'preparing', 'requesting_permission'].includes(
          current.state
        )
      )
        void cancelRecording('recording_interrupted');
      else if (
        state === 'background' &&
        !batchHandoff.current &&
        [
          'uploading',
          'transcribing',
          'analyzing',
          'recovering',
          'saving'
        ].includes(current.state)
      ) {
        suspendedTransport.current = true;
        revision.current += 1;
        voiceAnalyzerService.pausePending?.();
        current.patch({
          state:
            current.state === 'saving' ? 'confirmation_unknown' : 'recovering',
          errorCode: null
        });
      }
    });
    return () => subscription.remove();
  }, [cancelRecording, syncPermission]);

  useEffect(() => {
    if (
      previousPath.current !== pathname &&
      ['recording', 'preparing'].includes(useVoiceCaptureStore.getState().state)
    )
      void cancelRecording('recording_interrupted');
    previousPath.current = pathname;
  }, [pathname, cancelRecording]);

  useEffect(() => {
    mounted.current = true;
    const clearOwnedWork = async () => {
      revision.current += 1;
      clearTimer();
      recoveryAttempted.current = false;
      emittedNotifications.current.clear();
      pendingNotifications.current.clear();
      voiceAnalyzerService.pausePending?.();
      const audio = ownedAudio.current;
      const handoffAudio = batchHandoff.current?.uri;
      ownedAudio.current = null;
      const current = useVoiceCaptureStore.getState();
      if (['recording', 'preparing', 'stopping'].includes(current.state))
        current.patch({
          recordingId: null,
          audioReference: null,
          durationMs: 0,
          state: 'ready'
        });
      await voiceRecorderService.cancel().catch(() => undefined);
      if (audio && audio !== handoffAudio) await cleanupCaptureAudio(audio);
    };
    const unregisterCleanup = registerVoiceCaptureCleanup(clearOwnedWork);
    const unsubscribe = useAppShellStore.subscribe((next, previous) => {
      if (
        next.session?.userId !== previous.session?.userId ||
        next.session?.status !== previous.session?.status
      ) {
        useVoiceCaptureStore.getState().reset();
        void clearOwnedWork();
      } else if (
        next.privacyLock?.appLockStatus !==
          previous.privacyLock?.appLockStatus &&
        next.privacyLock?.appLockStatus !== 'unlocked' &&
        ['recording', 'preparing'].includes(
          useVoiceCaptureStore.getState().state
        )
      )
        void cancelRecording('recording_interrupted');
    });
    return () => {
      mounted.current = false;
      void clearOwnedWork();
      unregisterCleanup();
      unsubscribe();
    };
  }, [clearTimer, cancelRecording]);

  const editTranscript = (text: string) => {
    if (!session.transcript) return;
    session.setTranscript({ ...session.transcript, text, editedByUser: true });
  };

  const analyze = async () => {
    if (!session.transcript) return;
    await analyzeTranscript(session.transcript);
  };

  const updateProposal = (
    id: string,
    value: Partial<VoiceTransactionProposal>
  ) => session.updateProposal(id, value);

  const confirmField = (proposalId: string, field: string) => {
    const proposal = session.group?.proposals.find(
      (item) => item.id === proposalId
    );
    if (!proposal) return;
    updateProposal(proposalId, {
      assessments: proposal.assessments.map((item) =>
        item.field === field ? { ...item, confirmed: true } : item
      )
    });
  };

  const save = async (includeAll = false) => {
    if (
      ['saving', 'confirmation_unknown'].includes(
        useVoiceCaptureStore.getState().state
      )
    )
      return;
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
      session.patch({
        group,
        state: 'proposal_review',
        errorCode: 'invalid_proposal'
      });
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
      session.patch({
        group,
        state: 'proposal_review',
        errorCode: 'invalid_proposal'
      });
      return;
    }
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    const attempt = snapshot();
    session.patch({
      state: 'saving',
      group: { ...group, status: 'saving', saveErrorCode: null }
    });
    try {
      await persistProposals(group, selected, group.id, attempt);
      if (!valid(attempt)) return;
      session.patch({
        transcript: null,
        group: null,
        state: 'saved',
        errorCode: null
      });
    } catch (error) {
      if (!valid(attempt)) return;
      if (
        voiceAnalyzerService.metadata.kind === 'live' &&
        safeError(error) === 'recovery_required'
      ) {
        session.patch({
          state: 'confirmation_unknown',
          errorCode: 'recovery_required'
        });
        return;
      }
      void emitVoiceNotification(
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
    } finally {
      saveInFlight.current = false;
    }
  };

  const reRecord = async () => {
    if (
      ['saving', 'confirmation_unknown'].includes(
        useVoiceCaptureStore.getState().state
      )
    )
      return;
    if (reRecordInFlight.current) return;
    reRecordInFlight.current = true;
    try {
      await voiceAnalyzerService.discardPending?.();
      await cancelRecording();
      session.patch({
        transcript: null,
        group: null,
        state: 'ready',
        errorCode: null
      });
      await start();
    } catch (error) {
      fail(error);
    } finally {
      reRecordInFlight.current = false;
    }
  };

  const cancel = async () => {
    if (saveInFlight.current || session.state === 'confirmation_unknown')
      return;
    try {
      revision.current += 1;
      await cancelRecording();
      await voiceAnalyzerService.discardPending?.();
      const current = useVoiceCaptureStore.getState();
      const permission = current.permission;
      current.reset();
      current.patch({
        permission,
        state: permission === 'granted' ? 'ready' : 'permission_required'
      });
    } catch (error) {
      fail(error);
    }
  };

  const retry = async () => {
    if (
      voiceAnalyzerService.metadata.kind !== 'live' ||
      !voiceAnalyzerService.recoverPending ||
      session.errorCode === 're_record_required'
    ) {
      await reRecord();
      return;
    }
    const attempt = snapshot();
    session.transition('recovering');
    try {
      const pending = await voiceAnalyzerService.recoverPending(true);
      if (!valid(attempt)) return;
      if (!pending) {
        session.transition('ready');
        return;
      }
      if (pending.saved) {
        void invalidateCoreFinanceScopes(
          client,
          pending.saved.affectedScopes
        ).catch(() => undefined);
        session.patch({
          state: 'saved',
          group: null,
          transcript: null,
          errorCode: null
        });
        return;
      }
      session.patch({
        startedAt: pending.recordedAt,
        timezoneOffsetMinutes: pending.timezoneOffsetMinutes,
        transcript: pending.transcript
      });
      await analyzeTranscript(pending.transcript, attempt);
      const audio = ownedAudio.current;
      if (audio) {
        await cleanupCaptureAudio(audio);
        if (ownedAudio.current === audio) ownedAudio.current = null;
      }
    } catch (error) {
      fail(error, attempt);
    }
  };

  resumeTransport.current = retry;
  return {
    live: voiceAnalyzerService.metadata.kind === 'live',
    automatic: Boolean(voiceAnalyzerService.queueBatch),
    batches,
    syncPermission,
    session,
    waitForPermissionSync,
    requestPermission,
    openSettings: voiceRecorderService.openSettings,
    start,
    stop,
    cancelRecording,
    editTranscript,
    analyze,
    updateProposal,
    confirmField,
    removeProposal: (id: string) => {
      const remaining =
        session.group?.proposals.filter(
          (proposal) => proposal.id !== id && proposal.status !== 'removed'
        ) ?? [];
      if (
        voiceAnalyzerService.metadata.kind === 'live' &&
        remaining.length === 0
      )
        void cancel();
      else session.removeProposal(id);
    },
    selectAll: session.selectAll,
    setScenario: session.setScenario,
    save,
    reRecord,
    retry,
    cancel
  };
}

type VoiceRuntime = ReturnType<typeof useOwnedVoiceCapture>;
const VoiceRuntimeContext = createContext<VoiceRuntime | null>(null);

export function VoiceCaptureProvider({ children }: { children: ReactNode }) {
  const runtime = useOwnedVoiceCapture();
  return (
    <VoiceRuntimeContext.Provider value={runtime}>
      {children}
    </VoiceRuntimeContext.Provider>
  );
}

export function useVoiceRuntime() {
  const runtime = useContext(VoiceRuntimeContext);
  if (!runtime) throw new Error('VoiceCaptureProvider is required');
  return runtime;
}

type VoiceNotificationOutcome =
  'saved' | 'review-required' | 'duplicate' | 'obligation-link' | 'failed';

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
  const result = notificationService
    .createFromSource(voiceNotification(group, outcome, transactionId))
    .catch(() =>
      notificationService.createFromSource(
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
    availableActions: target
      ? [{ kind: 'view', expiresAt: null, sourceVersion: 1 }]
      : [],
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
