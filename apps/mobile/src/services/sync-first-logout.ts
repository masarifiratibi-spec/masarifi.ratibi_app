interface LogoutDependencies {
  synchronize(): Promise<void>;
  pending(): Promise<number>;
  confirmRemoval(count: number | null): Promise<boolean>;
  signOut(): Promise<void>;
  purge(): Promise<void>;
  assertCurrent(): void;
  quiesce?(): Promise<void>;
  resume?(): Promise<void>;
}

export async function syncFirstLogout(
  dependencies: LogoutDependencies
): Promise<boolean> {
  await dependencies.synchronize().catch(() => undefined);
  dependencies.assertCurrent();
  await dependencies.quiesce?.();
  let signedOut = false;
  try {
    const pending = await dependencies.pending().catch(() => null);
    if (pending !== 0 && !(await dependencies.confirmRemoval(pending)))
      return false;
    dependencies.assertCurrent();
    await dependencies.signOut();
    signedOut = true;
    dependencies.assertCurrent();
    await dependencies.purge();
    return true;
  } finally {
    if (!signedOut) {
      dependencies.assertCurrent();
      await dependencies.resume?.();
    }
  }
}
