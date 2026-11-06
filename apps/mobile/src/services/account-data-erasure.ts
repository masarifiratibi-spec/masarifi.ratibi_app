import { purgeAccountDatabase } from '@/storage/database';
import { purgeAppShellOwnerData } from '@/storage/app-shell-storage';
import { Platform } from 'react-native';
import { loadDeletionCompletion } from '@/storage/deletion-completion-journal';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { useAppShellStore } from '@/state/app-shell';

export async function eraseDeletedAccountLocalData(
  ownerId: string
): Promise<void> {
  const receipt = await loadDeletionCompletion(ownerId);
  if (
    receipt?.phase !== 'server_completed' ||
    !receipt.completedAt ||
    !receipt.requestId
  )
    throw new Error('deletion_completion_unverified');
  const revision = useTrackingAdmission.getState().revision;
  const activeOwner = useAppShellStore.getState().session?.userId;
  const assertCurrent = () => {
    if (
      useTrackingAdmission.getState().revision !== revision ||
      useAppShellStore.getState().session?.userId !== activeOwner
    )
      throw new Error('deletion_cleanup_identity_changed');
  };
  const assertOwner = async () => {
    assertCurrent();
    if (
      JSON.stringify(await loadDeletionCompletion(ownerId)) !==
      JSON.stringify(receipt)
    )
      throw new Error('deletion_completion_changed');
    assertCurrent();
  };
  await assertOwner();
  await purgeAccountDatabase(ownerId);
  await assertOwner();
  await purgeAppShellOwnerData(ownerId);
  await assertOwner();
  if (Platform.OS === 'android')
    await (
      await import('./tracking-background-runtime')
    ).purgeDeletedOwnerTracking(ownerId, { assertCurrent, assertOwner });
  await assertOwner();
}
