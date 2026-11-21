import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AssistantOperationJournal } from './assistant-operation-journal';

const markerPrefix = (ownerHash: string) =>
  'masarifi.assistant.slot.' + ownerHash + '.';

export const assistantSecureJournal = new AssistantOperationJournal({
  read: (key) => SecureStore.getItemAsync(key),
  write: (key, value) => SecureStore.setItemAsync(key, value),
  // Only hashed slot keys enter AsyncStorage. The journal payload stays in SecureStore.
  track: (ownerHash, key) =>
    AsyncStorage.setItem(markerPrefix(ownerHash) + key, '1'),
  async clear(ownerHash, legacyKeys) {
    const prefix = markerPrefix(ownerHash);
    const markers = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(prefix)
    );
    const slots = new Set([
      ...legacyKeys,
      ...markers.map((key) => key.slice(prefix.length))
    ]);
    for (const slot of slots) {
      if (!/^masarifi\.assistant\.operation\.[a-f0-9]{64}$/.test(slot))
        throw new Error('invalid_assistant_journal_key');
      await SecureStore.deleteItemAsync(slot);
    }
    if (markers.length) await AsyncStorage.multiRemove(markers);
  }
});
