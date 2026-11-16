import type { TransactionInput } from '@/domain/core-finance';
import type { IosShortcutScope } from '../ios-shortcut-import';
import { createLiveLedgerService } from '../live/core-finance-service';
import { createLiveCategoryLifecycleService } from '../live/category-lifecycle-service';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { HttpError } from '../live/http-client';

/** One ordinary ledger provider; the capture queue owns durable retries, without a second sync lane. */
export function createIosShortcutLedgerSubmit(transport: typeof fetch = fetch) {
  let activeScope: IosShortcutScope | null = null;
  let tail: Promise<void> = Promise.resolve();
  const assertActor = async (actor: {
    userId: string;
    sessionId?: string;
    assertCurrent(): Promise<void>;
  }) => {
    const scope = activeScope;
    if (
      !scope ||
      typeof actor.sessionId !== 'string' ||
      actor.userId !== scope.ownerId ||
      (await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        actor.sessionId
      )) !== scope.sessionBinding
    )
      throw new HttpError('session_expired', 401);
    await actor.assertCurrent();
    await scope.assertCurrent();
  };
  const guardedRequest: typeof fetch = async (url, init) => {
    const scope = activeScope;
    if (!scope) throw Error('ios_shortcut_not_prepared');
    await scope.assertCurrent();
    if (
      (init?.method ?? 'GET').toUpperCase() !== 'GET' &&
      !(await scope.captureEnabled())
    )
      throw Error('ios_shortcut_disabled');
    return transport(url, init);
  };
  const categories = createLiveCategoryLifecycleService({
    assertActor,
    request: guardedRequest
  });
  const ledger = createLiveLedgerService({
    assertActor,
    request: guardedRequest,
    categoryIds: {
      prepare: categories.prepareCategoryIds,
      toServer: categories.serverCategoryId,
      toLocal: categories.localCategoryId
    }
  });
  return (
    input: TransactionInput,
    operationId: string,
    scope: IosShortcutScope
  ) => {
    const operation = tail.then(async () => {
      await scope.assertCurrent();
      activeScope = scope;
      try {
        const receipt = await ledger.createTransaction(
          input,
          operationId,
          'platform_assisted'
        );
        await scope.assertCurrent();
        return receipt;
      } finally {
        activeScope = null;
      }
    });
    tail = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  };
}

export const submitIosShortcutLedger = createIosShortcutLedgerSubmit();
