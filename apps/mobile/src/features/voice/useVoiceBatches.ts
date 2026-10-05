import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import {
  VoiceBatchLocalTerminalError,
  type VoiceBatchResult
} from '@/services/live/voice-batch-api-service';
import { invalidateCoreFinanceScopes } from '@/features/core-finance/core-finance-queries';
import { voiceAnalysisKey } from './voice-analysis-query';
const terminal = (status: string) =>
  ['completed', 'cancelled', 'failed'].includes(status);

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
  const settled = useRef(new Set<string>());
  const receipts = useRef(new Map<string, VoiceBatchResult>());
  const localSessions = useRef<Record<string, string>>({});
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
  useEffect(() => {
    const scrub = (value: VoiceBatchResult): VoiceBatchResult =>
      value.analysis &&
      Date.parse(value.analysis.expiresAt) <= Date.now() &&
      value.analysis.events.length
        ? { ...value, analysis: { ...value.analysis, events: [] } }
        : value;
    const retireExpired = () => {
      for (const [id, row] of receipts.current)
        receipts.current.set(id, scrub(row));
      setResults((previous) => previous.map(scrub));
      if (owner)
        client.setQueryData(
          voiceAnalysisKey(owner),
          [...receipts.current.values()]
            .filter((row) => row.analysis)
            .slice(-20)
        );
    };
    const expired = results.some((row) => scrub(row) !== row);
    if (expired) {
      retireExpired();
      return;
    }
    const expiry = Math.min(
      ...results
        .filter((row) => row.analysis?.events.length)
        .map((row) => Date.parse(row.analysis!.expiresAt))
    );
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(
      retireExpired,
      Math.max(1, expiry - Date.now() + 1)
    );
    return () => clearTimeout(timer);
  }, [results, owner, client]);
  const publish = useCallback(
    (result: VoiceBatchResult, expectedGeneration: number) => {
      if (!mounted.current || expectedGeneration !== generation.current) return;
      const prior = receipts.current.get(result.sessionId);
      if (
        prior &&
        ((terminal(prior.status) && !terminal(result.status)) ||
          result.ledgerVersion < prior.ledgerVersion)
      )
        return;
      receipts.current.set(result.sessionId, result);
      if (ownerRef.current)
        client.setQueryData(
          voiceAnalysisKey(ownerRef.current),
          [...receipts.current.values()]
            .filter((row) => row.analysis)
            .slice(-20)
        );
      if (terminal(result.status)) {
        for (const [id, session] of Object.entries(localSessions.current))
          if (session === result.sessionId) settled.current.add(id);
      }
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
          setPendingIds(
            [...new Set([...ids, ...active.current])].filter(
              (id) => !settled.current.has(id)
            )
          );
      });
      if (expected !== generation.current || !mounted.current) return;
      Object.assign(localSessions.current, values.localSessions);
      values.results.forEach((value) => publish(value, expected));
      setPendingIds(
        [...new Set([...values.pendingIds, ...active.current])].filter(
          (id) => !settled.current.has(id)
        )
      );
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
    settled.current.clear();
    receipts.current.clear();
    localSessions.current = {};
    seen.current.clear();
    client.removeQueries({ queryKey: voiceAnalysisKey(owner) });
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
      client.removeQueries({ queryKey: voiceAnalysisKey(owner) });
    };
  }, [owner, recover, invalidateGeneration, client]);
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
          localSessions.current[id] = value.sessionId;
          active.current.delete(id);
          if (terminal(value.status)) {
            settled.current.add(id);
            setPendingIds((previous) =>
              previous.filter((value) => value !== id)
            );
          }
          setUncertainIds((previous) =>
            previous.filter((value) => value !== id)
          );
        }
      })
      .catch((error: unknown) => {
        if (expected === generation.current && mounted.current) {
          active.current.delete(id);
          if (error instanceof VoiceBatchLocalTerminalError) {
            settled.current.add(id);
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
          const aliases = new Set([
            id,
            ...Object.entries(localSessions.current)
              .filter(([, session]) => session === value.sessionId)
              .map(([capture]) => capture)
          ]);
          aliases.forEach((alias) => {
            active.current.delete(alias);
            settled.current.add(alias);
          });
          setPendingIds((previous) =>
            previous.filter((value) => !aliases.has(value))
          );
          setUncertainIds((previous) =>
            previous.filter((value) => !aliases.has(value))
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
        settled.current.add(id);
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
    cancelIds: [
      ...new Set([
        ...pendingIds,
        ...results
          .filter(
            (row) =>
              !terminal(row.status) &&
              !pendingIds.some(
                (id) => localSessions.current[id] === row.sessionId
              )
          )
          .map((row) => row.sessionId)
      ])
    ],
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
