import { Platform } from 'react-native';
import {
  AndroidImportance,
  getNotificationChannelAsync,
  getPermissionsAsync
} from 'expo-notifications';

// CaptureConfirmation creates this channel on the first saved transaction.
const savedTransactionChannel = 'masarifi-tracking-saved-v1';

export async function readTrackingAlertEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (!(await getPermissionsAsync()).granted) return false;
    if (Number(Platform.Version) < 26) return true;
    const channel = await getNotificationChannelAsync(savedTransactionChannel);
    return channel === null || channel.importance > AndroidImportance.NONE;
  } catch {
    return false;
  }
}
