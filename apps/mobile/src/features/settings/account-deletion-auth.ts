import { getClerkInstance } from '@clerk/expo';

import { HttpError } from '@/services/live/http-client';

export async function startAccountDeletionVerification(
  expectedOwnerId?: string
): Promise<{
  safeIdentifier: string;
  verify(code: string): Promise<void>;
}> {
  const clerk = getClerkInstance();
  const session = clerk.session;
  const ownerId = clerk.user?.id;
  if (
    !ownerId ||
    (expectedOwnerId && ownerId !== expectedOwnerId) ||
    !session ||
    session.status !== 'active'
  )
    throw new HttpError('session_expired', 401);
  const assertCurrent = () => {
    const current = getClerkInstance();
    if (
      current.session !== session ||
      current.user?.id !== ownerId ||
      session.status !== 'active'
    )
      throw new HttpError('session_expired', 401);
  };
  const started = await session.startVerification({ level: 'first_factor' });
  assertCurrent();
  const factor = started.supportedFirstFactors?.find(
    (candidate) =>
      candidate.strategy === 'email_code' || candidate.strategy === 'phone_code'
  );
  if (
    !factor ||
    (factor.strategy !== 'email_code' && factor.strategy !== 'phone_code')
  )
    throw new HttpError(
      'provider_unavailable',
      503,
      'DELETION_VERIFICATION_UNAVAILABLE'
    );
  await session.prepareFirstFactorVerification(
    factor.strategy === 'email_code'
      ? { strategy: 'email_code', emailAddressId: factor.emailAddressId }
      : { strategy: 'phone_code', phoneNumberId: factor.phoneNumberId }
  );
  assertCurrent();
  return {
    safeIdentifier: factor.safeIdentifier,
    async verify(code) {
      assertCurrent();
      const verified = await session.attemptFirstFactorVerification({
        strategy: factor.strategy,
        code
      });
      assertCurrent();
      if (verified.status !== 'complete') throw new HttpError('forbidden', 403);
      const token = await session.getToken({ skipCache: true });
      assertCurrent();
      if (!token) throw new HttpError('session_expired', 401);
    }
  };
}
