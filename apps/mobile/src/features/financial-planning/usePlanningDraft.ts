import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PlanningDraft } from '@/domain/financial-planning';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useAppShellStore } from '@/state/app-shell';

const draftKey = (id: string) => ['planning', 'draft', id] as const;

export function usePlanningDraft(id: string) {
  return useQuery({
    queryKey: draftKey(id),
    queryFn: () => financialPlanningService.loadDraft(id),
    enabled: Boolean(id)
  });
}

export function usePlanningDrafts(kind: PlanningDraft['kind']) {
  const ownerId = useAppShellStore((state) => state.session?.userId);
  return useQuery({
    queryKey: ['planning', 'draft', 'list', ownerId, kind],
    queryFn: () => financialPlanningService.listDrafts(kind),
    staleTime: 0
  });
}

export function useSavePlanningDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: PlanningDraft) =>
      financialPlanningService.saveDraft(draft),
    onSuccess: async (draft) => {
      await client.invalidateQueries({ queryKey: draftKey(draft.id) });
    }
  });
}

export function useDiscardPlanningDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financialPlanningService.discardDraft(id),
    onSuccess: async (_value, id) => {
      await client.invalidateQueries({ queryKey: draftKey(id) });
    }
  });
}

export function usePlanningFormDraft(input: {
  id: string;
  kind: PlanningDraft['kind'];
  entityId: string | null;
  payload: unknown;
  meaningful: boolean;
  restore: (payload: unknown) => void;
  onError: () => void;
  enabled?: boolean;
}) {
  const enabled = input.enabled ?? true;
  const ownerId = useAppShellStore((state) => state.session?.userId);
  const identity = JSON.stringify([ownerId ?? null, input.id]);
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraftIdentity, setRestoredDraftIdentity] = useState<
    string | null
  >(null);
  const initializedDraft = useRef<string | null>(null);
  const persistedPayload = useRef<{ identity: string; payload: string } | null>(
    null
  );
  const restore = useRef(input.restore);
  const onError = useRef(input.onError);
  const payload = JSON.stringify(input.payload) ?? 'null';
  const latestPayload = useRef(payload);
  const discarded = useRef<{ id: string; payload: string } | undefined>(
    undefined
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  restore.current = input.restore;
  onError.current = input.onError;
  latestPayload.current = payload;

  useEffect(() => {
    let active = true;
    if (!enabled) {
      if (initializedDraft.current !== identity) setDraftReady(false);
      return () => {
        active = false;
      };
    }
    // A transient profile failure must not restore over current unsaved edits.
    if (initializedDraft.current === identity) {
      setDraftReady(true);
      return () => {
        active = false;
      };
    }
    setDraftReady(false);
    void financialPlanningService
      .loadDraft(input.id)
      .then((draft) => {
        if (active && draft) {
          persistedPayload.current = {
            identity,
            payload: JSON.stringify(draft.payload)
          };
          setRestoredDraftIdentity(identity);
          restore.current(draft.payload);
        }
      })
      .catch(() => {
        if (active) onError.current();
      })
      .finally(() => {
        if (active) {
          initializedDraft.current = identity;
          setDraftReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, input.id, identity]);

  useEffect(() => {
    if (
      !enabled ||
      !draftReady ||
      !input.meaningful ||
      (persistedPayload.current?.identity === identity &&
        persistedPayload.current.payload === payload) ||
      (discarded.current?.id === input.id &&
        discarded.current.payload === payload)
    )
      return;
    discarded.current = undefined;
    const timeout = setTimeout(() => {
      pendingWrite.current = pendingWrite.current
        .then(async () => {
          if (useAppShellStore.getState().session?.userId !== ownerId) return;
          await financialPlanningService.saveDraft({
            id: input.id,
            kind: input.kind,
            entityId: input.entityId,
            payload: JSON.parse(payload),
            status: 'editing',
            updatedAt: Date.now()
          });
          if (
            useAppShellStore.getState().session?.userId === ownerId &&
            initializedDraft.current === identity
          )
            persistedPayload.current = { identity, payload };
        })
        .then(() => undefined)
        .catch(() => onError.current());
    }, 250);
    autosaveTimer.current = timeout;
    return () => clearTimeout(timeout);
  }, [
    draftReady,
    enabled,
    input.entityId,
    input.id,
    input.kind,
    input.meaningful,
    identity,
    ownerId,
    payload
  ]);

  const discardDraft = useCallback(() => {
    discarded.current = { id: input.id, payload: latestPayload.current };
    clearTimeout(autosaveTimer.current);
    const deletion = pendingWrite.current.then(async () => {
      if (useAppShellStore.getState().session?.userId !== ownerId) return;
      await financialPlanningService.discardDraft(input.id);
      if (persistedPayload.current?.identity === identity)
        persistedPayload.current = null;
    });
    pendingWrite.current = deletion.catch(() => undefined);
    setRestoredDraftIdentity((current) =>
      current === identity ? null : current
    );
    return deletion;
  }, [input.id, ownerId, identity]);
  return {
    draftReady,
    discardDraft,
    hasRestoredDraft: restoredDraftIdentity === identity
  };
}
