import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assistantSecureJournal } from './assistant-secure-journal';

it('erases owner question, legacy previews and indexed previews across restarts while preserving other owners', async () => {
  await AsyncStorage.clear();
  const values = new Map<string, string>();
  jest
    .spyOn(SecureStore, 'getItemAsync')
    .mockImplementation(async (key) => values.get(key) ?? null);
  jest
    .spyOn(SecureStore, 'setItemAsync')
    .mockImplementation(async (key, value) => {
      values.set(key, value);
    });
  jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (key) => {
    values.delete(key);
  });
  try {
    await assistantSecureJournal.reserve(
      'a',
      'confirm:legacy',
      { previewId: 'legacy' },
      'operation-confirm-legacy'
    );
    await AsyncStorage.clear(); // Simulate a pre-index operation.
    for (const owner of ['a', 'b']) {
      await assistantSecureJournal.reserve(
        owner,
        'question',
        { question: 'sensitive' },
        'operation-question'
      );
      await assistantSecureJournal.reserve(
        owner,
        'cancel:new',
        { previewId: 'new' },
        'operation-cancel-new'
      );
    }
    await assistantSecureJournal.clearOwner('a', ['legacy']);
    for (const slot of ['question', 'confirm:legacy', 'cancel:new']) {
      expect(await assistantSecureJournal.read('a', slot)).toBeNull();
    }
    expect(await assistantSecureJournal.read('b', 'question')).not.toBeNull();
    expect(await assistantSecureJournal.read('b', 'cancel:new')).not.toBeNull();
  } finally {
    jest.restoreAllMocks();
  }
});
