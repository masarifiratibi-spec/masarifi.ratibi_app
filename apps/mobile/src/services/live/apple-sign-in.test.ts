import { isClerkAPIResponseError } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { signInAsync } from 'expo-apple-authentication';
import { useAppleSignIn } from './apple-sign-in';

jest.mock('@clerk/expo', () => ({ isClerkAPIResponseError: jest.fn() }));
jest.mock('@clerk/expo/legacy', () => ({
  useSignIn: jest.fn(),
  useSignUp: jest.fn()
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 }
}));

it.each([false, true])(
  'preserves the one-time Apple code from the credential that established the Clerk session (restricted signup %s)',
  async (restricted) => {
    const signup = {
      create: jest.fn(),
      createdSessionId: 'signup-session',
      verifications: { externalAccount: { status: 'verified' } }
    };
    const signin = {
      create: jest.fn(),
      createdSessionId: 'signin-session',
      firstFactorVerification: { status: 'verified' }
    };
    const setActive = jest.fn();
    (useSignUp as jest.Mock).mockReturnValue({ signUp: signup });
    (useSignIn as jest.Mock).mockReturnValue({ signIn: signin, setActive });
    (signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'identity-fixture',
      authorizationCode: 'once-fixture'
    });
    if (restricted) {
      signup.create.mockRejectedValueOnce({
        errors: [{ code: 'sign_up_mode_restricted' }]
      });
      (isClerkAPIResponseError as unknown as jest.Mock).mockReturnValue(true);
    }
    const start = useAppleSignIn();
    await expect(start()).resolves.toMatchObject({
      createdSessionId: restricted ? 'signin-session' : 'signup-session',
      authorizationCode: 'once-fixture',
      setActive
    });
    expect(signup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'oauth_token_apple',
        token: 'identity-fixture'
      })
    );
    if (restricted)
      expect(signin.create).toHaveBeenCalledWith({
        strategy: 'oauth_token_apple',
        token: 'identity-fixture'
      });
    expect(setActive).not.toHaveBeenCalled();
  }
);
