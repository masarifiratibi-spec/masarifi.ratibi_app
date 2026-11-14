import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { reconcileFinancialReset } from '@/services/financial-generation';
import {
  acknowledgeFinancialReset,
  financialResetRuntimeAvailable,
  loadFinancialResetOperation,
  readFinancialReset,
  submitFinancialReset,
  type FinancialResetReceipt
} from '@/services/financial-reset';
import { HttpError } from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import { financialResetStateQuery } from './financial-reset-queries';

type ResetStage =
  'loading' | 'review' | 'retry' | 'stale' | 'processing' | 'completed';

export function useFinancialReset(ownerId: string) {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = React.useState(0);
  const [stage, setStage] = React.useState<ResetStage>('loading');
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [receiptId, setReceiptId] = React.useState<string | null>(null);
  const active = React.useRef(false);
  const locked = React.useRef(false);
  const current = React.useCallback(
    () =>
      active.current && useAppShellStore.getState().session?.userId === ownerId,
    [ownerId]
  );
  const invalidateState = React.useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: financialResetStateQuery(ownerId).queryKey,
        exact: true,
        refetchType: 'none'
      }),
    [ownerId, queryClient]
  );
  const accept = React.useCallback(
    async (receipt: FinancialResetReceipt) => {
      if (!current()) return;
      await invalidateState();
      if (!current()) return;
      setReceiptId(receipt.id);
      setStage('processing');
      if (receipt.status === 'completed') {
        const local = await reconcileFinancialReset(ownerId);
        if (local.generation < receipt.generation)
          throw new Error('generation not synchronized');
        if (current()) setStage('completed');
      }
    },
    [current, invalidateState, ownerId]
  );
  const run = React.useCallback(
    async (operation: () => Promise<void>) => {
      if (locked.current || !current()) return;
      locked.current = true;
      setBusy(true);
      setError(null);
      try {
        await operation();
      } catch (failure) {
        if (current())
          setError(
            failure instanceof HttpError && failure.code === 'session_expired'
              ? 'financialReset.sessionExpired'
              : 'financialReset.error'
          );
      } finally {
        locked.current = false;
        if (current()) setBusy(false);
      }
    },
    [current]
  );

  const refresh = React.useCallback(async () => {
    if (!financialResetRuntimeAvailable()) throw new Error('unavailable');
    const saved = await loadFinancialResetOperation(ownerId);
    const state = await queryClient.fetchQuery(
      financialResetStateQuery(ownerId)
    );
    const id =
      saved?.id ?? (state.status === 'processing' ? state.requestId : null);
    const receipt = id && (await readFinancialReset(ownerId, id));
    if (!current()) return;
    setGeneration(state.generation);
    if (receipt) await accept(receipt);
    else if (saved && saved.generation !== state.generation) {
      setReceiptId(saved.id);
      setStage('stale');
    } else setStage(id ? 'retry' : 'review');
  }, [accept, current, ownerId, queryClient]);

  React.useEffect(() => {
    active.current = true;
    void run(refresh);
    return () => {
      active.current = false;
    };
  }, [refresh, run]);
  React.useEffect(() => {
    if (stage !== 'processing' || !receiptId || error || busy) return;
    const timer = setTimeout(
      () =>
        void run(async () => {
          const receipt = await readFinancialReset(ownerId, receiptId);
          if (!receipt) throw new Error('receipt unavailable');
          await accept(receipt);
        }),
      3000
    );
    return () => clearTimeout(timer);
  }, [accept, busy, error, ownerId, receiptId, run, stage]);

  const submit = () => {
    if (stage !== 'review' && stage !== 'retry') return Promise.resolve();
    return run(async () => {
      try {
        const receipt = await submitFinancialReset(
          ownerId,
          generation,
          current
        );
        if (receipt) await accept(receipt);
      } catch (failure) {
        if (
          failure instanceof HttpError &&
          [
            'FINANCIAL_GENERATION_CHANGED',
            'FINANCIAL_GENERATION_STALE'
          ].includes(failure.domainCode ?? '')
        ) {
          await invalidateState();
          await refresh();
          if (current()) setError('financialReset.reviewChanged');
          return;
        }
        throw failure;
      }
    });
  };
  const reviewAgain = () =>
    run(async () => {
      if (receiptId) await acknowledgeFinancialReset(ownerId, receiptId);
      await invalidateState();
      await refresh();
    });
  const finish = (onClose: () => void) =>
    run(async () => {
      if (receiptId) await acknowledgeFinancialReset(ownerId, receiptId);
      if (current()) onClose();
    });
  return {
    stage,
    busy,
    error,
    submit,
    reviewAgain,
    finish,
    refresh: () =>
      run(async () => {
        await invalidateState();
        await refresh();
      })
  };
}
