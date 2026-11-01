import { Platform } from 'react-native';

const mockDelete = jest.fn(async (): Promise<void> => {});
const mockFileInfo = jest.fn(async () => ({ exists: true, size: 46885 }));
const mockOpenSettings = jest.fn(async () => undefined);
const mockListeners = new Set<
  (status: {
    isFinished: boolean;
    hasError: boolean;
    url: string | null;
    error: string | null;
    id: string;
  }) => void
>();
let mockNativeRecording = false;
const mockRecord = jest.fn(() => {
  mockNativeRecording = true;
});
const mockAudioStop = jest.fn(async () => {
  mockNativeRecording = false;
  queueMicrotask(() =>
    mockListeners.forEach((listener) =>
      listener({
        id: 'native-recorder',
        isFinished: true,
        hasError: false,
        url: 'private://voice.m4a',
        error: null
      })
    )
  );
});
const mockAudioPrepare = jest.fn<Promise<void>, []>(async () => undefined);
const mockAudioRelease = jest.fn();
const mockGetRecordingPermissions = jest.fn(async () => ({
  granted: false,
  canAskAgain: true
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: mockDelete,
  getInfoAsync: mockFileInfo
}));
jest.mock('expo-linking', () => ({ openSettings: mockOpenSettings }));
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: mockGetRecordingPermissions,
  requestRecordingPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
  RecordingPresets: {
    HIGH_QUALITY: {
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      android: { outputFormat: 'mpeg4', audioEncoder: 'aac' }
    }
  },
  AudioModule: {
    AudioRecorder: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: mockAudioPrepare,
      record: mockRecord,
      stop: mockAudioStop,
      release: mockAudioRelease,
      getStatus: () => ({
        isRecording: mockNativeRecording,
        durationMillis: 2832,
        canRecord: true
      }),
      addListener: (
        _name: string,
        listener: Parameters<typeof mockListeners.add>[0]
      ) => {
        mockListeners.add(listener);
        return { remove: () => mockListeners.delete(listener) };
      },
      uri: 'private://voice.m4a'
    }))
  }
}));

// Mocks must be installed before importing the platform adapter.
const { createVoiceRecorderService } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  require('./voice-recorder-service') as typeof import('./voice-recorder-service');

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockNativeRecording = false;
  mockGetRecordingPermissions.mockResolvedValue({
    granted: false,
    canAskAgain: true
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('bounds file inspection after successful Stop and fences its late result from the next recording', async () => {
  jest.useFakeTimers();
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  let resolveInfo!: (value: never) => void;
  mockFileInfo.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveInfo = resolve as typeof resolveInfo;
      })
  );
  const service = createVoiceRecorderService();
  const recording = await service.start();
  const stopping = service.stop(recording.id);
  await jest.advanceTimersByTimeAsync(0);
  expect(resolveInfo).toBeDefined();
  const outcome = Promise.race([
    stopping.then(
      () => 'accepted late audio',
      (error: { code: string }) => error.code
    ),
    new Promise<string>((resolve) =>
      setTimeout(() => resolve('file check still pending'), 5001)
    )
  ]);
  try {
    await jest.advanceTimersByTimeAsync(5001);
    expect(await outcome).toBe('recording_interrupted');
    expect(mockAudioRelease).toHaveBeenCalledTimes(1);
    const next = await service.start();
    resolveInfo({ exists: true, size: 46885 } as never);
    await jest.advanceTimersByTimeAsync(0);
    expect(service.duration?.(next.id)).toBe(2832);
    const cancelling = service.cancel(next.id);
    await jest.advanceTimersByTimeAsync(0);
    await cancelling;
  } finally {
    resolveInfo({ exists: true, size: 46885 } as never);
    await stopping.catch(() => undefined);
    const cancelling = service.cancel();
    await jest.advanceTimersByTimeAsync(0);
    await cancelling;
  }
});

it('releases the capture lock when discard deletion hangs after a failed native Stop', async () => {
  jest.useFakeTimers();
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  let resolveDelete!: () => void;
  mockDelete.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
  );
  const nativeError = new Error('native stop failed');
  mockAudioStop.mockRejectedValueOnce(nativeError);
  const service = createVoiceRecorderService();
  const recording = await service.start();
  const stopping = service.stop(recording.id);
  const outcome = Promise.race([
    stopping.then(
      () => null,
      (error: unknown) => error
    ),
    new Promise<string>((resolve) =>
      setTimeout(() => resolve('discard still pending'), 1)
    )
  ]);
  try {
    await jest.advanceTimersByTimeAsync(1);
    expect(await outcome).toBe(nativeError);
    expect(mockAudioRelease).toHaveBeenCalledTimes(1);
    const next = await service.start();
    resolveDelete();
    await jest.advanceTimersByTimeAsync(0);
    expect(service.duration?.(next.id)).toBe(2832);
    const cancelling = service.cancel(next.id);
    await jest.advanceTimersByTimeAsync(0);
    await cancelling;
  } finally {
    resolveDelete();
    await stopping.catch(() => undefined);
    const cancelling = service.cancel();
    await jest.advanceTimersByTimeAsync(0);
    await cancelling;
  }
});

it('owns preparation before permission resolves so concurrent starts allocate once', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const service = createVoiceRecorderService();
  const results = await Promise.allSettled([service.start(), service.start()]);
  try {
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
  } finally {
    for (const result of results)
      if (result.status === 'fulfilled') await service.cancel(result.value.id);
  }
});

it('releases an allocated recorder when native preparation fails', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const error = new Error('native prepare failed');
  mockAudioPrepare.mockRejectedValueOnce(error);
  const service = createVoiceRecorderService();
  await expect(service.start()).rejects.toBe(error);
  expect(mockAudioRelease).toHaveBeenCalledTimes(1);
});

it('bounds hung preparation and fences a late native completion after Cancel', async () => {
  jest.useFakeTimers();
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  let resolve!: () => void;
  mockAudioPrepare.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  const service = createVoiceRecorderService();
  const starting = service.start();
  const assertion = expect(starting).rejects.toMatchObject({
    code: 'recording_interrupted'
  });
  await jest.advanceTimersByTimeAsync(10_000);
  await assertion;
  await service.cancel();
  resolve();
  await jest.advanceTimersByTimeAsync(1);
  expect(mockRecord).not.toHaveBeenCalled();
  expect(mockAudioRelease).toHaveBeenCalled();
  jest.useRealTimers();
});

it('uses the Expo 55 audio recorder contract', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const service = createVoiceRecorderService();

  expect(await service.getPermission()).toBe('granted');
  const recording = await service.start();
  expect(mockAudioPrepare).toHaveBeenCalledWith(
    expect.objectContaining({
      extension: '.m4a',
      android: { outputFormat: 'mpeg4', audioEncoder: 'aac' }
    })
  );
  expect(await service.stop(recording.id)).toMatchObject({
    uri: 'private://voice.m4a',
    durationMs: 2832,
    contentType: 'audio/m4a',
    recordedAt: recording.startedAt
  });
  expect(mockRecord).toHaveBeenCalledWith({ forDuration: 60 });
});

it('maps permission, records once, and deletes temporary audio', async () => {
  const service = createVoiceRecorderService();
  expect(await service.getPermission()).toBe('denied');
  expect(await service.requestPermission()).toBe('granted');
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const recording = await service.start();
  await expect(service.start()).rejects.toBeDefined();
  expect(await service.stop(recording.id)).toMatchObject({
    uri: 'private://voice.m4a',
    durationMs: 2832
  });
  await service.remove('private://voice.m4a');
  expect(mockDelete).toHaveBeenCalledWith('private://voice.m4a', {
    idempotent: true
  });
});

it('cancels idempotently and exposes settings recovery', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const service = createVoiceRecorderService();
  const recording = await service.start();
  await service.cancel(recording.id);
  await service.cancel(recording.id);
  await service.openSettings();
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockOpenSettings).toHaveBeenCalledTimes(1);
});

it('releases and removes temporary audio when recorder stop fails', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const stopError = new Error('stop failed');
  mockAudioStop.mockRejectedValueOnce(stopError);
  const service = createVoiceRecorderService();
  const recording = await service.start();

  await expect(service.stop(recording.id)).rejects.toBe(stopError);

  expect(mockAudioRelease).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith('private://voice.m4a', {
    idempotent: true
  });
  await expect(service.cancel(recording.id)).resolves.toBeUndefined();
});

it('skips unavailable temporary-file deletion on web', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const service = createVoiceRecorderService();

  expect(await service.getPermission()).toBe('unavailable');
  expect(await service.requestPermission()).toBe('unavailable');
  await service.remove('blob:voice.m4a');

  expect(mockDelete).not.toHaveBeenCalled();
});

it('rejects a resolved native Stop that subsequently reports an Android error', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  mockAudioStop.mockImplementationOnce(async () => {
    mockListeners.forEach((listener) =>
      listener({
        id: 'native-recorder',
        isFinished: true,
        hasError: true,
        url: null,
        error: 'stop failed'
      })
    );
  });
  const service = createVoiceRecorderService();
  const recording = await service.start();
  await expect(service.stop(recording.id)).rejects.toMatchObject({
    code: 'recording_interrupted'
  });
  expect(mockAudioRelease).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith('private://voice.m4a', {
    idempotent: true
  });
});

it('rejects a native Start no-op and releases the recorder', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  mockRecord.mockImplementationOnce(() => undefined);
  await expect(createVoiceRecorderService().start()).rejects.toMatchObject({
    code: 'recording_interrupted'
  });
  expect(mockAudioRelease).toHaveBeenCalledTimes(1);
});

it('shares native Stop across duplicate terminal requests', async () => {
  mockGetRecordingPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true
  });
  const service = createVoiceRecorderService();
  const recording = await service.start();
  const [first, second] = await Promise.all([
    service.stop(recording.id),
    service.stop(recording.id)
  ]);
  expect(first).toEqual(second);
  expect(mockAudioStop).toHaveBeenCalledTimes(1);
  expect(mockAudioRelease).toHaveBeenCalledTimes(1);
});

it('bounds a native Stop that never settles and releases its recorder', async () => {
  jest.useFakeTimers();
  try {
    mockGetRecordingPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: true
    });
    mockAudioStop.mockImplementationOnce(() => new Promise(() => undefined));
    const service = createVoiceRecorderService();
    const recording = await service.start();
    const checked = expect(service.stop(recording.id)).rejects.toMatchObject({
      code: 'recording_interrupted'
    });
    await jest.advanceTimersByTimeAsync(5_000);
    await checked;
    expect(mockAudioRelease).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
