import * as SecureStore from 'expo-secure-store';
import { AssistantOperationJournal } from './assistant-operation-journal';

export const assistantSecureJournal = new AssistantOperationJournal({
  read: (key) => SecureStore.getItemAsync(key),
  write: (key, value) => SecureStore.setItemAsync(key, value)
});
