import { assertTrackingAvailable } from '@/state/tracking-admission';
import { MasarifiSmsInbox } from '../../../modules/masarifi-sms-inbox';
import type { MasarifiSmsInboxModule } from '../../../modules/masarifi-sms-inbox';
import { captureTrackingNativeLease } from '../tracking-native-lease';
import type {
  BankNotificationService,
  RawBankNotification
} from './bank-notification-service';

interface NativeBankNotifications extends Pick<
  MasarifiSmsInboxModule,
  | 'notificationCaptureIssueV4'
  | 'setNotificationCaptureEnabledV4'
  | 'readRecentNotificationsV4'
  | 'acknowledgeNotificationsV4'
> {
  notificationCaptureIssue?(): Promise<string | null>;
  isNotificationAccessEnabled(): Promise<unknown>;
  openNotificationAccessSettings(): Promise<void>;
  setNotificationCaptureEnabled(enabled: boolean): Promise<void>;
  readRecentNotifications(limit: number): Promise<unknown>;
  acknowledgeNotifications(keys: readonly string[]): Promise<void>;
}

export function createAndroidBankNotificationService(
  native: NativeBankNotifications | null = MasarifiSmsInbox
): BankNotificationService {
  return {
    async getCaptureIssue() {
      const scope = await captureTrackingNativeLease();
      if (scope.lease) {
        if (!native?.notificationCaptureIssueV4)
          throw new Error('tracking_native_upgrade_required');
        const value = await native.notificationCaptureIssueV4(
          scope.lease.ownerDigest,
          scope.lease.generation
        );
        await scope.assertCurrent();
        return value;
      }
      return (await native?.notificationCaptureIssue?.()) ?? null;
    },
    async getAccessState() {
      if (!native) return 'unavailable';
      try {
        return (await native.isNotificationAccessEnabled()) === true
          ? 'granted'
          : 'denied';
      } catch {
        return 'unavailable';
      }
    },
    async openSettings() {
      assertTrackingAvailable();
      await native?.openNotificationAccessSettings();
    },
    async setCaptureEnabled(enabled) {
      const scope = await captureTrackingNativeLease();
      if (scope.lease) {
        if (!native?.setNotificationCaptureEnabledV4)
          throw new Error('tracking_native_upgrade_required');
        await native.setNotificationCaptureEnabledV4(
          scope.lease.ownerDigest,
          scope.lease.generation,
          enabled
        );
      } else await native?.setNotificationCaptureEnabled(enabled);
      await scope.assertCurrent();
    },
    async readRecent(limit) {
      const scope = await captureTrackingNativeLease();
      if (!native) return [];
      const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
      if (scope.lease && !native.readRecentNotificationsV4)
        throw new Error('tracking_native_upgrade_required');
      const value = scope.lease
        ? await native.readRecentNotificationsV4!(
            scope.lease.ownerDigest,
            scope.lease.generation,
            bounded
          )
        : await native.readRecentNotifications(bounded);
      await scope.assertCurrent();
      if (!Array.isArray(value))
        throw new Error('bank_notification_invalid_response');
      return value.flatMap((row) => {
        const parsed = parseNotification(row);
        return parsed ? [parsed] : [];
      });
    },
    async acknowledge(keys) {
      const scope = await captureTrackingNativeLease();
      if (!native) return;
      const validKeys = [...new Set(keys.filter((key) => key.length > 0))];
      if (validKeys.length > 0) {
        if (scope.lease) {
          if (!native.acknowledgeNotificationsV4)
            throw new Error('tracking_native_upgrade_required');
          await native.acknowledgeNotificationsV4(
            scope.lease.ownerDigest,
            scope.lease.generation,
            validKeys
          );
        } else await native.acknowledgeNotifications(validKeys);
      }
      await scope.assertCurrent();
    }
  };
}

export const bankNotificationService = createAndroidBankNotificationService();

function parseNotification(value: unknown): RawBankNotification | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.key !== 'string' ||
    row.key.length === 0 ||
    typeof row.packageName !== 'string' ||
    row.packageName.length === 0 ||
    typeof row.title !== 'string' ||
    typeof row.text !== 'string' ||
    (row.title.length === 0 && row.text.length === 0) ||
    !Number.isSafeInteger(row.postedAt) ||
    Number(row.postedAt) < 0
  )
    return null;
  const sourceDisplayName =
    typeof row.sourceDisplayName === 'string'
      ? row.sourceDisplayName
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
          .trim()
          .slice(0, 100)
      : '';
  return {
    key: row.key,
    packageName: row.packageName,
    ...(sourceDisplayName ? { sourceDisplayName } : {}),
    title: row.title,
    text: row.text,
    postedAt: Number(row.postedAt),
    ...(Number.isSafeInteger(row.captureActivatedAt) &&
    Number(row.captureActivatedAt) >= 0
      ? { captureActivatedAt: Number(row.captureActivatedAt) }
      : {}),
    ...(typeof row.capturePolicy === 'string'
      ? { capturePolicy: row.capturePolicy }
      : {}),
    ...(Number.isSafeInteger(row.observedAt) && Number(row.observedAt) >= 0
      ? { observedAt: Number(row.observedAt) }
      : {}),
    ...(typeof row.discovered === 'boolean'
      ? { discovered: row.discovered }
      : {}),
    ...(typeof row.nativeKey === 'string' ? { nativeKey: row.nativeKey } : {})
  };
}
