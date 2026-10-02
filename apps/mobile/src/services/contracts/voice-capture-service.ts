import type {
  VoicePermissionState,
  VoiceProposalGroup,
  VoiceScenario,
  VoiceTranscript
} from '@/domain/voice-capture';
import type { CapabilityContractMetadata } from './capability-contract';

export const voiceRecorderServiceCapability: CapabilityContractMetadata = {
  capability: 'voice-capture.recorder',
  majorVersion: 1,
  owner: 'voice-capture',
  providerKinds: ['platform'],
  unavailableOutcome: 'voice.permission.unavailable'
};

export const voiceAnalyzerServiceCapability: CapabilityContractMetadata = {
  capability: 'voice-capture.analyzer',
  majorVersion: 1,
  owner: 'voice-capture',
  providerKinds: ['mock', 'live'],
  unavailableOutcome: 'voice.error.analysis_unavailable'
};

export interface VoiceRecording {
  id: string;
  startedAt: number;
  finished?: Promise<void>;
}

export interface VoiceCapturedAudio {
  uri: string;
  durationMs: number;
  contentType: 'audio/m4a';
  recordedAt: number;
}

export interface VoiceRecorderService {
  getPermission(): Promise<VoicePermissionState>;
  requestPermission(): Promise<VoicePermissionState>;
  openSettings(): Promise<void>;
  start(maxDurationMs?: number): Promise<VoiceRecording>;
  stop(recordingId: string): Promise<VoiceCapturedAudio>;
  cancel(recordingId?: string): Promise<void>;
  duration?(recordingId: string): number;
  remove(audioReference: string): Promise<void>;
}

export interface VoiceAnalyzerService {
  transcribe(
    audioReference: string,
    scenario: VoiceScenario,
    durationMs?: number,
    locale?: 'ar' | 'en',
    capture?: {
      recordedAt: number;
      timezoneOffsetMinutes: number;
      contentType: string;
    }
  ): Promise<VoiceTranscript>;
  recoverPending?(retryAudio?: boolean): Promise<
    | {
        saved?: undefined;
        transcript: VoiceTranscript;
        recordedAt: number;
        timezoneOffsetMinutes: number;
      }
    | { saved: { transactionIds: string[]; affectedScopes: readonly string[] } }
    | null
  >;
  pausePending?(): void;
  discardPending?(): Promise<void>;
  analyze(input: {
    transcript: VoiceTranscript;
    scenario: VoiceScenario;
    sessionId: string;
    recordedAt: number;
    timezoneOffsetMinutes: number;
  }): Promise<VoiceProposalGroup>;
  confirm(input: {
    group: VoiceProposalGroup;
    proposals: readonly VoiceProposalGroup['proposals'][number][];
    operationId: string;
  }): Promise<{ transactionIds: string[]; affectedScopes: readonly string[] }>;
}

export class VoiceCaptureError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VoiceCaptureError';
  }
}
