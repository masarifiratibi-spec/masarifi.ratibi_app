import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import {
  randomUUID,
  digestStringAsync,
  CryptoDigestAlgorithm
} from 'expo-crypto';
import { z } from 'zod';
import {
  resolveClientMode,
  isBenchmarkReadOnly
} from '@/config/client-runtime';
import { useAppShellStore } from '@/state/app-shell';
import { captureTrackingAdmission } from '@/state/tracking-admission';
import { readLogoutSessionAnchor } from '../live/auth-service';
import {
  decodeIosShortcut,
  prepareIosShortcut,
  type IosShortcutCandidate
} from '@/features/tracking/ios-shortcut-capture';
import {
  createIosShortcutImport,
  type IosShortcutScope
} from '../ios-shortcut-import';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { automaticTrackingService } from '../automatic-tracking-service';
import { coreFinanceService } from '../mocks/core-finance-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { reconcileFinancialReset } from '../financial-generation';
import {
  registerRuntimeIdentityReset,
  registerFinancialProjectionReset
} from '@/storage/runtime-user-data-reset';
import { publishTrackingSave } from '../tracking-save-events';
import {
  iosShortcutEnrollmentSlot as enrollmentSlot,
  iosShortcutReceiptSlot as receiptSlot,
  serializeIosShortcutStorage as serializeEnrollmentMutation,
  subscribeIosShortcutStorageReset
} from '@/storage/ios-shortcut-storage';
const enrollmentSchema = z
  .object({
    ownerId: z.string().min(1),
    anchor: z.string().min(1),
    token: z.string().uuid(),
    id: z.string().uuid(),
    enabled: z.boolean()
  })
  .strict();
type Enrollment = z.infer<typeof enrollmentSchema>;
const receiptSchema = z
  .object({
    ownerId: z.string(),
    anchor: z.string(),
    enrollmentId: z.string().uuid(),
    lastSuccessAt: z.number().int().nonnegative(),
    lastTransactionId: z.string().uuid()
  })
  .strict();
type Staged = {
  ownerId: string;
  anchor: string;
  enrollmentId: string;
  candidate: IosShortcutCandidate;
  stagedAt: number;
};
const pending = new Map<string, Staged>();
const listeners = new Set<() => void>();
let outcome: 'received' | 'rejected' | null = null;
let captureRevision = 0;
let consentRevision = 0;
let captureBlocked = false;
const notify = () => listeners.forEach((listener) => listener());
function clearPending() {
  pending.clear();
  outcome = null;
  notify();
}
function invalidatePending() {
  captureRevision++;
  clearPending();
}
registerRuntimeIdentityReset((context) => {
  if (context && 'restoringOwnerId' in context) {
    for (const [id, staged] of pending)
      if (staged.ownerId !== context.restoringOwnerId) pending.delete(id);
    return;
  }
  invalidatePending();
});
registerFinancialProjectionReset(invalidatePending);
subscribeIosShortcutStorageReset((owner, kind) => {
  if (useAppShellStore.getState().session?.userId === owner) {
    if (kind === 'owner') {
      consentRevision++;
      captureBlocked = true;
    }
    invalidatePending();
  } else {
    for (const [id, staged] of pending)
      if (staged.ownerId === owner) pending.delete(id);
  }
});

async function readEnrollment(): Promise<Enrollment | null> {
  const raw = await SecureStore.getItemAsync(enrollmentSlot);
  if (!raw) return null;
  try {
    return enrollmentSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function currentScope(): Promise<{
  enrollment: Enrollment;
  scope: IosShortcutScope;
}> {
  if (resolveClientMode() !== 'live' || isBenchmarkReadOnly())
    throw Error('ios_shortcut_unavailable');
  const session = useAppShellStore.getState().session;
  if (session?.status !== 'authenticated' || !session.userId)
    throw Error('ios_shortcut_owner_required');
  const owner = session.userId;
  const assertAdmission = captureTrackingAdmission(owner);
  const anchor = await readLogoutSessionAnchor(owner);
  const enrollment = await readEnrollment();
  const revision = captureRevision;
  const assertCurrent = async () => {
    assertAdmission();
    const state = useAppShellStore.getState();
    if (
      state.session?.status !== 'authenticated' ||
      state.session.userId !== owner ||
      revision !== captureRevision ||
      !anchor ||
      (await readLogoutSessionAnchor(owner)) !== anchor
    )
      throw Error('ios_shortcut_owner_changed');
    assertAdmission();
    if (
      revision !== captureRevision ||
      useAppShellStore.getState().session?.userId !== owner
    )
      throw Error('ios_shortcut_owner_changed');
  };
  const assertCaptureReady = async () => {
    await assertCurrent();
    const privacy = useAppShellStore.getState().privacyLock;
    if (
      AppState.currentState !== 'active' ||
      (privacy?.enabled && privacy.appLockStatus !== 'unlocked')
    )
      throw Error('ios_shortcut_unlock_required');
  };
  await assertCaptureReady();
  if (
    !enrollment ||
    enrollment.ownerId !== owner ||
    enrollment.anchor !== anchor
  )
    throw Error('ios_shortcut_setup_required');
  return {
    enrollment,
    scope: {
      ownerId: owner,
      enrollmentId: enrollment.id,
      sessionBinding: await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        anchor!
      ),
      assertCurrent,
      captureEnabled: async () => {
        const revisionBeforeRead = consentRevision;
        if (captureBlocked) return false;
        await assertCaptureReady();
        const active = await readEnrollment();
        await assertCaptureReady();
        return (
          !captureBlocked &&
          revisionBeforeRead === consentRevision &&
          active?.enabled === true &&
          active.id === enrollment.id
        );
      }
    }
  };
}

async function enrollCurrentIosShortcut(
  revision: number,
  requestedOwner: string | undefined
) {
  if (resolveClientMode() !== 'live' || isBenchmarkReadOnly())
    throw Error('ios_shortcut_unavailable');
  const owner = useAppShellStore.getState().session?.userId;
  if (
    !owner ||
    owner !== requestedOwner ||
    useAppShellStore.getState().session?.status !== 'authenticated'
  )
    throw Error('ios_shortcut_owner_required');
  const assertCurrent = captureTrackingAdmission(owner);
  const anchor = await readLogoutSessionAnchor(owner);
  assertCurrent();
  if (!anchor) throw Error('ios_shortcut_owner_required');
  const previous = await readEnrollment();
  assertCurrent();
  if ((await readLogoutSessionAnchor(owner)) !== anchor)
    throw Error('ios_shortcut_owner_changed');
  const enrollment: Enrollment =
    previous?.enabled &&
    previous.ownerId === owner &&
    previous.anchor === anchor
      ? previous
      : {
          ownerId: owner,
          anchor,
          token: randomUUID(),
          id: randomUUID(),
          enabled: true
        };
  if (revision !== consentRevision) throw Error('ios_shortcut_consent_changed');
  await SecureStore.setItemAsync(enrollmentSlot, JSON.stringify(enrollment));
  assertCurrent();
  if (revision !== consentRevision) throw Error('ios_shortcut_consent_changed');
  captureBlocked = false;
  return enrollment.token;
}
export function enrollIosShortcut() {
  const revision = ++consentRevision;
  const owner = useAppShellStore.getState().session?.userId ?? undefined;
  return serializeEnrollmentMutation(() =>
    enrollCurrentIosShortcut(revision, owner)
  );
}
export function disableIosShortcut() {
  consentRevision++;
  captureBlocked = true;
  const owner = useAppShellStore.getState().session?.userId;
  notify();
  return serializeEnrollmentMutation(async () => {
    const { enrollment, scope } = await currentScope();
    if (scope.ownerId !== owner) throw Error('ios_shortcut_owner_changed');
    await scope.assertCurrent();
    await SecureStore.setItemAsync(
      enrollmentSlot,
      JSON.stringify({ ...enrollment, enabled: false })
    );
    clearPending();
  });
}

/** Called only from iOS native-intent. Never returns the incoming URL to Router. */
export async function receiveIosShortcut(path: string) {
  const revision = consentRevision;
  outcome = 'rejected';
  try {
    if (
      captureBlocked ||
      resolveClientMode() !== 'live' ||
      isBenchmarkReadOnly()
    )
      return;
    const input = decodeIosShortcut(path);
    if (!input) return;
    const enrollment = await readEnrollment();
    if (!enrollment?.enabled || enrollment.token !== input.token) return;
    const candidate = await prepareIosShortcut(input);
    if (!candidate) return;
    const current = await readEnrollment();
    if (
      captureBlocked ||
      revision !== consentRevision ||
      !current?.enabled ||
      current.id !== enrollment.id ||
      pending.size >= 10
    )
      return;
    pending.set(candidate.sourceItemKey, {
      ownerId: enrollment.ownerId,
      anchor: enrollment.anchor,
      enrollmentId: enrollment.id,
      candidate,
      stagedAt: Date.now()
    });
    outcome = 'received';
  } catch {
    /* Never echo source text, credentials or native URL. */
  } finally {
    notify();
  }
}
export async function readIosShortcutState() {
  const { enrollment, scope } = await currentScope();
  await scope.assertCurrent();
  for (const [id, staged] of pending) {
    if (
      staged.ownerId !== scope.ownerId ||
      staged.anchor !== enrollment.anchor ||
      staged.enrollmentId !== enrollment.id ||
      Date.now() - staged.stagedAt > 15 * 60000
    )
      pending.delete(id);
  }
  const receiptRaw = await SecureStore.getItemAsync(receiptSlot);
  await scope.assertCurrent();
  let lastReceipt: z.infer<typeof receiptSchema> | null = null;
  try {
    const receipt = receiptRaw
      ? receiptSchema.parse(JSON.parse(receiptRaw))
      : null;
    if (
      receipt?.ownerId === scope.ownerId &&
      receipt.anchor === enrollment.anchor &&
      receipt.enrollmentId === enrollment.id
    )
      lastReceipt = receipt;
  } catch {
    /* Corrupt or stale receipt metadata never establishes a successful save. */
  }
  return {
    enabled: enrollment.enabled && !captureBlocked,
    token: enrollment.enabled && !captureBlocked ? enrollment.token : null,
    lastSuccessAt: lastReceipt?.lastSuccessAt ?? null,
    lastTransactionId: lastReceipt?.lastTransactionId ?? null,
    candidates: [...pending.values()].map((staged) => staged.candidate),
    outcome
  };
}
const service = createIosShortcutImport({
  queue: new SmsImportQueue(),
  resetState: (owner) => reconcileFinancialReset(owner),
  async accounts() {
    // Confirm can queue offline from the encrypted owner repository. Resume rechecks with the server.
    try {
      return await coreFinanceService.listAccounts();
    } catch {
      const repository = new CoreFinanceRepository();
      await repository.hydrate({ preserveDrafts: true });
      return repository.listAccounts();
    }
  },
  submit: async (input, key, owner, assertCaptureIntent) => {
    const submit = await automaticTrackingService.prepareImportSubmission!(
      owner,
      assertCaptureIntent
    );
    return submit(input, key, owner);
  },
  receipt: (...args) => automaticTrackingService.getImportSession(...args),
  outcomes: (id) => automaticTrackingService.listImportOutcomes!(id)
});
export async function submitIosShortcut(
  sourceItemKey?: string,
  accountId?: string
) {
  const { enrollment, scope } = await currentScope();
  const staged = sourceItemKey ? pending.get(sourceItemKey) : null;
  if (
    sourceItemKey &&
    (!staged ||
      staged.ownerId !== scope.ownerId ||
      staged.anchor !== enrollment.anchor ||
      staged.enrollmentId !== enrollment.id ||
      Date.now() - staged.stagedAt > 15 * 60000)
  )
    throw Error('ios_shortcut_input_expired');
  const result =
    staged && accountId
      ? await service.confirm(scope, staged.candidate, accountId)
      : await service.resume(scope);
  await scope.assertCurrent();
  if (
    staged &&
    ['saved', 'duplicate', 'queued', 'processing', 'review'].includes(
      result.status
    )
  )
    pending.delete(staged.candidate.sourceItemKey);
  if (result.status === 'saved' && result.transactionId) {
    await serializeEnrollmentMutation(async () => {
      await scope.assertCurrent();
      await SecureStore.setItemAsync(
        receiptSlot,
        JSON.stringify({
          ownerId: scope.ownerId,
          anchor: enrollment.anchor,
          enrollmentId: enrollment.id,
          lastSuccessAt: Date.now(),
          lastTransactionId: result.transactionId
        })
      );
      await scope.assertCurrent();
    });
    publishTrackingSave({
      ownerId: scope.ownerId,
      transactionIds: [result.transactionId]
    });
  }
  notify();
  return result;
}
export function subscribeIosShortcut(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
