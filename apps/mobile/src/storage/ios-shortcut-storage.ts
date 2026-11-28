import * as SecureStore from 'expo-secure-store';

export const iosShortcutEnrollmentSlot = 'masarifi.iosShortcut.enrollment.v1';
export const iosShortcutReceiptSlot = 'masarifi.iosShortcut.receipt.v1';
type StorageResetKind = 'owner' | 'financial';
const invalidators = new Set<(owner: string, kind: StorageResetKind) => void>();
let writes: Promise<void> = Promise.resolve();

export function serializeIosShortcutStorage<T>(
  mutation: () => Promise<T>
): Promise<T> {
  const pendingWrite = writes.then(mutation);
  writes = pendingWrite.then(
    () => undefined,
    () => undefined
  );
  return pendingWrite;
}
export function subscribeIosShortcutStorageReset(
  listener: (owner: string, kind: StorageResetKind) => void
) {
  invalidators.add(listener);
  return () => {
    invalidators.delete(listener);
  };
}
async function removeOwnedSlots(
  owner: string,
  slots: readonly string[],
  assertCurrent: () => void | Promise<void>
) {
  await assertCurrent();
  for (const slot of slots) {
    const raw = await SecureStore.getItemAsync(slot);
    await assertCurrent();
    if (!raw) continue;
    let storedOwner: unknown;
    try {
      storedOwner = JSON.parse(raw).ownerId;
    } catch {
      throw Error('ios_shortcut_storage_invalid');
    }
    if (typeof storedOwner !== 'string')
      throw Error('ios_shortcut_storage_invalid');
    if (storedOwner !== owner) continue;
    await SecureStore.deleteItemAsync(slot);
    await assertCurrent();
  }
}
export async function purgeIosShortcutOwner(
  owner: string,
  assertCurrent: () => void | Promise<void>
) {
  await assertCurrent();
  for (const invalidate of invalidators) invalidate(owner, 'owner');
  return serializeIosShortcutStorage(() =>
    removeOwnedSlots(
      owner,
      [iosShortcutEnrollmentSlot, iosShortcutReceiptSlot],
      assertCurrent
    )
  );
}
export async function resetIosShortcutReceipt(
  owner: string,
  assertCurrent: () => void | Promise<void>
) {
  await assertCurrent();
  for (const invalidate of invalidators) invalidate(owner, 'financial');
  return serializeIosShortcutStorage(() =>
    removeOwnedSlots(owner, [iosShortcutReceiptSlot], assertCurrent)
  );
}
