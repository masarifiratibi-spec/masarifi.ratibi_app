import { AppRegistry, AppState, Platform } from 'react-native';

// Native networking and registration are the OS boundaries. Load the actual
// entry point so the regression also checks installation before headless setup.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-router/entry', () => ({}));
jest.mock('expo-notifications', () => ({ registerTaskAsync: jest.fn() }));

const originalFetch = globalThis.fetch;
const legacyFetch = jest.fn(async () => ({ status: 503 }) as Response);
const nativeFetch = jest.requireMock('expo/fetch').fetch as jest.Mock;
let headlessFetch: typeof fetch | undefined;

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'background'
  });
  globalThis.fetch = legacyFetch;
  jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation(() => {
    headlessFetch = globalThis.fetch;
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the real bootstrap after arranging OS/network boundaries.
  require('./index');
});

beforeEach(() => {
  jest.clearAllMocks();
  nativeFetch.mockResolvedValue({ status: 200 });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

it('allows fresh authenticated Android headless requests before any foreground resume', async () => {
  expect(headlessFetch).toBeDefined();
  const response = await headlessFetch!(
    'https://api.staging.example/tracking/status',
    {
      headers: { Authorization: 'Bearer fresh-test-token' }
    }
  );
  expect(response.status).toBe(200);
  expect(legacyFetch).not.toHaveBeenCalled();
});

it.each([
  ['android', 'background', 200],
  ['android', 'inactive', 200],
  ['android', null, 200],
  ['android', 'active', 503],
  ['ios', 'background', 503],
  ['web', 'background', 503]
])(
  'routes %s / %s without changing foreground or other-platform networking',
  async (platform, state, status) => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: platform
    });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: state
    });
    expect(
      (await headlessFetch!('https://api.staging.example/health')).status
    ).toBe(status);
  }
);

it('preserves authenticated POST body, cancellation signal and response on the background transport', async () => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'background'
  });
  const input = new URL('https://api.staging.example/tracking/capture');
  const options = {
    method: 'POST',
    body: JSON.stringify({ operationId: 'existing-idempotency-operation' }),
    headers: {
      Authorization: 'Bearer fresh-test-token',
      'Content-Type': 'application/json'
    },
    signal: new AbortController().signal,
    credentials: 'omit' as const
  };
  const response = {
    status: 201,
    json: async () => ({ state: 'review' })
  } as Response;
  nativeFetch.mockResolvedValue(response);
  expect(await headlessFetch!(input, options)).toBe(response);
  expect(nativeFetch).toHaveBeenCalledWith(input, options);
  expect(legacyFetch).not.toHaveBeenCalled();
});

it('does not replay a failed financial POST on the other transport', async () => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'background'
  });
  const offline = new TypeError('Network request failed');
  nativeFetch.mockRejectedValue(offline);
  await expect(
    headlessFetch!('https://api.staging.example/tracking/capture', {
      method: 'POST'
    })
  ).rejects.toBe(offline);
  expect(nativeFetch).toHaveBeenCalledTimes(1);
  expect(legacyFetch).not.toHaveBeenCalled();
});
