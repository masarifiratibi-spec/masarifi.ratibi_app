import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TextConsentStore } from '@/services/live/assistant-api-service';

// Product decision (2026-11-26): keep the explicit text-assistant opt-in on iOS for now.
// Revisit whether to remove this extra prompt in a future iOS release.
// A separate Keychain marker keeps a withdrawal retryable if the receipt store fails.
export const iosTextConsent: TextConsentStore | undefined =
  Platform.OS === 'ios'
    ? {
        read: (key) => key.endsWith('.withdrawal')
          ? SecureStore.getItemAsync(key)
          : AsyncStorage.getItem(key),
        async write(key, value) {
          if (key.endsWith('.withdrawal')) {
            if (value === null) await SecureStore.deleteItemAsync(key);
            else await SecureStore.setItemAsync(key, value);
          } else if (value === null) await AsyncStorage.removeItem(key);
          else await AsyncStorage.setItem(key, value);
        }
      }
    : undefined;
