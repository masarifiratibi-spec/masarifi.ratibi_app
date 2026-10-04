import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import {
  VoiceBatchLocalTerminalError,
  type VoiceBatchResult
} from '@/services/live/voice-batch-api-service';
import { invalidateCoreFinanceScopes } from '@/features/core-finance/core-finance-queries';

export function useVoiceBatches(owner: string | null) {
  const [results, setResults] = useState<VoiceBatchResult[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [uncertainIds, setUncertainIds] = useState<string[]>([]);
  const [localFailure, setLocalFailure] = useState(false);
  const ownerRef = useRef(owner);
  const generation = useRef(0);
  if (ownerRef.current !== owner) generation.current++;
  ownerRef.current = owner;
  const recovering = useRef<number | null>(null);
  const active = useRef(new Set<string>());
  const pollingNeeded = useRef(false);
  pollingNeeded.current =
    pendingIds.length > 0 ||
    uncertainIds.length > 0 ||
    results.some(
      (row) => !['completed', 'cancelled', 'failed'].includes(row.status)
    );
  const mounted = useRef(true);
  const seen = useRef(new Set<string>());
  const invalidateGeneration = useCallback(() => {
    generation.current++;
  }, []);
  const client = useQueryClient();
  const publish = useCallback(
    (result: VoiceBatchResult, expectedGeneration: number) => {
      if (!mounted.current || expectedGeneration !== generation.current) return;
      setResults((previous) =>
        [
          ...previous.filter((row) => row.sessionId !== result.sessionId),
          result
        ].slice(-20)
      );
      const fresh = result.transactionIds.filter((id) => !seen.current.has(id));
      fresh.forEach((id) => seen.current.add(id));
      if (fresh.length)
        void invalidateCoreFinanceScopes(client, [
          'home.summary',
          'accounts.balances',
          'transactions.list',
          'reports.live',
          'assistant.context'
        ]).catch(() => undefined);
    },
    [client]
  );
  const recover = useCallback(async () => {
    if (
      !ownerRef.current ||
      recovering.current === generation.current ||
      !voiceAnalyzerService.recoverBatches
    )
      return;
    const expected = generation.current;
    recovering.current = expected;
    try {
      const values = await voiceAnalyzerService.recoverBatches((ids) => {
        if (expected === generation.current && mounted.current)
          setPendingIds([...new Set([...ids, ...active.current])]);
      });
      if (expected !== generation.current || !mounted.current) return;
      values.results.forEach((value) => publish(value, expected));
      setPendingIds([...new Set([...values.pendingIds, ...active.current])]);
      setLocalFailure(values.localFailure);
      setUncertainIds((previous) => [
        ...previous.filter((id) => active.current.has(id)),
        ...(values.uncertain ? ['recovery'] : [])
      ]);
    } catch {
      if (expected === generation.current && mounted.current)
        setUncertainIds((previous) => [...new Set([...previous, 'recovery'])]);
    } finally {
      if (recovering.current === expected) recovering.current = null;
    }
  }, [publish]);
  useEffect(() => {
    mounted.current = true;
    setResults([]);
    setPendingIds([]);
    setUncertainIds([]);
    setLocalFailure(false);
    active.current.clear();
    seen.current.clear();
    void recover();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recover();
      else voiceAnalyzerService.pauseBatches?.();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && pollingNeeded.current)
        void recover();
    }, 10000);
    return () => {
      mounted.current = false;
      invalidateGeneration();
      clearInterval(timer);
      subscription.remove();
      voiceAnalyzerService.pauseBatches?.();
    };
  }, [owner, recover, invalidateGeneration]);
  const submit = (id: string) => {
    const expected = generation.current;
    active.current.add(id);
    setLocalFailure(false);
    setPendingIds((previous) => [...new Set([...previous, id])]);
    void voiceAnalyzerService
      .runBatch?.(id)
      .then((value) => {
        publish(value, expected);
        if (expected === generation.current && mounted.current) {
          active.current.delete(id);
          if (['completed', 'cancelled', 'failed'].includes(value.status))
            setPendingIds((previous) =>
              previous.filter((value) => value !== id)
            );
          setUncertainIds((previous) =>
            previous.filter((value) => value !== id)
          );
        }
      })
      .catch((error: unknown) => {
        if (expected === generation.current && mounted.current) {
          active.current.delete(id);
          if (error instanceof VoiceBatchLocalTerminalError) {
            setPendingIds((previous) =>
              previous.filter((value) => value !== id)
            );
            if (error.phase === 'failed') setLocalFailure(true);
            return;
          }
          setUncertainIds((previous) => [...new Set([...previous, id])]);
        }
      });
  };
  const cancel = async (id: string) => {
    const expected = generation.current;
    try {
      const value = await voiceAnalyzerService.cancelBatch?.(id);
      if (expected !== generation.current || !mounted.current) return;
      if (value) {
        publish(value, expected);
        if (['completed', 'cancelled', 'failed'].includes(value.status)) {
          active.current.delete(id);
          setPendingIds((previous) => previous.filter((value) => value !== id));
          setUncertainIds((previous) =>
            previous.filter((value) => value !== id)
          );
        }
      } else setUncertainIds((previous) => [...new Set([...previous, id])]);
    } catch (error) {
      if (
        error instanceof VoiceBatchLocalTerminalError &&
        expected === generation.current &&
        mounted.current
      ) {
        active.current.delete(id);
        setPendingIds((previous) => previous.filter((value) => value !== id));
        setUncertainIds((previous) => previous.filter((value) => value !== id));
        if (error.phase === 'failed') setLocalFailure(true);
        return;
      }
      if (expected === generation.current && mounted.current)
        setUncertainIds((previous) => [...new Set([...previous, id])]);
    }
  };
  return {
    submit,
    recover,
    cancel,
    results,
    pendingIds,
    uncertain: uncertainIds.length > 0,
    localFailure,
    processing:
      pendingIds.length > 0 ||
      results.some(
        (row) => !['completed', 'cancelled', 'failed'].includes(row.status)
      ),
    latest: results.at(-1) ?? null
  };
}
