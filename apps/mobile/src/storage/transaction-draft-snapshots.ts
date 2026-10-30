import type { TransactionDraft } from '@/domain/core-finance';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from './runtime-user-data-reset';

export interface DraftOwner {
  userId: string;
  assertCurrent(): Promise<void>;
}

const snapshots = new Map<
  string,
  { owner: DraftOwner; draft: TransactionDraft | null }
>();
let generation = 0;
let activeWrites = 0;
const settledWrites = new Set<() => void>();
export async function settleTransactionDraftWrites(): Promise<void> {
  if (activeWrites === 0) return;
  await new Promise<void>(resolve => settledWrites.add(resolve));
}
const clearSnapshots = () => {
  generation++;
  snapshots.clear();
};
registerRuntimeIdentityReset(clearSnapshots);
registerRuntimeUserDataReset(clearSnapshots);
const copyDraft = (draft: TransactionDraft | null): TransactionDraft | null =>
  draft === null ? null : JSON.parse(JSON.stringify(draft));

// Writes always arbitrate against SQLite, never this display-only snapshot.
// Clear on either side of every producer, including failed writes/owner resets.
export async function withTransactionDraftWrite<T>(
  write: () => Promise<T>
): Promise<T> {
  clearSnapshots();
  activeWrites++;
  try {
    return await write();
  } finally {
    activeWrites--;
    if (activeWrites === 0) {
      for (const resolve of settledWrites) resolve();
      settledWrites.clear();
    }
    clearSnapshots();
  }
}

export async function readTransactionDraftSnapshot(
  owner: DraftOwner,
  id: string,
  readDurable: () => Promise<TransactionDraft | null>
): Promise<TransactionDraft | null> {
  const key = JSON.stringify([owner.userId, id]);
  const cached = snapshots.get(key);
  if (cached) {
    const hitGeneration = generation;
    try {
      await cached.owner.assertCurrent();
    } catch {
      if (snapshots.get(key) === cached) snapshots.delete(key);
    }
    await owner.assertCurrent();
    if (
      hitGeneration === generation &&
      activeWrites === 0 &&
      snapshots.get(key) === cached
    )
      return copyDraft(cached.draft);
  }
  const readGeneration = generation;
  const draft = await readDurable();
  if (readGeneration === generation && activeWrites === 0) {
    if (snapshots.size >= 32) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(key, { owner, draft: copyDraft(draft) });
  }
  return draft;
}
