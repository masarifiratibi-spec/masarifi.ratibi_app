import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import type {
  PhoneNotificationResponse,
  PhoneNotificationService
} from '@/services/contracts/assistant-notifications-service';
import type { NotificationPermissionState } from '@/domain/notifications';
import { translateDynamic } from '@/localization/i18n';

const ExpoNotifications =
  (Notifications as unknown as { default?: typeof Notifications }).default ??
  Notifications;
const ExpoLinking =
  (Linking as unknown as { default?: typeof Linking }).default ?? Linking;

export function createPhoneNotificationService(): PhoneNotificationService {
  return {
    async getPermission() {
      try {
        return mapPermission(await ExpoNotifications.getPermissionsAsync());
      } catch {
        return 'unavailable';
      }
    },
    async requestPermission() {
      try {
        return mapPermission(await ExpoNotifications.requestPermissionsAsync());
      } catch {
        return 'unavailable';
      }
    },
    async registerCategories() {
      ExpoNotifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false
        })
      });
      await ExpoNotifications.setNotificationChannelAsync('financial-change', {
        name: translateDynamic('notifications.channel.financialChanges'),
        importance: ExpoNotifications.AndroidImportance.DEFAULT
      });
      await ExpoNotifications.setNotificationCategoryAsync(
        'financial-change',
        [
          { identifier: 'view', buttonTitle: translateDynamic('notifications.actions.view'), options: { opensAppToForeground: true } },
          { identifier: 'edit', buttonTitle: translateDynamic('notifications.actions.edit'), options: { opensAppToForeground: true } },
          { identifier: 'undo', buttonTitle: translateDynamic('notifications.actions.undo'), options: { opensAppToForeground: true } }
        ],
        { previewPlaceholder: 'Masarifi' }
      );
    },
    async presentLocal(input) {
      try {
        const identifier = await ExpoNotifications.scheduleNotificationAsync({
          content: {
            title: input.title,
            body: input.body,
            categoryIdentifier: input.categoryId,
            data: { notificationId: input.notificationId }
          },
          trigger: null
        });
        return { status: 'presented', identifier };
      } catch {
        return { status: 'failed', identifier: null };
      }
    },
    async getLastResponse() {
      return responseFromExpo(await ExpoNotifications.getLastNotificationResponseAsync());
    },
    subscribeToResponses(listener) {
      const subscription = ExpoNotifications.addNotificationResponseReceivedListener(
        (response) => {
          const mapped = responseFromExpo(response);
          if (mapped) listener(mapped);
        }
      );
      return () => subscription.remove();
    },
    async openSystemSettings() {
      await ExpoLinking.openSettings();
    }
  };
}

export const phoneNotificationService = createPhoneNotificationService();

function mapPermission(status: { granted?: boolean; canAskAgain?: boolean; status?: string }): NotificationPermissionState {
  if (status.granted) return 'granted';
  if (status.status === 'undetermined') return 'not_requested';
  return status.canAskAgain === false ? 'permanently_denied' : 'denied';
}

function responseFromExpo(response: unknown): PhoneNotificationResponse | null {
  if (!response || typeof response !== 'object') return null;
  const value = response as {
    actionIdentifier?: string;
    notification?: { request?: { content?: { data?: Record<string, unknown> } } };
  };
  const notificationId = value.notification?.request?.content?.data?.notificationId;
  if (typeof notificationId !== 'string') return null;
  const action = mapAction(value.actionIdentifier);
  if (!action) return null;
  return {
    notificationId,
    action
  };
}

function mapAction(actionIdentifier?: string): PhoneNotificationResponse['action'] | null {
  if (
    actionIdentifier === 'view' ||
    actionIdentifier === (ExpoNotifications as { DEFAULT_ACTION_IDENTIFIER?: string }).DEFAULT_ACTION_IDENTIFIER
  ) return 'view';
  if (actionIdentifier === 'edit' || actionIdentifier === 'undo') return actionIdentifier;
  return null;
}
