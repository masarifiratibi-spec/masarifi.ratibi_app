import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';

import { VOICE_MAX_DURATION_MS, type VoicePermissionState } from '@/domain/voice-capture';
import {
  VoiceCaptureError,
  type VoiceRecorderService,
  type VoiceRecording
} from '@/services/contracts/voice-capture-service';

function permissionState(status: {
  granted: boolean;
  canAskAgain: boolean;
}): VoicePermissionState {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'denied' : 'permanently_denied';
}

export function createVoiceRecorderService(): VoiceRecorderService {
  const recordings = new Map<string, Audio.Recording>();
  let sequence = 0;
  return {
    async getPermission() {
      return permissionState(await Audio.getPermissionsAsync());
    },
    async requestPermission() {
      return permissionState(await Audio.requestPermissionsAsync());
    },
    async openSettings() {
      await Linking.openSettings();
    },
    async start(maxDurationMs = VOICE_MAX_DURATION_MS): Promise<VoiceRecording> {
      if (maxDurationMs !== VOICE_MAX_DURATION_MS || recordings.size)
        throw new VoiceCaptureError('recording_interrupted');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      const id = `recording-${Date.now()}-${++sequence}`;
      recordings.set(id, recording);
      return { id, startedAt: Date.now() };
    },
    async stop(recordingId) {
      const recording = recordings.get(recordingId);
      if (!recording) throw new VoiceCaptureError('recording_interrupted');
      recordings.delete(recordingId);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new VoiceCaptureError('recording_interrupted');
      return uri;
    },
    async cancel(recordingId) {
      const recording = recordings.get(recordingId);
      if (!recording) return;
      recordings.delete(recordingId);
      try {
        await recording.stopAndUnloadAsync();
      } finally {
        const uri = recording.getURI();
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    },
    async remove(audioReference) {
      if (audioReference) await FileSystem.deleteAsync(audioReference, { idempotent: true });
    }
  };
}

export const voiceRecorderService = createVoiceRecorderService();
