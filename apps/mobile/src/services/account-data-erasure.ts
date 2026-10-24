import { purgeAccountDatabase } from '@/storage/database';
import { purgeAppShellOwnerData } from '@/storage/app-shell-storage';
import { Platform } from 'react-native';

export async function eraseDeletedAccountLocalData(
  ownerId: string
): Promise<void> {
  await purgeAccountDatabase(ownerId);
  await purgeAppShellOwnerData(ownerId);
  if (Platform.OS === 'android')
    await (
      await import('./tracking-background-runtime')
    ).purgeDeletedOwnerTracking(ownerId);
}
