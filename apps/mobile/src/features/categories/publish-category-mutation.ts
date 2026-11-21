import type { QueryClient } from '@tanstack/react-query';
import type { Category } from '@/domain/core-finance';
import type { MutationResult } from '@/services/contracts/core-finance-service';
import { HttpError } from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import {
  coreFinanceKeys,
  invalidateCoreFinanceScopes
} from '@/features/core-finance/core-finance-queries';

export function categoryMutationOwner() {
  const session = useAppShellStore.getState().session;
  return session?.status === 'authenticated' ? session.userId : null;
}

export async function publishCategoryMutation(
  client: QueryClient,
  result: MutationResult<Category>,
  ownerId: string | null
) {
  await client.cancelQueries({ queryKey: ['core-finance', 'categories'] });
  if (categoryMutationOwner() !== ownerId)
    throw new HttpError('session_expired', 401);
  for (const includeArchived of [false, true]) {
    client.setQueryData<Category[]>(
      coreFinanceKeys.categories(includeArchived),
      (current) => {
        if (!current) return current;
        const remaining = current.filter(
          (category) => category.id !== result.value.id
        );
        return includeArchived || result.value.status === 'active'
          ? [...remaining, result.value]
          : remaining;
      }
    );
  }
  // The write is confirmed; keep all dependent screens syncing without holding the form open.
  void invalidateCoreFinanceScopes(client, result.affectedScopes).catch(() => {
    // Failed reads stay stale in Query; they must not turn a successful write into a failed save.
  });
}
