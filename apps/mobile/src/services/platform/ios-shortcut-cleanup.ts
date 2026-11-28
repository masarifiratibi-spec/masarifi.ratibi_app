// Other platforms have no iOS Shortcuts Keychain records or runtime to purge.
export async function purgeIosShortcutOwner(
  _owner: string,
  _assertCurrent: () => void | Promise<void>
): Promise<void> {}
export async function resetIosShortcutReceipt(
  _owner: string,
  _assertCurrent: () => void | Promise<void>
): Promise<void> {}
