import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
let creating: Promise<string> | null = null;
export function getTrackingDeviceId(): Promise<string> {
  creating ??= (async () => {
    const key = 'masarifi.tracking.device.v2';
    const stored = await SecureStore.getItemAsync(key);
    if (stored) return stored;
    const id = randomUUID();
    await SecureStore.setItemAsync(key, id);
    return id;
  })().catch((error) => {
    creating = null;
    throw error;
  });
  return creating;
}
