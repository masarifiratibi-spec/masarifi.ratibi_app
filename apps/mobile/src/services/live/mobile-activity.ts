import { isBenchmarkReadOnly } from '@/config/client-runtime';
import { Platform } from 'react-native';
import { z } from 'zod';
import { captureLiveClerkIdentity } from './auth-service';
import { requestJson } from './http-client';
import { ensureTrackingSyncDevice } from '../tracking-sync-device';
let lastOwner: string | undefined;
let lastSentAt = -Infinity;
// Only app startup/foreground calls this. No event names, screen paths, or user content.
export async function recordMobileForeground(
  platform = Platform.OS,
  now = Date.now()
): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  if (platform !== 'ios' && platform !== 'android') return;
  const identity = await captureLiveClerkIdentity();
  if (
    lastOwner === identity.userId &&
    Math.floor(now / 900_000) === Math.floor(lastSentAt / 900_000)
  )
    return;
  await ensureTrackingSyncDevice(identity.userId);
  await identity.assertCurrent();
  await requestJson('/api/v1/me/mobile-activity', z.unknown(), {
    method: 'POST',
    token: identity.token,
    body: { platform },
    emptyValue: null
  });
  await identity.assertCurrent();
  lastOwner = identity.userId;
  lastSentAt = now;
}
