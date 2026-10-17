import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PlanningDraft } from '@/domain/financial-planning';
import { financialPlanningService } from '@/services/financial-planning-service';

const draftKey = (id: string) => ['planning', 'draft', id] as const;

export function usePlanningDraft(id: string) {
  return useQuery({
    queryKey: draftKey(id),
    queryFn: () => financialPlanningService.loadDraft(id),
    enabled: Boolean(id)
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
  const [draftReady, setDraftReady] = useState(false);
  const restore = useRef(input.restore);
  const onError = useRef(input.onError);
  const payload = JSON.stringify(input.payload) ?? 'null';
  const latestPayload = useRef(payload);
  const discarded = useRef<{ id: string; payload: string } | undefined>(undefined);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  restore.current = input.restore;
  onError.current = input.onError;
  latestPayload.current = payload;

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setDraftReady(false);
      return () => {
        active = false;
      };
    }
    void financialPlanningService
      .loadDraft(input.id)
      .then((draft) => {
        if (active && draft) restore.current(draft.payload);
      })
      .catch(() => {
        if (active) onError.current();
      })
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [enabled, input.id]);

  useEffect(() => {
    if (
      !enabled ||
      !draftReady ||
      !input.meaningful ||
      (discarded.current?.id === input.id &&
        discarded.current.payload === payload)
    )
      return;
    discarded.current = undefined;
    const timeout = setTimeout(() => {
      pendingWrite.current = pendingWrite.current
        .then(() =>
          financialPlanningService.saveDraft({
            id: input.id,
            kind: input.kind,
            entityId: input.entityId,
            payload: JSON.parse(payload),
            status: 'editing',
            updatedAt: Date.now()
          })
        )
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
    payload
  ]);

  const discardDraft = useCallback(() => {
    discarded.current = { id: input.id, payload: latestPayload.current };
    clearTimeout(autosaveTimer.current);
    const deletion = pendingWrite.current.then(() =>
      financialPlanningService.discardDraft(input.id)
    );
    pendingWrite.current = deletion.catch(() => undefined);
    return deletion;
  }, [input.id]);
  return { draftReady, discardDraft };
}
