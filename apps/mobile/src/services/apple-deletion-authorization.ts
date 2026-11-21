import { Platform } from 'react-native';
import { getClerkInstance } from '@clerk/expo';
import { z } from 'zod';
import { HttpError, requestJson } from './live/http-client';
import type { CapturedClerkIdentity } from './live/auth-service';

const status = z.object({ remaining: z.number().int().nonnegative() });

async function sendGrant(
  sessionId: string | undefined,
  ownerId: string,
  code?: string,
  baseUrl?: string
) {
  const current = () => {
    const clerk = getClerkInstance();
    if (
      !clerk.session ||
      clerk.session.id !== sessionId ||
      clerk.user?.id !== ownerId
    )
      throw new HttpError('session_expired', 401);
    return clerk.session;
  };
  const token = await current().getToken();
  current();
  if (!token) throw new HttpError('session_expired', 401);
  const result = await requestJson('/api/v1/me/apple-deletion-grant', status, {
    method: 'POST',
    baseUrl,
    token,
    recentAuth: 'manual',
    body: code ? { authorizationCode: code } : {}
  });
  current();
  return result.remaining;
}

export function rememberAppleDeletionGrant(
  sessionId: string,
  ownerId: string,
  code: string
) {
  return sendGrant(sessionId, ownerId, code);
}

// Called only after the owner confirms deletion. Older native Apple sign-ins
// supplied an identity token to Clerk but never supplied a revocable grant.
export async function prepareAppleDeletion(
  actor: CapturedClerkIdentity,
  baseUrl?: string
) {
  if (Platform.OS !== 'ios') return;
  const send = async (authorizationCode?: string) => {
    await actor.assertCurrent();
    const remaining = await sendGrant(
      actor.sessionId,
      actor.userId,
      authorizationCode,
      baseUrl
    );
    await actor.assertCurrent();
    return remaining;
  };
  let remaining = await send();
  while (remaining > 0) {
    // Resolve the native module only when an iPhone needs a fresh Apple grant.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    await actor.assertCurrent();
    const { authorizationCode } = await apple
      .signInAsync()
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ERR_REQUEST_CANCELED'
        )
          throw new HttpError('conflict', 409, 'APPLE_AUTHORIZATION_REQUIRED');
        throw error;
      });
    if (!authorizationCode)
      throw new HttpError('conflict', 409, 'APPLE_AUTHORIZATION_REQUIRED');
    await send(authorizationCode);
    const next = await send();
    if (next >= remaining)
      throw new HttpError('conflict', 409, 'APPLE_AUTHORIZATION_REQUIRED');
    remaining = next;
  }
}
