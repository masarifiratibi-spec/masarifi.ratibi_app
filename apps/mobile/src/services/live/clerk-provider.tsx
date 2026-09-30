import {
  ClerkProvider,
  getClerkInstance,
  useAuth,
  useSignIn,
  useSignUp,
  type TokenCache
} from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';

import { resolveClientRuntime } from '@/config/client-runtime';
import type {
  AuthResult,
  PhoneVerificationAttempt
} from '@/services/contracts/app-shell-service';
import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';
import { classifyPhoneVerificationError } from './clerk-errors';
import { resolveClerkDisplayName } from './clerk-name';
import {
  LiveIdentityStatusContext,
  type IdentityStatus
} from './clerk-context';
export { useLiveIdentityStatus } from './clerk-context';

type PendingPhoneAttempt = {
  countryCode: string;
  phoneValue: string;
  verify(code: string): Promise<{
    sessionId: string;
    userId: string;
    issuedAt: number;
    expiresAt: number;
  }>;
  resend(): Promise<void>;
};

const clerkCache: TokenCache = {
  getToken: (key) => SecureStore.getItemAsync(`masarifi.clerk.${key}`),
  saveToken: (key, token) =>
    SecureStore.setItemAsync(`masarifi.clerk.${key}`, token),
  clearToken: (key) => SecureStore.deleteItemAsync(`masarifi.clerk.${key}`)
};
const LiveClerkSessionContext = createContext<string | null | undefined>(
  undefined
);

export const useLiveClerkSessionKey = () => useContext(LiveClerkSessionContext);

export function getLiveClerkDisplayName(
  ownerId: string | null | undefined
): string | null {
  try {
    const user = getClerkInstance().user;
    return ownerId && user?.id === ownerId
      ? resolveClerkDisplayName(user)
      : null;
  } catch {
    return null;
  }
}

export function MobileIdentityProvider({ children }: { children: ReactNode }) {
  const runtime = resolveClientRuntime();
  if (runtime.mode !== 'live')
    return (
      <LiveClerkSessionContext.Provider value="demo">
        {children}
      </LiveClerkSessionContext.Provider>
    );
  return (
    <ClerkProvider
      publishableKey={runtime.clerkPublishableKey!}
      tokenCache={clerkCache}
    >
      <LiveClerkRuntime>{children}</LiveClerkRuntime>
    </ClerkProvider>
  );
}

function LiveClerkRuntime({ children }: { children: ReactNode }) {
  const [sessionKey, setSessionKey] = useState<string | null>();
  const [status, setStatus] = useState<IdentityStatus>('loading');
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), 30_000);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <LiveIdentityStatusContext.Provider
      value={{
        status,
        retry: () => {
          setStatus('loading');
          const clerk = getClerkInstance();
          void clerk
            .load({
              standardBrowser: Platform.OS === 'web',
              experimental:
                Platform.OS === 'web' ? {} : { runtimeEnvironment: 'headless' }
            })
            .then(() => setStatus(clerk.status === 'ready' ? 'ready' : 'error'))
            .catch(() => setStatus('error'));
        }
      }}
    >
      <LiveClerkSessionContext.Provider value={sessionKey}>
        <ClerkBridgeInstaller
          onSessionKey={setSessionKey}
          onStatus={setStatus}
        />
        {children}
      </LiveClerkSessionContext.Provider>
    </LiveIdentityStatusContext.Provider>
  );
}

function ClerkBridgeInstaller({
  onSessionKey,
  onStatus
}: {
  onSessionKey: (sessionKey: string | null) => void;
  onStatus: (status: IdentityStatus) => void;
}) {
  const auth = useAuth();
  const signInState = useSignIn();
  const signUpState = useSignUp();
  const { startSSOFlow } = useSSO();
  const latest = useRef({ auth, signInState, signUpState, startSSOFlow });
  latest.current = { auth, signInState, signUpState, startSSOFlow };
  const ssoPending = useRef(false);
  const attempts = useRef(new Map<string, PendingPhoneAttempt>());
  const lastMethod = useRef<'phone' | 'google'>('google');

  const currentSession = (): LiveClerkBridge extends {
    getSession(): Promise<infer T>;
  }
    ? T
    : never => {
    if (!latest.current.auth.isLoaded) return null;
    const clerk = getClerkInstance();
    const session = clerk.session;
    if (!clerk.user || !session || session.status !== 'active') return null;
    return {
      id: session.id,
      userId: clerk.user.id,
      method: lastMethod.current,
      issuedAt: session.lastActiveAt.getTime(),
      expiresAt: session.expireAt.getTime()
    };
  };

  const bridge: LiveClerkBridge = {
    getSession: async () => currentSession(),
    getToken: (options) => latest.current.auth.getToken(options),
    async startPhone({ countryCode, phoneValue }) {
      const identifier = `${countryCode}${phoneValue}`;
      const attemptId = Crypto.randomUUID();
      try {
        const signIn = latest.current.signInState.signIn;
        const created = await signIn.create({ identifier });
        if (created.error) throw created.error;
        const sent = await signIn.phoneCode.sendCode({
          phoneNumber: identifier
        });
        if (sent.error) throw sent.error;
        attempts.current.set(attemptId, {
          countryCode,
          phoneValue,
          async verify(code) {
            const verified = await signIn.phoneCode.verifyCode({ code });
            if (verified.error) throw verified.error;
            if (signIn.status !== 'complete' || !signIn.createdSessionId)
              throw new Error('phone verification incomplete');
            const finalized = await signIn.finalize();
            if (finalized.error) throw finalized.error;
            const clerk = getClerkInstance();
            const userId = clerk.user?.id;
            if (!userId) throw new Error('Clerk user missing');
            const session = clerk.session;
            if (!session || session.id !== signIn.createdSessionId)
              throw new Error('Clerk session missing');
            return {
              sessionId: signIn.createdSessionId,
              userId,
              issuedAt: session.lastActiveAt.getTime(),
              expiresAt: session.expireAt.getTime()
            };
          },
          async resend() {
            const resent = await signIn.phoneCode.sendCode();
            if (resent.error) throw resent.error;
          }
        });
      } catch (error) {
        if (!isIdentifierNotFound(error)) throw error;
        const signUp = latest.current.signUpState.signUp;
        const created = await signUp.create({ phoneNumber: identifier });
        if (created.error) throw created.error;
        const sent = await signUp.verifications.sendPhoneCode();
        if (sent.error) throw sent.error;
        attempts.current.set(attemptId, {
          countryCode,
          phoneValue,
          async verify(code) {
            const verified = await signUp.verifications.verifyPhoneCode({
              code
            });
            if (verified.error) throw verified.error;
            if (
              signUp.status !== 'complete' ||
              !signUp.createdSessionId ||
              !signUp.createdUserId
            )
              throw new Error('phone verification incomplete');
            const finalized = await signUp.finalize();
            if (finalized.error) throw finalized.error;
            const session = getClerkInstance().session;
            if (!session || session.id !== signUp.createdSessionId)
              throw new Error('Clerk session missing');
            return {
              sessionId: signUp.createdSessionId,
              userId: signUp.createdUserId,
              issuedAt: session.lastActiveAt.getTime(),
              expiresAt: session.expireAt.getTime()
            };
          },
          async resend() {
            const resent = await signUp.verifications.sendPhoneCode();
            if (resent.error) throw resent.error;
          }
        });
      }
      return phoneAttempt(attemptId, countryCode, phoneValue);
    },
    async verifyPhone({ sessionId, code }): Promise<AuthResult> {
      const attempt = attempts.current.get(sessionId);
      if (!attempt) return { status: 'failed', errorCode: 'expired' };
      try {
        const verified = await attempt.verify(code);
        attempts.current.delete(sessionId);
        lastMethod.current = 'phone';
        return {
          status: 'authenticated',
          session: {
            status: 'authenticated',
            userId: verified.userId,
            method: 'phone',
            issuedAt: verified.issuedAt,
            expiresAt: verified.expiresAt,
            restoration: 'restored'
          }
        };
      } catch (error) {
        const errorCode = classifyPhoneVerificationError(error);
        if (!errorCode) throw error;
        return { status: 'failed', errorCode };
      }
    },
    async resendPhone(sessionId) {
      const attempt = attempts.current.get(sessionId);
      if (!attempt) throw new Error('expired');
      await attempt.resend();
      return phoneAttempt(sessionId, attempt.countryCode, attempt.phoneValue);
    },
    async signInWithGoogle() {
      if (!latest.current.auth.isLoaded || ssoPending.current)
        throw new Error('appShell.auth.unavailable');
      ssoPending.current = true;
      onStatus('sso');
      try {
        const result = await latest.current.startSSOFlow({
          strategy: 'oauth_google',
          redirectUrl: 'masarifi://sso-callback'
        });
        if (
          result.authSessionResult?.type === 'cancel' ||
          result.authSessionResult?.type === 'dismiss'
        ) {
          onStatus('cancelled');
          return null;
        }
        if (result.authSessionResult?.type !== 'success')
          throw new Error('appShell.auth.unavailable');
        const activatedId =
          result.createdSessionId ??
          result.signIn?.existingSession?.sessionId ??
          result.signUp?.existingSession?.sessionId;
        if (!activatedId) {
          onStatus('incomplete');
          throw new Error('googleAuth.incomplete');
        }
        lastMethod.current = 'google';
        const session = currentSession();
        if (!session || session.id !== activatedId)
          throw new Error('Clerk session missing');
        onStatus('ready');
        onSessionKey(session.id);
        return session;
      } catch (error) {
        if (!(
          error instanceof Error && error.message === 'googleAuth.incomplete'
        ))
          onStatus('error');
        throw error;
      } finally {
        ssoPending.current = false;
      }
    },
    reverifyConflict: async () => null,
    signOut: ({ scope }) =>
      latest.current.auth.signOut(
        scope === 'current'
          ? { sessionId: latest.current.auth.sessionId ?? undefined }
          : undefined
      )
  };
  useEffect(() => {
    if (!auth.isLoaded) return;
    registerLiveClerkBridge(bridge);
    if (!ssoPending.current)
      onSessionKey(auth.isSignedIn ? auth.sessionId : null);
    // Clerk hook resources are mutable; reinstall only when identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoaded, auth.isSignedIn, auth.sessionId, onSessionKey]);
  useEffect(() => {
    const clerk = getClerkInstance();
    const update = (status: string) => {
      if (ssoPending.current) return;
      if (status === 'error' || status === 'degraded') onStatus('error');
      else if (status === 'ready' || auth.isLoaded) onStatus('ready');
    };
    update(clerk?.status ?? (auth.isLoaded ? 'ready' : 'loading'));
    const listener = (status: string) => update(status);
    clerk?.on?.('status', listener, { notify: true });
    return () => {
      clerk?.off?.('status', listener);
    };
  }, [auth.isLoaded, onStatus]);
  return null;
}

function isIdentifierNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('errors' in error)) return false;
  const errors = (error as { errors?: unknown }).errors;
  return (
    Array.isArray(errors) &&
    errors.some((item) => {
      if (!item || typeof item !== 'object' || !('code' in item)) return false;
      const code = (item as { code?: unknown }).code;
      return (
        code === 'form_identifier_not_found' || code === 'identifier_not_found'
      );
    })
  );
}

function phoneAttempt(
  sessionId: string,
  countryCode: string,
  phoneValue: string
): PhoneVerificationAttempt {
  const now = Date.now();
  return {
    sessionId,
    countryCode,
    phoneValue,
    codeLength: 6,
    status: 'sent',
    issuedAt: now,
    resendAvailableAt: now + 30_000,
    invalidAttempts: 0,
    replacedBy: null
  };
}
