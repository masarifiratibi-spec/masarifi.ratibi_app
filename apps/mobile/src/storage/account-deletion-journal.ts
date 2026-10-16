import AsyncStorage from '@react-native-async-storage/async-storage';

const requestKey = (ownerId: string) => `masarifi.deletion.${ownerId}`;

export async function loadAccountDeletionJournal(ownerId: string) {
  const key = requestKey(ownerId);
  const [requestId, operationId] = await Promise.all([
    AsyncStorage.getItem(key),
    AsyncStorage.getItem(`${key}.operation`)
  ]);
  return { requestId, operationId };
}

export function saveAccountDeletionRequestId(
  ownerId: string,
  requestId: string
) {
  return AsyncStorage.setItem(requestKey(ownerId), requestId);
}

export function saveAccountDeletionOperationId(
  ownerId: string,
  operationId: string
) {
  return AsyncStorage.setItem(`${requestKey(ownerId)}.operation`, operationId);
}

export function removeAccountDeletionOperationId(ownerId: string) {
  return AsyncStorage.removeItem(`${requestKey(ownerId)}.operation`);
}

export async function removeAccountDeletionJournal(
  ownerId: string
): Promise<void> {
  await AsyncStorage.multiRemove([
    requestKey(ownerId),
    `${requestKey(ownerId)}.operation`
  ]);
}
