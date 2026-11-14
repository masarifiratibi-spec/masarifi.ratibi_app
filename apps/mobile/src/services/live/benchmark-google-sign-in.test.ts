import { getClerkInstance } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { startBenchmarkGoogleSignIn } from './benchmark-google-sign-in';

jest.mock('@clerk/expo', () => ({ getClerkInstance: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  ...jest.requireActual('expo-web-browser'),
  openAuthSessionAsync: jest.fn()
}));

const redirectUrl = 'masarifi-benchmark://sso-callback';
const owner = 'user_fixtureOwner';

function fixture({
  status = 'complete',
  verificationStatus = 'verified',
  sessionOwner = owner,
  error = null as null | {
    code: string;
    message: string;
    meta?: { sessionId: string };
  },
  createdSessionId = 'session-existing' as string | null
} = {}) {
  const verification = {
    status: verificationStatus,
    error,
    strategy: 'oauth_google',
    externalVerificationRedirectURL: new URL(
      'https://clerk.fixture.test/oauth'
    ),
    attempts: null,
    expireAt: null,
    nonce: null,
    message: null,
    verifiedAtClient: null,
    verifiedFromTheSameClient: () => false
  };
  const completed = {
    status,
    createdSessionId,
    firstFactorVerification: verification
  };
  const signIn = {
    create: jest.fn(async () => ({ firstFactorVerification: verification })),
    reload: jest.fn(async () => completed)
  };
  const session = {
    id: 'session-existing',
    status: 'active',
    user: { id: sessionOwner },
    lastActiveAt: new Date(1000),
    expireAt: new Date(4_000_000_000_000)
  };
  const signUp = { create: jest.fn(), update: jest.fn(), finalize: jest.fn() };
  const clerk = {
    client: { signIn, sessions: [session] },
    session: null as typeof session | null,
    user: null as { id: string } | null,
    setActive: jest.fn(async () => {
      clerk.session = session;
      clerk.user = session.user;
    })
  };
  const readSignUp = jest.fn(() => signUp);
  Object.defineProperty(clerk.client, 'signUp', { get: readSignUp });
  jest.mocked(getClerkInstance).mockReturnValue(clerk as never);
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: 'success',
    url: `${redirectUrl}?rotating_token_nonce=fixture-nonce`
  });
  return { clerk, signIn, signUp, readSignUp, completed, session };
}

let previousOwner: string | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  previousOwner = process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
  process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID = owner;
});
afterEach(() => {
  if (previousOwner === undefined)
    delete process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
  else process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID = previousOwner;
});

test('existing owner completes sign-in and activates the actual SDK session without any signup access', async () => {
  const f = fixture();
  await expect(startBenchmarkGoogleSignIn()).resolves.toMatchObject({
    createdSessionId: 'session-existing'
  });
  expect(f.signIn.create).toHaveBeenCalledWith({
    strategy: 'oauth_google',
    redirectUrl,
    signUpIfMissing: false
  });
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
    'https://clerk.fixture.test/oauth',
    redirectUrl
  );
  expect(f.signIn.reload).toHaveBeenCalledWith({
    rotatingTokenNonce: 'fixture-nonce'
  });
  expect(f.clerk.setActive).toHaveBeenCalledWith({
    session: 'session-existing'
  });
  expect(f.clerk.session).toBe(f.session);
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test.each([
  'transferable',
  'needs_second_factor',
  'missing session',
  'pending session',
  'wrong owner',
  'missing pin'
])('%s refuses activation and never accesses signup', async (scenario) => {
  const f = fixture({
    verificationStatus:
      scenario === 'transferable' ? 'transferable' : 'verified',
    status:
      scenario === 'needs_second_factor' ? 'needs_second_factor' : 'complete',
    sessionOwner: scenario === 'wrong owner' ? 'user_otherOwner' : owner
  });
  if (scenario === 'missing session') f.clerk.client.sessions = [];
  if (scenario === 'pending session') f.session.status = 'pending';
  if (scenario === 'missing pin')
    delete process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow();
  expect(f.clerk.setActive).not.toHaveBeenCalled();
  expect(f.clerk.session).toBeNull();
  expect(f.readSignUp).not.toHaveBeenCalled();
  expect(f.signUp.create).not.toHaveBeenCalled();
});

test.each([
  WebBrowser.WebBrowserResultType.CANCEL,
  WebBrowser.WebBrowserResultType.DISMISS
])('%s preserves cancellation without reload or activation', async (type) => {
  const f = fixture();
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type });
  await expect(startBenchmarkGoogleSignIn()).resolves.toMatchObject({
    createdSessionId: null,
    authSessionResult: { type }
  });
  expect(f.signIn.reload).not.toHaveBeenCalled();
  expect(f.clerk.setActive).not.toHaveBeenCalled();
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test.each([
  'not a url',
  'masarifi://sso-callback?rotating_token_nonce=fixture',
  'masarifi-benchmark://other?rotating_token_nonce=fixture',
  'masarifi-benchmark://sso-callback/extra?rotating_token_nonce=fixture',
  `${redirectUrl}?rotating_token_nonce=`,
  `${redirectUrl}?unrelated=fixture`,
  `${redirectUrl}?rotating_token_nonce=a&rotating_token_nonce=b`,
  `${redirectUrl}?rotating_token_nonce=%ZZ`,
  `${redirectUrl}?rotating_token_nonce=fixture&error=denied`,
  `${redirectUrl}?rotating_token_nonce=fixture#unexpected`
])('malformed callback refuses reload and activation (%#)', async (url) => {
  const f = fixture();
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockResolvedValue({ type: 'success', url });
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
    'appShell.auth.unavailable'
  );
  expect(f.signIn.reload).not.toHaveBeenCalled();
  expect(f.clerk.setActive).not.toHaveBeenCalled();
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test('an already signed-in owner uses the public verification error session ID', async () => {
  const f = fixture({
    status: 'needs_first_factor',
    verificationStatus: 'failed',
    createdSessionId: null,
    error: {
      code: 'identifier_already_signed_in',
      message: 'Already signed in',
      meta: { sessionId: 'session-existing' }
    }
  });
  await expect(startBenchmarkGoogleSignIn()).resolves.toMatchObject({
    createdSessionId: 'session-existing'
  });
  expect(f.clerk.setActive).toHaveBeenCalledWith({
    session: 'session-existing'
  });
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test('an already active matching session is not activated twice', async () => {
  const f = fixture();
  f.clerk.session = f.session;
  f.clerk.user = f.session.user;
  await expect(startBenchmarkGoogleSignIn()).resolves.toMatchObject({
    createdSessionId: 'session-existing'
  });
  expect(f.clerk.setActive).not.toHaveBeenCalled();
});

test('activation that does not publish the actual SDK session cannot report success', async () => {
  const f = fixture();
  f.clerk.setActive.mockImplementation(async () => {});
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
    'Clerk session missing'
  );
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test.each(['create', 'browser', 'reload', 'activate'] as const)(
  '%s errors propagate without any signup fallback',
  async (stage) => {
    const f = fixture();
    const failure = new Error('Fixture SDK unavailable');
    if (stage === 'create') f.signIn.create.mockRejectedValue(failure);
    if (stage === 'browser')
      jest.mocked(WebBrowser.openAuthSessionAsync).mockRejectedValue(failure);
    if (stage === 'reload') f.signIn.reload.mockRejectedValue(failure);
    if (stage === 'activate') f.clerk.setActive.mockRejectedValue(failure);
    await expect(startBenchmarkGoogleSignIn()).rejects.toBe(failure);
    expect(f.readSignUp).not.toHaveBeenCalled();
    if (stage !== 'activate') expect(f.clerk.setActive).not.toHaveBeenCalled();
  }
);

test.each([
  WebBrowser.WebBrowserResultType.LOCKED,
  WebBrowser.WebBrowserResultType.OPENED
])('browser %s does not reload or activate', async (type) => {
  const f = fixture();
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type });
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
    'appShell.auth.unavailable'
  );
  expect(f.signIn.reload).not.toHaveBeenCalled();
  expect(f.clerk.setActive).not.toHaveBeenCalled();
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test('an unrelated failed verification cannot activate an error-provided session', async () => {
  const f = fixture({
    status: 'needs_first_factor',
    verificationStatus: 'failed',
    createdSessionId: null,
    error: {
      code: 'verification_failed',
      message: 'Failed',
      meta: { sessionId: 'session-existing' }
    }
  });
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
    'googleAuth.incomplete'
  );
  expect(f.clerk.setActive).not.toHaveBeenCalled();
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test('activation that leaves a pending SDK session cannot report success', async () => {
  const f = fixture();
  f.clerk.setActive.mockImplementation(async () => {
    f.session.status = 'pending';
    f.clerk.session = f.session;
    f.clerk.user = f.session.user;
  });
  await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
    'Clerk session missing'
  );
  expect(f.readSignUp).not.toHaveBeenCalled();
});

test.each([
  'masarifi-benchmark://wrong-host?rotating_token_nonce=fixture',
  'masarifi-benchmark://sso-callback/extra?rotating_token_nonce=fixture'
])(
  'native URL implementation cannot bypass the exact callback target (%#)',
  async (url) => {
    const f = fixture();
    const originalURL = global.URL;
    global.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url });
    try {
      await expect(startBenchmarkGoogleSignIn()).rejects.toThrow(
        'appShell.auth.unavailable'
      );
      expect(f.signIn.reload).not.toHaveBeenCalled();
      expect(f.clerk.setActive).not.toHaveBeenCalled();
    } finally {
      global.URL = originalURL;
    }
  }
);

test('the approved callback completes with the installed native URL implementation', async () => {
  const f = fixture();
  const originalURL = global.URL;
  global.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
  try {
    await expect(startBenchmarkGoogleSignIn()).resolves.toMatchObject({
      createdSessionId: 'session-existing'
    });
    expect(f.signIn.reload).toHaveBeenCalledWith({
      rotatingTokenNonce: 'fixture-nonce'
    });
  } finally {
    global.URL = originalURL;
  }
});
