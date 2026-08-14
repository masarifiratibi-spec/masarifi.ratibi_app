const mockDelete = jest.fn(async () => undefined);
const mockOpenSettings = jest.fn(async () => undefined);
const mockStop = jest.fn(async () => undefined);
const mockPrepare = jest.fn(async () => undefined);
const mockStart = jest.fn(async () => undefined);

jest.mock('expo-file-system', () => ({ deleteAsync: mockDelete }));
jest.mock('expo-linking', () => ({ openSettings: mockOpenSettings }));
jest.mock('expo-av', () => ({
  InterruptionModeAndroid: { DoNotMix: 1 },
  InterruptionModeIOS: { DoNotMix: 1 },
  Audio: {
    getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: mockPrepare,
      startAsync: mockStart,
      stopAndUnloadAsync: mockStop,
      getURI: () => 'private://voice.m4a'
    }))
  }
}));

// Mocks must be installed before importing the platform adapter.
const { createVoiceRecorderService } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./voice-recorder-service') as typeof import('./voice-recorder-service');

beforeEach(() => jest.clearAllMocks());

it('maps permission, records once, and deletes temporary audio', async () => {
  const service = createVoiceRecorderService();
  expect(await service.getPermission()).toBe('denied');
  expect(await service.requestPermission()).toBe('granted');
  const recording = await service.start();
  await expect(service.start()).rejects.toBeDefined();
  expect(await service.stop(recording.id)).toBe('private://voice.m4a');
  await service.remove('private://voice.m4a');
  expect(mockDelete).toHaveBeenCalledWith('private://voice.m4a', { idempotent: true });
});

it('cancels idempotently and exposes settings recovery', async () => {
  const service = createVoiceRecorderService();
  const recording = await service.start();
  await service.cancel(recording.id);
  await service.cancel(recording.id);
  await service.openSettings();
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockOpenSettings).toHaveBeenCalledTimes(1);
});
