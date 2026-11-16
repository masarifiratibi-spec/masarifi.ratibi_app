import * as legacy from '@/storage/ios-shortcut-storage';
import { disableBankSmsForOwner } from './bank-sms-bridge.ios';

export async function purgeIosShortcutOwner(
  owner: string,
  assertCurrent: () => void | Promise<void>
) {
  await assertCurrent();
  await disableBankSmsForOwner(owner, true);
  await legacy.purgeIosShortcutOwner(owner, assertCurrent);
}

export async function resetIosShortcutReceipt(
  owner: string,
  assertCurrent: () => void | Promise<void>
) {
  await assertCurrent();
  await disableBankSmsForOwner(owner);
  await legacy.resetIosShortcutReceipt(owner, assertCurrent);
}
