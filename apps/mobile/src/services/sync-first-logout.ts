import { useAppShellStore } from '@/state/app-shell';
import { prepareLogoutDisposition, markLogoutCleanupReady, completeLogoutDisposition, type LogoutDisposition } from '@/storage/app-shell-storage';

interface LogoutDependencies {
  logout: Pick<LogoutDisposition, 'ownerId' | 'sessionId' | 'scope'> & Partial<Pick<LogoutDisposition, 'dataDisposition'>>;
  synchronize(): Promise<void>;
  pending(): Promise<number>;
  confirmRemoval(count: number | null): Promise<boolean>;
  signOut(record: LogoutDisposition): Promise<void>;
  purge(record: LogoutDisposition): Promise<void>;
  assertCurrent(): void;
  quiesce?(): Promise<void>;
  resume?(): Promise<void>;
}

export async function syncFirstLogout(
  dependencies: LogoutDependencies
): Promise<boolean> {
  const preserve = dependencies.logout.dataDisposition === 'preserve';
  if (!preserve) await dependencies.synchronize().catch(() => undefined);
  dependencies.assertCurrent();
  let prepared = false;
  try {
    await dependencies.quiesce?.();
    if (!preserve) {
      const pending = await dependencies.pending().catch(() => null);
      if (pending !== 0 && !(await dependencies.confirmRemoval(pending))) return false;
    }
    dependencies.assertCurrent();
    const disposition = await prepareLogoutDisposition({...dependencies.logout, dataDisposition: preserve ? 'preserve' : 'remove'});
    prepared = true;
    useAppShellStore.getState().fenceLogoutOwner(disposition.ownerId);
    await dependencies.signOut(disposition);
    const ready = await markLogoutCleanupReady(disposition);
    dependencies.assertCurrent();
    await dependencies.purge(ready);
    await completeLogoutDisposition(ready);
    if (useAppShellStore.getState().logoutRecoveryOwnerId === ready.ownerId)
      useAppShellStore.setState({ logoutRecoveryOwnerId: null });
    return true;
  } finally {
    if (!prepared) {
      dependencies.assertCurrent();
      await dependencies.resume?.();
    }
  }
}
