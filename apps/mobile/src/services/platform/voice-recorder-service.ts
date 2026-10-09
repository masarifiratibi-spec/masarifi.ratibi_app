import { Platform } from 'react-native';
import type { AudioRecorder, RecordingStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { measureVoiceTiming, recordVoiceTiming } from './voice-timing';
import { recordVoiceDiagnostic } from './voice-diagnostics';

import {
  VOICE_MAX_DURATION_MS,
  type VoicePermissionState
} from '@/domain/voice-capture';
import {
  VoiceCaptureError,
  type VoiceCapturedAudio,
  type VoiceRecorderService,
  type VoiceRecording
} from '@/services/contracts/voice-capture-service';

function audioModule(): typeof import('expo-audio') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  return require('expo-audio') as typeof import('expo-audio');
}

function permissionState(status: {
  granted: boolean;
  canAskAgain: boolean;
}): VoicePermissionState {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'denied' : 'permanently_denied';
}

async function removeTemporaryAudio(uri: string | null) {
  if (uri && Platform.OS !== 'web')
    await FileSystem.deleteAsync(uri, { idempotent: true });
}

interface Capture {
  id: string;
  startedAt: number;
  recorder: AudioRecorder | null;
  cancelled: boolean;
  status: RecordingStatus | null;
  durationMs: number;
  finished: Promise<void>;
  complete(): void;
  listener?: { remove(): void };
  timer?: ReturnType<typeof setInterval>;
  starting?: Promise<VoiceRecording>;
  terminal?: Promise<VoiceCapturedAudio>;
}

export function createVoiceRecorderService(): VoiceRecorderService {
  let active: Capture | null = null;
  let sequence = 0;
  const discardedAudio = new Map<string, string>();
  const discarding = new Set<string>();
  const discardAudio = (uri: string, recordingId: string) => {
    discardedAudio.set(uri, recordingId);
    if (discarding.has(uri)) return;
    discarding.add(uri);
    recordVoiceDiagnostic('cleanup', { recordingId, phase: 'start' });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    void Promise.race([
      removeTemporaryAudio(uri).then(() => {
        discardedAudio.delete(uri);
        recordVoiceDiagnostic('cleanup', { recordingId, phase: 'success' });
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new VoiceCaptureError('recording_interrupted')),
          10000
        );
      })
    ])
      .catch(() => {
        recordVoiceDiagnostic('cleanup-error', {
          recordingId,
          phase: 'failure'
        });
        // The service retains ownership for a later cleanup attempt.
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout);
        discarding.delete(uri);
      });
  };

  const observeDuration = (capture: Capture) => {
    if (!capture.recorder || capture.status?.isFinished)
      return capture.durationMs;
    const duration = capture.recorder.getStatus().durationMillis;
    if (Number.isFinite(duration) && duration > 0)
      capture.durationMs = Math.min(duration, VOICE_MAX_DURATION_MS);
    return capture.durationMs;
  };

  const release = async (capture: Capture, discard: boolean) => {
    const started = performance.now();
    if (capture.timer) clearInterval(capture.timer);
    try {
      capture.listener?.remove();
    } catch {
      /* Still release the native resource. */
    }
    const uri = capture.recorder?.uri ?? null;
    try {
      capture.recorder?.release();
    } catch {
      /* Preserve the capture outcome. */
    }
    capture.recorder = null;
    if (active === capture) active = null;
    recordVoiceTiming('native_release', performance.now() - started);
    recordVoiceDiagnostic('native-release', {
      recordingId: capture.id,
      elapsedMs: performance.now() - started
    });
    if (discard && uri) discardAudio(uri, capture.id);
  };

  const preparing = async <T>(
    capture: Capture,
    operation: Promise<T>
  ): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            capture.cancelled = true;
            void operation
              .finally(() => release(capture, true))
              .catch(() => undefined);
            reject(new VoiceCaptureError('recording_interrupted'));
          }, 10_000);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const finish = (capture: Capture): Promise<VoiceCapturedAudio> => {
    if (capture.terminal) return capture.terminal;
    capture.terminal = (async () => {
      let valid = false;
      let completionTimeout: ReturnType<typeof setTimeout> | undefined;
      let fileTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const recorder = capture.recorder;
        if (!recorder) throw new VoiceCaptureError('recording_interrupted');
        recordVoiceDiagnostic('native-stop', {
          recordingId: capture.id,
          phase: 'start'
        });
        observeDuration(capture);
        const terminal = (async () => {
          if (!capture.status?.isFinished && !capture.status?.hasError) {
            // Android returns duration; other platforms use the pre-Stop status.
            const stopped: unknown = await measureVoiceTiming(
              'native_stop',
              () => recorder.stop()
            );
            if (stopped && typeof stopped === 'object') {
              const duration = Reflect.get(stopped, 'durationMillis');
              if (
                typeof duration === 'number' &&
                Number.isFinite(duration) &&
                duration > 0
              )
                capture.durationMs = Math.min(duration, VOICE_MAX_DURATION_MS);
            }
          }
          await measureVoiceTiming('native_completion', () => capture.finished);
        })();
        await Promise.race([
          terminal,
          new Promise<never>((_resolve, reject) => {
            completionTimeout = setTimeout(
              () => reject(new VoiceCaptureError('recording_interrupted')),
              5_000
            );
          })
        ]);
        recordVoiceDiagnostic('native-stop', {
          recordingId: capture.id,
          phase: 'success',
          durationMs: capture.durationMs
        });
        const status = capture.status;
        if (
          capture.cancelled ||
          !status?.isFinished ||
          status.hasError ||
          !status.url ||
          capture.durationMs < 1
        )
          throw new VoiceCaptureError('recording_interrupted');
        recordVoiceDiagnostic('file-check', {
          recordingId: capture.id,
          phase: 'start'
        });
        const info = await measureVoiceTiming('file_check', () =>
          Promise.race([
            FileSystem.getInfoAsync(status.url as string),
            new Promise<never>((_, reject) => {
              fileTimeout = setTimeout(() => {
                capture.cancelled = true;
                recordVoiceDiagnostic('file-check', {
                  recordingId: capture.id,
                  phase: 'timeout'
                });
                reject(new VoiceCaptureError('recording_interrupted'));
              }, 5000);
            })
          ])
        );
        if (
          capture.cancelled ||
          !info.exists ||
          info.isDirectory ||
          info.size < 1
        )
          throw new VoiceCaptureError('recording_interrupted');
        recordVoiceDiagnostic('file-check', {
          recordingId: capture.id,
          phase: 'success',
          bytes: info.size
        });
        valid = true;
        return {
          uri: status.url,
          durationMs: Math.round(capture.durationMs),
          contentType: 'audio/m4a',
          recordedAt: capture.startedAt
        };
      } finally {
        if (completionTimeout) clearTimeout(completionTimeout);
        if (fileTimeout) clearTimeout(fileTimeout);
        await release(capture, !valid || capture.cancelled);
      }
    })();
    return capture.terminal;
  };

  return {
    async getPermission() {
      if (Platform.OS === 'web') return 'unavailable';
      return permissionState(
        await audioModule().getRecordingPermissionsAsync()
      );
    },
    async requestPermission() {
      if (Platform.OS === 'web') return 'unavailable';
      return permissionState(
        await audioModule().requestRecordingPermissionsAsync()
      );
    },
    async openSettings() {
      await Linking.openSettings();
    },
    start(maxDurationMs = VOICE_MAX_DURATION_MS) {
      if (maxDurationMs !== VOICE_MAX_DURATION_MS || active)
        return Promise.reject(new VoiceCaptureError('recording_interrupted'));
      for (const [uri, recordingId] of discardedAudio)
        discardAudio(uri, recordingId);
      let complete!: () => void;
      const capture: Capture = {
        id: 'recording-' + Date.now() + '-' + ++sequence,
        startedAt: 0,
        recorder: null,
        cancelled: false,
        status: null,
        durationMs: 0,
        finished: new Promise<void>((resolve) => {
          complete = resolve;
        }),
        complete: () => complete()
      };
      active = capture;
      recordVoiceDiagnostic('capture-start', {
        recordingId: capture.id,
        phase: 'start'
      });
      capture.starting = (async () => {
        try {
          const audio = audioModule();
          recordVoiceDiagnostic('permission', {
            recordingId: capture.id,
            phase: 'start'
          });
          const permission = permissionState(
            await measureVoiceTiming('permission', () =>
              preparing(capture, audio.getRecordingPermissionsAsync())
            )
          );
          recordVoiceDiagnostic('permission', {
            recordingId: capture.id,
            phase: permission === 'granted' ? 'success' : 'failure'
          });
          if (permission !== 'granted')
            throw new VoiceCaptureError(
              permission === 'permanently_denied'
                ? 'permission_permanent'
                : 'permission_denied'
            );
          if (capture.cancelled)
            throw new VoiceCaptureError('recording_interrupted');
          await measureVoiceTiming('audio_mode', () =>
            preparing(
              capture,
              audio.setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
                interruptionMode: 'doNotMix'
              })
            )
          );
          if (capture.cancelled)
            throw new VoiceCaptureError('recording_interrupted');
          const recorder = new audio.AudioModule.AudioRecorder(
            audio.RecordingPresets.HIGH_QUALITY
          );
          capture.recorder = recorder;
          capture.listener = recorder.addListener(
            'recordingStatusUpdate',
            (status) => {
              capture.status = status;
              if (status.isFinished || status.hasError) capture.complete();
            }
          );
          await measureVoiceTiming('native_prepare', () =>
            preparing(
              capture,
              recorder.prepareToRecordAsync(audio.RecordingPresets.HIGH_QUALITY)
            )
          );
          if (capture.cancelled)
            throw new VoiceCaptureError('recording_interrupted');
          recorder.record({ forDuration: maxDurationMs / 1000 });
          if (!recorder.getStatus().isRecording || capture.status?.hasError)
            throw new VoiceCaptureError('recording_interrupted');
          capture.startedAt = Date.now();
          recordVoiceDiagnostic('native-start', {
            recordingId: capture.id,
            phase: 'success'
          });
          capture.timer = setInterval(() => observeDuration(capture), 250);
          return {
            id: capture.id,
            startedAt: capture.startedAt,
            finished: capture.finished
          };
        } catch (error) {
          await release(capture, true);
          throw error;
        }
      })();
      return capture.starting;
    },
    stop(recordingId) {
      if (!active || active.id !== recordingId)
        return Promise.reject(new VoiceCaptureError('recording_interrupted'));
      return finish(active);
    },
    async cancel(recordingId) {
      const capture = active;
      if (!capture || (recordingId && capture.id !== recordingId)) return;
      capture.cancelled = true;
      await capture.starting?.catch(() => undefined);
      if (active === capture) await finish(capture).catch(() => undefined);
    },
    duration(recordingId) {
      return active?.id === recordingId ? observeDuration(active) : 0;
    },
    async remove(uri) {
      await removeTemporaryAudio(uri);
    }
  };
}

export const voiceRecorderService = createVoiceRecorderService();
