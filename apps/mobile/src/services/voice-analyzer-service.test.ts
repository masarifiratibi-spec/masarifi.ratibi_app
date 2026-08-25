import type { VoiceAnalyzerService } from './contracts/voice-capture-service';
import type { CapabilityProviderHandle } from './contracts/capability-contract';

it('keeps fake voice analysis out of production behavior', async () => {
  const devGlobal = global as typeof globalThis & { __DEV__: boolean };
  const originalDev = devGlobal.__DEV__;
  let service!: CapabilityProviderHandle<VoiceAnalyzerService>;

  try {
    Object.defineProperty(global, '__DEV__', { configurable: true, value: false });
    jest.isolateModules(() => {
      service = jest.requireActual('./voice-analyzer-service').voiceAnalyzerService;
    });

    expect(service.metadata.availability).toBe('unavailable');
    await expect(service.transcribe('private://audio', 'clear_en')).rejects.toMatchObject({
      code: 'analysis_unavailable'
    });
  } finally {
    Object.defineProperty(global, '__DEV__', {
      configurable: true,
      value: originalDev
    });
  }
});
