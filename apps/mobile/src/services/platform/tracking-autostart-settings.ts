import { Linking, Platform } from 'react-native';

export type TrackingAutostartDestination =
  'autostart' | 'app_settings' | 'unavailable';

/** Opens settings for the user to review; never infers or changes autostart consent. */
export async function openTrackingAutostartSettings(): Promise<TrackingAutostartDestination> {
  if (Platform.OS !== 'android') return 'unavailable';
  if (
    /^(xiaomi|redmi|poco)$/i.test(Platform.constants.Manufacturer?.trim() ?? '')
  ) {
    try {
      // Older binaries or OEM versions may not expose this settings route.
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const intents: typeof import('expo-intent-launcher') = require('expo-intent-launcher');
      await intents.startActivityAsync('android.intent.action.MAIN', {
        packageName: 'com.miui.securitycenter',
        className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
        flags: 0x04000000 // Reveal this settings page if its task already exists.
      });
      return 'autostart';
    } catch {
      // The app-details fallback remains available without private OEM APIs.
    }
  }
  await Linking.openSettings();
  return 'app_settings';
}
