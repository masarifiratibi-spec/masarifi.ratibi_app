import { isClerkAPIResponseError } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { randomUUID } from 'expo-crypto';

// Clerk's Expo convenience hook discards the authorization code. Use the same
// native credential for the Clerk session and for server-side revocation.
export function useAppleSignIn() {
  const { signIn, setActive } = useSignIn();
  const { signUp } = useSignUp();
  return async () => {
    if (!signIn || !signUp || !setActive) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    let credential;
    try {
      credential = await apple.signInAsync({
        requestedScopes: [
          apple.AppleAuthenticationScope.FULL_NAME,
          apple.AppleAuthenticationScope.EMAIL
        ],
        nonce: randomUUID()
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      )
        return null;
      throw error;
    }
    const { identityToken, authorizationCode, fullName } = credential;
    if (!identityToken) throw new Error('appShell.auth.unavailable');
    let createdSessionId: string | null;
    try {
      await signUp.create({
        strategy: 'oauth_token_apple',
        token: identityToken,
        firstName: fullName?.givenName ?? undefined,
        lastName: fullName?.familyName ?? undefined
      });
    } catch (error) {
      if (
        !isClerkAPIResponseError(error) ||
        !error.errors.some(
          (item) =>
            item.code === 'sign_up_mode_restricted' ||
            item.code === 'sign_up_restricted_waitlist'
        )
      )
        throw error;
      await signIn.create({
        strategy: 'oauth_token_apple',
        token: identityToken
      });
      if (signIn.firstFactorVerification.status === 'transferable') throw error;
      return {
        setActive,
        createdSessionId: signIn.createdSessionId,
        authorizationCode
      };
    }
    if (signUp.verifications.externalAccount.status === 'transferable') {
      await signIn.create({ transfer: true });
      createdSessionId = signIn.createdSessionId;
    } else createdSessionId = signUp.createdSessionId;
    return { setActive, createdSessionId, authorizationCode };
  };
}
