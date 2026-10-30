import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAppShellStore } from '@/state/app-shell';
import {
  loadAssistantDraft,
  saveAssistantDraft,
  discardAssistantDraft,
  type AssistantDraft
} from '@/storage/app-shell-storage';

type DraftState = AssistantDraft & {
  owner: string | null;
  scope: string;
  loading: boolean;
  failure: 'restore' | 'save' | null;
};

function emptyDraft(
  owner: string | null,
  scope: string,
  text: string
): DraftState {
  return {
    owner,
    scope,
    text,
    revision: randomUUID(),
    loading: owner !== null,
    failure: null
  };
}

export function useAssistantDraft(scope: string, initialText = '') {
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const [state, setState] = useState<DraftState>(() =>
    emptyDraft(owner, scope, initialText)
  );
  const [retryRestore, setRetryRestore] = useState(0);
  const active = useRef(state);
  const mounted = useRef(true);
  const value =
    state.owner === owner && state.scope === scope
      ? state
      : emptyDraft(owner, scope, initialText);
  active.current = value;
  const current = () =>
    mounted.current &&
    useAppShellStore.getState().session?.userId === (owner ?? undefined) &&
    active.current.owner === owner &&
    active.current.scope === scope;

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const next = emptyDraft(owner, scope, initialText);
    active.current = next;
    setState(next);
    if (owner)
      void loadAssistantDraft(owner, scope)
        .then((saved) => {
          if (!cancelled)
            setState({ ...next, ...(saved ?? {}), loading: false });
        })
        .catch(() => {
          if (!cancelled)
            setState({ ...next, loading: false, failure: 'restore' });
        });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [owner, scope, initialText, retryRestore]);

  const persist = async (next: DraftState) => {
    if (!owner) return;
    try {
      await saveAssistantDraft(owner, scope, {
        text: next.text,
        revision: next.revision
      });
      if (current() && active.current.revision === next.revision)
        setState({ ...next, failure: null });
    } catch {
      if (current() && active.current.revision === next.revision)
        setState({ ...next, failure: 'save' });
    }
  };
  const change = (text: string) => {
    if (value.loading || value.failure === 'restore') return;
    const next = { ...value, text, revision: randomUUID(), failure: null };
    active.current = next;
    setState(next);
    void persist(next);
  };
  const discard = async (expectedRevision?: string) => {
    try {
      if (owner) await discardAssistantDraft(owner, scope, expectedRevision);
      if (
        current() &&
        (expectedRevision === undefined ||
          active.current.revision === expectedRevision)
      ) {
        const next = {
          ...active.current,
          text: '',
          revision: randomUUID(),
          failure: null
        };
        active.current = next;
        setState(next);
      }
    } catch (error) {
      if (current()) setState({ ...active.current, failure: 'save' });
      throw error;
    }
  };
  return {
    text: value.text,
    revision: value.revision,
    failure: value.failure,
    loading: value.loading || value.failure === 'restore',
    change,
    discard,
    retry: () =>
      value.failure === 'restore'
        ? setRetryRestore((count) => count + 1)
        : void persist(active.current)
  };
}
