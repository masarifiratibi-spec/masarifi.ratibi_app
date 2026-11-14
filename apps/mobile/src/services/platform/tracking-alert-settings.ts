import { Linking, Platform } from 'react-native';
import { applicationId } from 'expo-application';

/** Opens display settings only; never requests a permission or enables capture. */
export async function openTrackingAlertSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    try {
      if (applicationId) {
        // Load inside the recovery boundary: older binaries may lack this module.
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        const intents: typeof import('expo-intent-launcher') = require('expo-intent-launcher');
        await intents.startActivityAsync(
          intents.ActivityAction.APP_NOTIFICATION_SETTINGS,
          {
            extra: { 'android.provider.extra.APP_PACKAGE': applicationId }
          }
        );
        return true;
      }
    } catch {
      // Some manufacturers do not expose the direct notification activity.
    }
  }
  await Linking.openSettings();
  return true;
}
