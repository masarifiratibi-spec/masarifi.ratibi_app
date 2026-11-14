import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { captureLiveClerkIdentity } from './live/auth-service';
import { HttpError, requestJson } from './live/http-client';
import { getDeviceRegistration } from './platform/phone-notification-service';

const devicePage = z
  .object({
    items: z.array(
      z
        .object({ current: z.boolean(), revokedAt: z.string().nullable() })
        .passthrough()
    ),
    nextCursor: z.string().nullable()
  })
  .passthrough();
const registeredDevice = z
  .object({
    deviceId: z.string().uuid(),
    registeredAt: z.string().datetime({ offset: true }),
    version: z.number().int().positive()
  })
  .strict();

// Tracking must reconcile an accepted ledger effect even when Push is unavailable.
// Register only this installation through the normal owned-device API; never
// request notification permission, fabricate a token, or replace another device.
export async function ensureTrackingSyncDevice(ownerId: string): Promise<void> {
  const identity = await captureLiveClerkIdentity();
  if (identity.userId !== ownerId) throw new Error('tracking_owner_changed');
  await identity.assertCurrent();
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: z.infer<typeof devicePage> = await requestJson(
      `/api/v1/me/devices?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      devicePage,
      { method: 'GET', token: identity.token }
    );
    await identity.assertCurrent();
    if (
      page.items.some((device) => device.current && device.revokedAt === null)
    )
      return;
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor))
      throw new HttpError('contract_mismatch', 502);
    if (cursor) seen.add(cursor);
  } while (cursor);
  const registration = await getDeviceRegistration();
  if (!registration) throw new HttpError('provider_unavailable', 503);
  await identity.assertCurrent();
  await requestJson('/api/v1/me/devices/register', registeredDevice, {
    method: 'POST',
    token: identity.token,
    body: registration,
    headers: { 'Idempotency-Key': `tracking-sync-device:${randomUUID()}` }
  });
  await identity.assertCurrent();
}
