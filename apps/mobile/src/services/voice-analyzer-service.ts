import type { CapabilityProviderHandle } from './contracts/capability-contract';
import {
  VoiceCaptureError,
  type VoiceAnalyzerService,
  voiceAnalyzerServiceCapability
} from './contracts/voice-capture-service';
import { voiceAnalyzerService as developmentVoiceAnalyzerService } from './mocks/voice-analyzer-service';

const unavailableVoiceAnalyzerService: CapabilityProviderHandle<VoiceAnalyzerService> = {
  metadata: {
    id: 'unavailable-voice-analyzer',
    capability: voiceAnalyzerServiceCapability.capability,
    majorVersion: voiceAnalyzerServiceCapability.majorVersion,
    kind: 'live',
    availability: 'unavailable'
  },
  async transcribe() {
    throw new VoiceCaptureError('analysis_unavailable');
  },
  async analyze() {
    throw new VoiceCaptureError('analysis_unavailable');
  }
};

export const voiceAnalyzerService = __DEV__
  ? developmentVoiceAnalyzerService
  : unavailableVoiceAnalyzerService;
