import AsyncStorage from '@react-native-async-storage/async-storage';

export function resetAsyncStorageForTest() {
  return AsyncStorage.clear();
}

export async function readAsyncStorageForTest() {
  return Object.fromEntries(
    await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())
  );
}
