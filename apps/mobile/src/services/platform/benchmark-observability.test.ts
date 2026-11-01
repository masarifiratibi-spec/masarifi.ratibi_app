import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import {
  benchmarkFetch,
  recordBenchmarkEvent,
  recordFirstProtectedRoute,
  recordPreferencesStorageOutcome
} from './benchmark-observability';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
let log: jest.SpyInstance;
beforeEach(() => {
  log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => log.mockRestore());
const events = () =>
  log.mock.calls
    .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
    .map(([, value]) => JSON.parse(value));

it('keeps ordinary preference outcomes silent', () => {
  const inspect = jest.fn(() => {
    throw Error('PRIVATE');
  });
  const error = Object.defineProperties(
    {},
    { code: { get: inspect }, message: { get: inspect } }
  );
  recordPreferencesStorageOutcome('write', 'failure', error);
  recordPreferencesStorageOutcome('read', 'success');
  expect(events()).toEqual([]);
  expect(inspect).not.toHaveBeenCalled();
});

it.each([
  ['ERR_WRITE', 'write'],
  ['ERR_ENCRYPT', 'encrypt'],
  ['ERR_DECRYPT', 'decrypt'],
  ['ERR_KEY_STORE', 'keystore'],
  ['ERR_UNAVAILABLE', 'native_unavailable'],
  ['ERR_MODULE_NOT_FOUND', 'native_unavailable'],
  ['ERR_METHOD_NOT_FOUND', 'native_function_missing'],
  ['ERR_NULL_KEY', 'argument'],
  ['ERR_INVALID_ARGS_NUMBER', 'argument'],
  ['ERR_NULL_ARGUMENT', 'argument'],
  ['ERR_INCOMPATIBLE_ARG_TYPE', 'argument'],
  ['ERR_DYNAMIC_CAST', 'argument'],
  ['ERR_MISSING_TYPE_CONVERTER', 'argument'],
  ['ERR_INVALID_EXPECTED_TYPE', 'argument'],
  ['TOKEN_MARKER', 'unknown']
])('classifies %s without serializing the error', (code, errorClass) => {
  const restore = installBenchmarkEnvironment();
  try {
    recordPreferencesStorageOutcome('write', 'failure', {
      code,
      message: 'TOKEN_MARKER OWNER_MARKER https://URL_MARKER.invalid',
      name: 'PRIVATE_NAME',
      stack: 'PRIVATE_STACK',
      value: 'PRIVATE_PREFERENCES',
      key: 'PRIVATE_KEY'
    });
    expect(events()).toEqual([
      {
        kind: 'preferences',
        operation: 'write',
        outcome: 'failure',
        errorClass,
        rejectionShape: 'code_message',
        boundary: 'unrecognized',
        argumentOrdinal: 'none',
        atMs: expect.any(Number)
      }
    ]);
    expect(JSON.stringify(events())).not.toMatch(/MARKER|PRIVATE/);
  } finally {
    restore();
  }
});

it('distinguishes JavaScript type errors and records successful reads', () => {
  const restore = installBenchmarkEnvironment();
  try {
    recordPreferencesStorageOutcome(
      'read',
      'failure',
      new TypeError('PRIVATE')
    );
    recordPreferencesStorageOutcome('read', 'success');
    expect(events()).toEqual([
      {
        kind: 'preferences',
        operation: 'read',
        outcome: 'failure',
        errorClass: 'type',
        rejectionShape: 'message_only',
        boundary: 'unrecognized',
        argumentOrdinal: 'none',
        atMs: expect.any(Number)
      },
      {
        kind: 'preferences',
        operation: 'read',
        outcome: 'success',
        errorClass: 'none',
        atMs: expect.any(Number)
      }
    ]);
  } finally {
    restore();
  }
});

it.each([
  ['An error occurred when writing to key', 'write'],
  ['Could not encrypt the value for key', 'encrypt'],
  ['Could not decrypt the value for key', 'decrypt'],
  ['An error occurred when accessing the keystore', 'keystore'],
  [
    'ExpoSecureStore.setValueWithKeyAsync is not a function',
    'native_function_missing'
  ],
  [
    'ExpoSecureStore.getValueWithKeyAsync is not a function',
    'native_function_missing'
  ],
  ['An error occurred when saving PRIVATE', 'unknown']
])(
  'classifies only the allowlisted upstream fragment %s after Release code transformation',
  (fragment, errorClass) => {
    const restore = installBenchmarkEnvironment();
    try {
      const error = Object.assign(
        new Error(
          `Call to function rejected. ${fragment}: PRIVATE_VALUE PRIVATE_KEY PRIVATE_OWNER https://PRIVATE_URL.invalid`
        ),
        { code: 'ERR_S' }
      );
      recordPreferencesStorageOutcome('write', 'failure', error);
      expect(events()).toEqual([
        {
          kind: 'preferences',
          operation: 'write',
          outcome: 'failure',
          errorClass,
          rejectionShape: 'code_message',
          boundary: 'unrecognized',
          argumentOrdinal: 'none',
          atMs: expect.any(Number)
        }
      ]);
      expect(JSON.stringify(events())).not.toMatch(
        /PRIVATE|ERR_S|Call to|SecureStore|An error occurred|Could not/
      );
    } finally {
      restore();
    }
  }
);

it.each(['code', 'message'])(
  'contains a throwing error %s accessor inside diagnostics',
  (field) => {
    const restore = installBenchmarkEnvironment();
    try {
      const error = Object.defineProperty({}, field, {
        get: () => {
          throw Error('PRIVATE');
        }
      });
      expect(() =>
        recordPreferencesStorageOutcome('read', 'failure', error)
      ).not.toThrow();
      expect(events()).toEqual([
        {
          kind: 'preferences',
          operation: 'read',
          outcome: 'failure',
          errorClass: 'unknown',
          rejectionShape: 'unreadable',
          boundary: 'unrecognized',
          argumentOrdinal: 'none',
          atMs: expect.any(Number)
        }
      ]);
    } finally {
      restore();
    }
  }
);

it('rejects invalid preference enums and strips private event extras', () => {
  const restore = installBenchmarkEnvironment();
  try {
    const valid = {
      kind: 'preferences',
      operation: 'write',
      outcome: 'failure',
      errorClass: 'unknown',
      rejectionShape: 'code_message',
      boundary: 'unrecognized',
      argumentOrdinal: 'none'
    } as const;
    recordBenchmarkEvent({ ...valid, value: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, operation: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, outcome: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, errorClass: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, outcome: 'success' } as never);
    recordBenchmarkEvent({ ...valid, errorClass: 'none' } as never);
    recordBenchmarkEvent({
      ...valid,
      outcome: 'success',
      errorClass: 'none'
    } as never);
    recordBenchmarkEvent({ ...valid, rejectionShape: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, boundary: 'PRIVATE' } as never);
    recordBenchmarkEvent({ ...valid, argumentOrdinal: 'PRIVATE' } as never);
    recordBenchmarkEvent({
      ...valid,
      errorClass: 'jsi_argument_conversion'
    } as never);
    recordBenchmarkEvent({ ...valid, boundary: 'jsi_conversion' } as never);
    recordBenchmarkEvent({
      ...valid,
      errorClass: 'kotlin_argument_conversion'
    } as never);
    recordBenchmarkEvent({
      ...valid,
      rejectionShape: 'primitive',
      errorClass: 'encrypt'
    } as never);
    recordBenchmarkEvent({
      ...valid,
      rejectionShape: 'unreadable',
      boundary: 'kotlin_read_wrapper'
    } as never);
    expect(events()).toEqual([{ ...valid, atMs: expect.any(Number) }]);
  } finally {
    restore();
  }
});

it.each([
  [
    '[getValueWithKeyAsync] Cannot convert ',
    'jsi_argument_conversion',
    'jsi_conversion',
    'none'
  ],
  [
    '[setValueWithKeyAsync] Cannot convert ',
    'jsi_argument_conversion',
    'jsi_conversion',
    'none'
  ],
  [
    "Call to function 'ExpoSecureStore.getValueWithKeyAsync' has been rejected. The 2nd argument cannot be cast to type PRIVATE",
    'kotlin_argument_conversion',
    'kotlin_read_wrapper',
    'second'
  ],
  [
    "Call to function 'ExpoSecureStore.setValueWithKeyAsync' has been rejected. The 3rd argument cannot be cast to type PRIVATE",
    'kotlin_argument_conversion',
    'kotlin_write_wrapper',
    'third'
  ],
  [
    'The 1st argument cannot be cast to type PRIVATE',
    'kotlin_argument_conversion',
    'unrecognized',
    'first'
  ],
  [
    "The 2nd argument cannot be cast to type PRIVATE. Cannot create a record of the type: 'PRIVATE'",
    'record_conversion',
    'unrecognized',
    'second'
  ],
  [
    "Cannot find type converter for 'PRIVATE'",
    'converter_unavailable',
    'unrecognized',
    'none'
  ],
  [
    "Cannot obtain ExpectedType form 'PRIVATE'",
    'converter_unavailable',
    'unrecognized',
    'none'
  ],
  ['The react context has been lost', 'context_lost', 'unrecognized', 'none'],
  ['The app context has been lost', 'context_lost', 'unrecognized', 'none'],
  [
    "Call to function 'ExpoSecureStore.getValueWithKeyAsync' has been rejected. PRIVATE",
    'native_unexpected',
    'kotlin_read_wrapper',
    'none'
  ],
  [
    "Call to function 'ExpoSecureStore.setValueWithKeyAsync' has been rejected. PRIVATE",
    'native_unexpected',
    'kotlin_write_wrapper',
    'none'
  ],
  ['PRIVATE', 'native_unexpected', 'unrecognized', 'none'],
  [
    'The 4th argument cannot be cast to type PRIVATE',
    'native_unexpected',
    'unrecognized',
    'none'
  ],
  ['[PRIVATE] Cannot convert ', 'native_unexpected', 'unrecognized', 'none']
])(
  'classifies the fixed native marker %s without exposing its payload',
  (marker, errorClass, boundary, argumentOrdinal) => {
    const restore = installBenchmarkEnvironment();
    try {
      recordPreferencesStorageOutcome('read', 'failure', {
        code: 'ERR_UNEXPECTED',
        message: `${marker}'PRIVATE_VALUE PRIVATE_KEY PRIVATE_OWNER https://PRIVATE_URL.invalid`,
        get name() {
          throw Error('PRIVATE_NAME');
        },
        get stack() {
          throw Error('PRIVATE_STACK');
        },
        get cause() {
          throw Error('PRIVATE_CAUSE');
        }
      });
      expect(events()).toEqual([
        {
          kind: 'preferences',
          operation: 'read',
          outcome: 'failure',
          errorClass,
          rejectionShape: 'code_message',
          boundary,
          argumentOrdinal,
          atMs: expect.any(Number)
        }
      ]);
      expect(JSON.stringify(events())).not.toMatch(
        /PRIVATE|ERR_UNEXPECTED|ExpoSecureStore|Cannot convert|argument cannot/
      );
    } finally {
      restore();
    }
  }
);

it.each([
  [undefined, 'primitive'],
  [null, 'primitive'],
  ['PRIVATE', 'primitive'],
  [7, 'primitive'],
  [{}, 'other_object'],
  [{ code: 'PRIVATE' }, 'other_object'],
  [{ message: 'PRIVATE' }, 'message_only'],
  [{ code: 7, message: 'PRIVATE' }, 'message_only'],
  [{ code: 'PRIVATE', message: 'PRIVATE' }, 'code_message']
])(
  'reports only the fixed envelope shape for rejection %#',
  (error, rejectionShape) => {
    const restore = installBenchmarkEnvironment();
    try {
      recordPreferencesStorageOutcome('read', 'failure', error);
      expect(events()).toEqual([
        {
          kind: 'preferences',
          operation: 'read',
          outcome: 'failure',
          errorClass: 'unknown',
          rejectionShape,
          boundary: 'unrecognized',
          argumentOrdinal: 'none',
          atMs: expect.any(Number)
        }
      ]);
      expect(JSON.stringify(events())).not.toContain('PRIVATE');
    } finally {
      restore();
    }
  }
);

it.each([
  ['An error occurred when writing to key'],
  ['The react context has been lost'],
  ["Call to function 'ExpoSecureStore.getValueWithKeyAsync' has been rejected."]
])('ignores the marker %s beyond the 4096 character scan limit', (marker) => {
  const restore = installBenchmarkEnvironment();
  try {
    recordPreferencesStorageOutcome('read', 'failure', {
      message: `${'x'.repeat(4096)}${marker}`
    });
    expect(events()[0]).toMatchObject({
      errorClass: 'unknown',
      rejectionShape: 'message_only',
      boundary: 'unrecognized',
      argumentOrdinal: 'none'
    });
  } finally {
    restore();
  }
});

it('reads only code and message once without enumerating the native rejection', () => {
  const restore = installBenchmarkEnvironment();
  const reads: string[] = [];
  try {
    const error = new Proxy(
      {
        code: 'ERR_UNEXPECTED',
        message: 'The react context has been lost PRIVATE'
      },
      {
        get(target, property) {
          if (property !== 'code' && property !== 'message')
            throw Error('PRIVATE_PROPERTY');
          reads.push(property);
          return target[property];
        },
        ownKeys() {
          throw Error('PRIVATE_ENUMERATION');
        }
      }
    );
    recordPreferencesStorageOutcome('read', 'failure', error);
    expect(events()[0]).toMatchObject({
      errorClass: 'context_lost',
      rejectionShape: 'code_message'
    });
    expect(reads).toEqual(['code', 'message']);
    expect(JSON.stringify(events())).not.toContain('PRIVATE');
  } finally {
    restore();
  }
});

it('recognizes a marker ending exactly at the scan limit', () => {
  const restore = installBenchmarkEnvironment();
  try {
    const marker = 'The react context has been lost';
    recordPreferencesStorageOutcome('read', 'failure', {
      message: `${'x'.repeat(4096 - marker.length)}${marker}`
    });
    expect(events()[0]).toMatchObject({ errorClass: 'context_lost' });
  } finally {
    restore();
  }
});

it('shares the 400 event cap between preference diagnostics and other metrics', () => {
  jest.isolateModules(() => {
    const isolated = jest.requireActual<
      typeof import('./benchmark-observability')
    >('./benchmark-observability');
    const restore = installBenchmarkEnvironment();
    try {
      for (let i = 0; i < 399; i++)
        isolated.recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
      isolated.recordPreferencesStorageOutcome('write', 'failure', {
        code: 'ERR_WRITE'
      });
      isolated.recordPreferencesStorageOutcome('read', 'success');
      isolated.recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
      const inspect = jest.fn(() => {
        throw Error('PRIVATE');
      });
      isolated.recordPreferencesStorageOutcome(
        'read',
        'failure',
        Object.defineProperty({}, 'message', { get: inspect })
      );
      expect(events()).toHaveLength(400);
      expect(inspect).not.toHaveBeenCalled();
      expect(events()[399]).toMatchObject({
        kind: 'preferences',
        errorClass: 'write'
      });
    } finally {
      restore();
    }
  });
});

it('keeps ordinary timing, transport and route paths silent', async () => {
  recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
  recordFirstProtectedRoute('unlock');
  const response = { status: 200 } as Response;
  expect(
    await benchmarkFetch(
      async () => response,
      'https://marker.invalid/token-owner-title',
      { method: 'GET' }
    )
  ).toBe(response);
  expect(events()).toEqual([]);
});

it('serializes only fixed enums and numeric metadata, ignoring private extras and invalid values', () => {
  const restore = installBenchmarkEnvironment();
  try {
    const extra = {
      token: 'TOKEN_MARKER',
      owner: 'OWNER_MARKER',
      title: 'TITLE_MARKER',
      url: 'https://URL_MARKER.invalid'
    };
    recordBenchmarkEvent({
      kind: 'timing',
      stage: 'startup.fonts',
      elapsedMs: 12,
      ...extra
    });
    recordBenchmarkEvent({ kind: 'home', outcome: 'ready', ...extra });
    recordBenchmarkEvent({
      kind: 'timing',
      stage: 'TOKEN_MARKER',
      elapsedMs: 12
    } as never);
    recordBenchmarkEvent({ kind: 'home', outcome: 'OWNER_MARKER' } as never);
    recordBenchmarkEvent({
      kind: 'timing',
      stage: 'startup.fonts',
      elapsedMs: NaN
    });
    expect(events()).toHaveLength(2);
    expect(events()[0]).toMatchObject({
      kind: 'timing',
      stage: 'startup.fonts',
      elapsedMs: 12,
      atMs: expect.any(Number)
    });
    expect(JSON.stringify(events())).not.toMatch(
      /TOKEN_MARKER|OWNER_MARKER|TITLE_MARKER|URL_MARKER/
    );
  } finally {
    restore();
  }
});

it('records real GET/HEAD attempts, normalized groups and nullable unknown lengths', async () => {
  const restore = installBenchmarkEnvironment();
  try {
    const request = jest.fn(
      async () =>
        ({ status: 200, headers: { get: () => '321' } }) as unknown as Response
    );
    await benchmarkFetch(
      request,
      'https://URL_MARKER.invalid/api/v1/transactions/OWNER_MARKER?token=TOKEN_MARKER&title=TITLE_MARKER',
      { method: 'GET' }
    );
    request.mockResolvedValueOnce({ status: 304 } as Response);
    await benchmarkFetch(request, '/api/v1/reports/OWNER_MARKER', {
      method: 'HEAD'
    });
    request.mockRejectedValueOnce(new TypeError('TOKEN_MARKER'));
    await expect(
      benchmarkFetch(request, '/api/v1/savings-goals/OWNER_MARKER', {})
    ).rejects.toThrow('TOKEN_MARKER');
    await benchmarkFetch(request, '/api/v1/transactions', { method: 'POST' });
    expect(request).toHaveBeenCalledTimes(4);
    expect(events()).toMatchObject([
      {
        kind: 'transport',
        group: 'ledger',
        method: 'GET',
        status: 200,
        payloadBytes: 321,
        outcome: 'response',
        requestSequence: expect.any(Number),
        atMs: expect.any(Number),
        elapsedMs: expect.any(Number)
      },
      {
        kind: 'transport',
        group: 'reports',
        method: 'HEAD',
        status: 304,
        payloadBytes: null,
        outcome: 'response'
      },
      {
        kind: 'transport',
        group: 'planning',
        method: 'GET',
        status: null,
        payloadBytes: null,
        outcome: 'network'
      }
    ]);
    expect(events()[1].requestSequence).toBe(events()[0].requestSequence + 1);
    expect(events()[2].requestSequence).toBe(events()[1].requestSequence + 1);
    expect(JSON.stringify(events())).not.toMatch(
      /TOKEN_MARKER|OWNER_MARKER|TITLE_MARKER|URL_MARKER/
    );
  } finally {
    restore();
  }
});

it('leaves body decoding untouched and absorbs unavailable log sinks', async () => {
  const restore = installBenchmarkEnvironment();
  try {
    const response = {
      status: 200,
      json: jest.fn(() => {
        throw Error('private');
      }),
      headers: { get: () => null }
    } as unknown as Response;
    expect(
      await benchmarkFetch(async () => response, '/api/v1/reports', {})
    ).toBe(response);
    expect(response.json).not.toHaveBeenCalled();
    expect(events()[0]).toMatchObject({
      payloadBytes: null,
      outcome: 'response'
    });
    log.mockImplementation(() => {
      throw Error('log unavailable');
    });
    expect(
      await benchmarkFetch(async () => response, '/api/v1/reports', {})
    ).toBe(response);
    expect(() =>
      recordBenchmarkEvent({ kind: 'home', outcome: 'ready' })
    ).not.toThrow();
  } finally {
    restore();
  }
});

it('emits the first protected route once per process and caps all output at 400 events', () => {
  jest.isolateModules(() => {
    const isolated = jest.requireActual<
      typeof import('./benchmark-observability')
    >('./benchmark-observability');
    const restore = installBenchmarkEnvironment();
    try {
      isolated.recordFirstProtectedRoute('unlock');
      isolated.recordFirstProtectedRoute('home');
      for (let i = 0; i < 450; i++)
        isolated.recordBenchmarkEvent({ kind: 'home', outcome: 'ready' });
      expect(events()).toHaveLength(400);
      expect(
        events().filter((event) => event.kind === 'protected_route')
      ).toEqual([
        {
          kind: 'protected_route',
          category: 'unlock',
          atMs: expect.any(Number)
        }
      ]);
    } finally {
      restore();
    }
  });
});

it.each(['', 'unknown', '-1', '1.5', '9007199254740992'])(
  'retains unavailable content length as null for %s',
  async (length) => {
    const restore = installBenchmarkEnvironment();
    try {
      await benchmarkFetch(
        async () =>
          ({
            status: 200,
            headers: { get: () => length }
          }) as unknown as Response,
        '/api/v1/budgets',
        {}
      );
      expect(events()[0]).toMatchObject({
        group: 'planning',
        payloadBytes: null
      });
    } finally {
      restore();
    }
  }
);

it('records abort failures without retaining their private errors', async () => {
  const restore = installBenchmarkEnvironment();
  const controller = new AbortController();
  try {
    const error = new Error(
      'TOKEN_MARKER OWNER_MARKER TITLE_MARKER https://URL_MARKER.invalid'
    );
    const request = async () => {
      controller.abort();
      throw error;
    };
    await expect(
      benchmarkFetch(request, '/api/v1/transactions', {
        signal: controller.signal
      })
    ).rejects.toBe(error);
    expect(events()[0]).toMatchObject({
      status: null,
      payloadBytes: null,
      outcome: 'aborted'
    });
    expect(JSON.stringify(events())).not.toMatch(
      /TOKEN_MARKER|OWNER_MARKER|TITLE_MARKER|URL_MARKER/
    );
  } finally {
    restore();
  }
});
