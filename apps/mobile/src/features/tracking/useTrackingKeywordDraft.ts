import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { KeywordRule } from '@/domain/app-shell';
import { useAppShellStore } from '@/state/app-shell';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { trackingKeywordConfiguration } from '@/services/tracking-keyword-configuration';
import { useKeywordRules } from './useAutomaticTracking';

/** Both existing editors use one saved-read/draft path and the unchanged live save preflight. */
export function useTrackingKeywordDraft() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const client = useQueryClient();
  const query = useKeywordRules();
  const [draft, setDraft] = useState<{
    rules: KeywordRule[];
    previousRules: KeywordRule[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const readable = hasReadableSnapshot(query);
  const rules = draft?.rules ?? query.data ?? [];
  const blocked = saving || query.isFetching || query.isError || !readable;

  async function save() {
    if (blocked) return false;
    setError(false);
    setSaving(true);
    try {
      await trackingKeywordConfiguration.save(
        rules,
        draft?.previousRules ?? rules,
        (saved) => {
          const key = automaticTrackingReadKey(
            automaticTrackingKeys.keywords(),
            ownerId
          );
          client.setQueryData(key, saved);
          // Manual authoritative mutation results do not become read-cache writes.
          void client.invalidateQueries({
            queryKey: key,
            exact: true,
            refetchType: 'none'
          });
          setDraft(null);
        }
      );
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    query,
    rules,
    readable,
    blocked,
    saving,
    error,
    save,
    setRules: (next: KeywordRule[]) =>
      setDraft((current) => ({
        rules: next,
        previousRules: current?.previousRules ?? rules
      }))
  };
}
