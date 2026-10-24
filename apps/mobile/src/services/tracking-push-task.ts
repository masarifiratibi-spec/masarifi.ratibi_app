import * as TaskManager from 'expo-task-manager';
import type { NotificationTaskPayload } from './platform/tracking-notification-task';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { runTrackingBackground } from './tracking-background-runtime';
import { captureLiveClerkIdentity } from './live/auth-service';
import { presentTrackingConfirmation } from './tracking-save-confirmation';

export const trackingPushTask = 'masarifi-tracking-confirmation-v2';
TaskManager.defineTask<NotificationTaskPayload>(
  trackingPushTask,
  async ({ data, error }) => {
    if (error || !data || 'actionIdentifier' in data) return;
    const raw = data.data.dataString;
    const payload =
      typeof raw === 'string' && raw.length <= 2048
        ? JSON.parse(raw)
        : data.data;
    if (
      !payload ||
      ![true, 'true'].includes(payload.automaticCapture) ||
      typeof payload.notificationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.notificationId)
    )
      return;
    const contextRaw = await SecureStore.getItemAsync(
      'masarifi.tracking.background-context.v2'
    );
    if (!contextRaw) return;
    const context = JSON.parse(contextRaw) as {
      ownerId: string;
      generation: string;
    };
    const ownerDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      context.ownerId
    );
    await runTrackingBackground({
      ownerDigest,
      generation: context.generation
    });
    if (
      (await SecureStore.getItemAsync(
        'masarifi.tracking.background-context.v2'
      )) !== contextRaw ||
      (await captureLiveClerkIdentity()).userId !== context.ownerId
    )
      return;
    await presentTrackingConfirmation(context.ownerId, payload.notificationId);
  }
);
