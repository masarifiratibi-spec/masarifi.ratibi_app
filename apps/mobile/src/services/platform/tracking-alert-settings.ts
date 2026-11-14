import { Linking, Platform } from 'react-native';
import { applicationId } from 'expo-application';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

/** Opens display settings only; never requests a permission or enables capture. */
export async function openTrackingAlertSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    try {
      if (applicationId) {
        await startActivityAsync(ActivityAction.APP_NOTIFICATION_SETTINGS, {
          extra: { 'android.provider.extra.APP_PACKAGE': applicationId }
        });
        return true;
      }
    } catch {
      // Some manufacturers do not expose the direct notification activity.
    }
  }
  await Linking.openSettings();
  return true;
}
