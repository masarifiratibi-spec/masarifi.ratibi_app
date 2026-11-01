import { getClerkInstance } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';

const redirectUrl = 'masarifi-benchmark://sso-callback';

export async function startBenchmarkGoogleSignIn() {
  const ownerId = process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
  if (!ownerId || !/^user_[A-Za-z0-9]+$/.test(ownerId))
    throw new Error('Invalid benchmark runtime identity');
  const clerk = getClerkInstance();
  const client = clerk.client;
  if (!client) throw new Error('appShell.auth.unavailable');
  // The generic SDK SSO helper automatically transfers unknown users to sign-up.
  const started = await client.signIn.create({
    strategy: 'oauth_google',
    redirectUrl,
    signUpIfMissing: false
  });
  const externalUrl =
    started.firstFactorVerification.externalVerificationRedirectURL;
  if (!externalUrl || externalUrl.protocol !== 'https:')
    throw new Error('appShell.auth.unavailable');
  const authSessionResult = await WebBrowser.openAuthSessionAsync(
    externalUrl.toString(),
    redirectUrl
  );
  if (
    authSessionResult.type === 'cancel' ||
    authSessionResult.type === 'dismiss'
  )
    return { createdSessionId: null, authSessionResult };
  if (authSessionResult.type !== 'success')
    throw new Error('appShell.auth.unavailable');

  let rotatingTokenNonce: string;
  try {
    // React Native's URL hostname/pathname getters do not parse custom schemes.
    const callbackTarget = authSessionResult.url.split('?')[0];
    if (callbackTarget !== redirectUrl || authSessionResult.url.includes('#'))
      throw new Error();
    const callback = new URL(authSessionResult.url);
    decodeURIComponent(callback.search);
    const nonces = callback.searchParams.getAll('rotating_token_nonce');
    if (
      callback.searchParams.has('error') ||
      nonces.length !== 1 ||
      !nonces[0].trim()
    )
      throw new Error();
    rotatingTokenNonce = nonces[0];
  } catch {
    throw new Error('appShell.auth.unavailable');
  }

  const signIn = await client.signIn.reload({ rotatingTokenNonce });
  const verification = signIn.firstFactorVerification;
  if (verification.status === 'transferable')
    throw new Error('googleAuth.incomplete');
  // These public error fields also back the SDK's future existingSession getter.
  const existingSessionId =
    verification.status === 'failed' &&
    verification.error?.code === 'identifier_already_signed_in'
      ? verification.error.meta?.sessionId
      : undefined;
  const sessionId =
    signIn.status === 'complete' ? signIn.createdSessionId : existingSessionId;
  if (!sessionId) throw new Error('googleAuth.incomplete');
  const session = client.sessions.find((item) => item.id === sessionId);
  if (!session || session.status !== 'active')
    throw new Error('googleAuth.incomplete');
  if (session.user?.id !== ownerId)
    throw new Error('BENCHMARK_OWNER_NOT_ADMITTED');
  if (clerk.session?.id !== sessionId || clerk.user?.id !== ownerId)
    await clerk.setActive({ session: sessionId });
  if (
    clerk.session?.id !== sessionId ||
    clerk.session.status !== 'active' ||
    clerk.user?.id !== ownerId
  )
    throw new Error('Clerk session missing');
  return { createdSessionId: sessionId, authSessionResult };
}
