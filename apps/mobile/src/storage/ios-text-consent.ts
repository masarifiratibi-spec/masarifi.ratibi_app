import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TextConsentStore } from '@/services/live/assistant-api-service';

// Only the policy receipt is persisted. The key is scoped to a hashed Clerk owner.
export const iosTextConsent: TextConsentStore | undefined =
  Platform.OS === 'ios'
    ? {
        read: (key) => AsyncStorage.getItem(key),
        write: (key, value) =>
          value === null
            ? AsyncStorage.removeItem(key)
            : AsyncStorage.setItem(key, value)
      }
    : undefined;
