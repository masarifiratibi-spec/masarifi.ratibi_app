import {
  iosShortcutEnrollmentSlot,
  iosShortcutReceiptSlot,
  purgeIosShortcutOwner,
  resetIosShortcutReceipt,
  serializeIosShortcutStorage
} from './ios-shortcut-storage';
const mockSlots = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (slot: string) => mockSlots.get(slot) ?? null,
  setItemAsync: async (slot: string, value: string) => {
    mockSlots.set(slot, value);
  },
  deleteItemAsync: async (slot: string) => {
    mockSlots.delete(slot);
  }
}));
beforeEach(() => mockSlots.clear());
test('explicit owner purge removes both owned Keychain records without touching another owner', async () => {
  mockSlots.set(
    iosShortcutEnrollmentSlot,
    JSON.stringify({ ownerId: 'owner-a', token: 'synthetic' })
  );
  mockSlots.set(
    iosShortcutReceiptSlot,
    JSON.stringify({ ownerId: 'owner-b', lastTransactionId: 'owned-by-b' })
  );
  await purgeIosShortcutOwner('owner-a', () => {});
  expect(mockSlots.has(iosShortcutEnrollmentSlot)).toBe(false);
  expect(JSON.parse(mockSlots.get(iosShortcutReceiptSlot)!)).toMatchObject({
    ownerId: 'owner-b'
  });
  await purgeIosShortcutOwner('owner-b', () => {});
  expect(mockSlots.size).toBe(0);
});
test('financial reset clears receipt projection while preserving enrollment consent', async () => {
  mockSlots.set(
    iosShortcutEnrollmentSlot,
    JSON.stringify({ ownerId: 'owner-a', enabled: true })
  );
  mockSlots.set(
    iosShortcutReceiptSlot,
    JSON.stringify({ ownerId: 'owner-a', lastTransactionId: 'old-money' })
  );
  await resetIosShortcutReceipt('owner-a', () => {});
  expect(mockSlots.has(iosShortcutReceiptSlot)).toBe(false);
  expect(JSON.parse(mockSlots.get(iosShortcutEnrollmentSlot)!)).toMatchObject({
    enabled: true
  });
});
test('purge serializes after an earlier receipt write and refuses a changed cleanup owner', async () => {
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const receiptWrite = serializeIosShortcutStorage(async () => {
    started();
    await hold;
    mockSlots.set(
      iosShortcutReceiptSlot,
      JSON.stringify({ ownerId: 'owner-a' })
    );
  });
  await entered;
  const purge = purgeIosShortcutOwner('owner-a', () => {});
  release();
  await receiptWrite;
  await purge;
  expect(mockSlots.has(iosShortcutReceiptSlot)).toBe(false);
  mockSlots.set(
    iosShortcutEnrollmentSlot,
    JSON.stringify({ ownerId: 'owner-a' })
  );
  await expect(
    purgeIosShortcutOwner('owner-a', () => {
      throw Error('owner_changed');
    })
  ).rejects.toThrow('owner_changed');
  expect(mockSlots.has(iosShortcutEnrollmentSlot)).toBe(true);
});
